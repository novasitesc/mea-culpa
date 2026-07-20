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
    // Cascada de monedas: chispazos metálicos brillantes, algo aleatorios.
    for (let i = 0; i < 7; i++) {
      const at = t + 0.12 + i * 0.045;
      const f = 1400 + Math.random() * 1400;
      dTone(a, at, f, 0.16, 0.06, "square", f * 0.6);
      dNoise(a, at, 0.03, "bandpass", 5200 + Math.random() * 2000, 0.05);
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
