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

/** Tintineo del premio al revelarse. */
export function playReveal(kind: "oro" | "item" | "nada" | "mixto"): void {
  const audio = ac();
  if (!audio) return;
  const t = audio.currentTime;

  if (kind === "nada") {
    const osc = audio.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 174.6; // F3 apagado
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc.connect(gain).connect(audio.destination);
    osc.start(t);
    osc.stop(t + 0.45);
    return;
  }

  const notas =
    kind === "item" ? [523.25, 784.0] : [659.25, 880.0, 1318.5]; // C5–G5 / E5–A5–E6
  notas.forEach((freq, i) => {
    const start = t + i * 0.085;
    const osc = audio.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = freq;
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0.16, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.55);
    osc.connect(gain).connect(audio.destination);
    osc.start(start);
    osc.stop(start + 0.6);
  });
}
