// Sonido sintetizado con WebAudio: golpe sordo al aterrizar y tintineo al revelar.
// Sin archivos de audio; toggle persistido en localStorage.
const STORAGE_KEY = "dados-sonido";

let ctx: AudioContext | null = null;

export function isDiceSoundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY) !== "off";
}

export function setDiceSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
  } catch {}
}

/** Llamar dentro de un gesto del usuario (clic de Tirar) para poder sonar después. */
export function primeDiceSound(): void {
  if (typeof window === "undefined" || !isDiceSoundEnabled()) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    ctx = null;
  }
}

function ac(): AudioContext | null {
  return isDiceSoundEnabled() && ctx && ctx.state === "running" ? ctx : null;
}

/** Golpe del dado contra la mesa; intensity 0–1 atenúa los rebotes. */
export function playThud(intensity = 1): void {
  const audio = ac();
  if (!audio) return;
  const t = audio.currentTime;

  const osc = audio.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(95 + Math.random() * 25, t);
  osc.frequency.exponentialRampToValueAtTime(42, t + 0.11);
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.4 * intensity, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
  osc.connect(gain).connect(audio.destination);
  osc.start(t);
  osc.stop(t + 0.17);

  // chasquido de contacto: ráfaga corta de ruido filtrado
  const len = Math.floor(audio.sampleRate * 0.045);
  const buf = audio.createBuffer(1, len, audio.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const noise = audio.createBufferSource();
  noise.buffer = buf;
  const filter = audio.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 900;
  const nGain = audio.createGain();
  nGain.gain.value = 0.22 * intensity;
  noise.connect(filter).connect(nGain).connect(audio.destination);
  noise.start(t);
}

/** Clic seco del dado tumbando sobre la mesa (uno por cuarto de vuelta). */
export function playTick(intensity = 1): void {
  const audio = ac();
  if (!audio) return;
  const t = audio.currentTime;
  const len = Math.floor(audio.sampleRate * 0.02);
  const buf = audio.createBuffer(1, len, audio.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
  const noise = audio.createBufferSource();
  noise.buffer = buf;
  const filter = audio.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 1600 + Math.random() * 900;
  filter.Q.value = 1.2;
  const g = audio.createGain();
  g.gain.value = 0.09 * intensity;
  noise.connect(filter).connect(g).connect(audio.destination);
  noise.start(t);
}

// Helpers locales para el nuevo tintineo (mismo AudioContext que respeta el toggle).
function dTone(
  a: AudioContext,
  t: number,
  freq: number,
  dur: number,
  vol: number,
  type: OscillatorType = "triangle",
  freqEnd?: number,
): void {
  const osc = a.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function dNoise(
  a: AudioContext,
  t: number,
  dur: number,
  type: BiquadFilterType,
  freq: number,
  vol: number,
  freqEnd?: number,
): void {
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}

// Tintineo de UNA moneda: partiales inarmónicos (metal, no nota musical) con
// decaimiento rápido + micro-transitorio de contacto. Es el ladrillo del saco.
function coinClink(a: AudioContext, t: number, base: number, vol: number): void {
  // Ratios inarmónicos tipo metal golpeado — nada de armónicos enteros.
  for (const [ratio, g] of [[1, 1], [1.62, 0.55], [2.35, 0.32]] as const) {
    const osc = a.createOscillator();
    osc.type = "sine";
    const f = base * ratio * (0.98 + Math.random() * 0.04);
    osc.frequency.setValueAtTime(f, t);
    osc.frequency.exponentialRampToValueAtTime(f * 0.94, t + 0.12);
    const gain = a.createGain();
    gain.gain.setValueAtTime(vol * g, t);
    gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.09 + Math.random() * 0.06);
    osc.connect(gain).connect(a.destination);
    osc.start(t);
    osc.stop(t + 0.2);
  }
  // "Tick" del canto al chocar.
  dNoise(a, t, 0.012, "bandpass", 6000 + Math.random() * 2500, vol * 0.7);
}

/**
 * Revelación del premio: swoosh ascendente + impacto grave y, según el tipo,
 * cascada de monedas (oro) y/o arpegio mágico con destellos (ítem).
 */
export function playReveal(kind: "oro" | "item" | "nada" | "mixto"): void {
  const a = ac();
  if (!a) return;
  const t = a.currentTime;

  if (kind === "nada") {
    dNoise(a, t, 0.28, "lowpass", 700, 0.12, 300); // aire que se apaga
    dTone(a, t, 174.6, 0.5, 0.12, "sine", 130); // tañido grave desilusionado
    return;
  }

  // Común: barrido ascendente + golpe cálido que anuncia la aparición del panel.
  dNoise(a, t, 0.22, "highpass", 500, 0.09, 6000);
  dTone(a, t, 130, 0.18, 0.28, "sine", 320);

  if (kind === "oro" || kind === "mixto") {
    // Saco de monedas volcándose: golpe sordo de la bolsa + un puñado de
    // tintineos metálicos amontonándose (denso al inicio, se dispersa al caer).
    dTone(a, t + 0.06, 90, 0.22, 0.3, "sine", 55); // impacto grave del saco
    dNoise(a, t + 0.06, 0.09, "lowpass", 420, 0.16); // tela/cuero del saco
    const N = 14;
    let at = t + 0.08;
    for (let i = 0; i < N; i++) {
      at += 0.018 + Math.random() * 0.05 * (i / N); // se van separando al asentarse
      const base = 2500 + Math.random() * 1700; // cada moneda su propio timbre
      const vol = 0.075 * (1 - (i / N) * 0.45); // las últimas suenan más suaves
      coinClink(a, at, base, vol);
    }
  }

  if (kind === "item" || kind === "mixto") {
    // Arpegio mágico ascendente + destello agudo final.
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      dTone(a, t + 0.14 + i * 0.08, f, 0.55, 0.09, "triangle"),
    );
    dTone(a, t + 0.5, 1568, 0.7, 0.045, "sine");
    dNoise(a, t + 0.14, 0.05, "highpass", 7000, 0.06); // chispa
  }
}
