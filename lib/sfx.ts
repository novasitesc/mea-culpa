// Efectos de sonido sintetizados con WebAudio para la sala en vivo y el panel
// admin. Sin archivos de audio, siguiendo el patrón de dice-sound.ts.
// El contexto se desbloquea con el primer gesto del usuario en la página;
// los sonidos disparados por broadcast fallan en silencio hasta entonces.

let ctx: AudioContext | null = null;

function unlock(): void {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  } catch {
    ctx = null;
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock);
}

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  unlock();
  return ctx && ctx.state === "running" ? ctx : null;
}

/** Ráfaga de ruido filtrado: base de golpes, cortes y chasquidos. */
function noise(
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
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  src.buffer = buf;
  const filter = a.createBiquadFilter();
  filter.type = type;
  filter.frequency.setValueAtTime(freq, t);
  if (freqEnd) filter.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(filter).connect(g).connect(a.destination);
  src.start(t);
}

/** Tono con caída exponencial. */
function tone(
  a: AudioContext,
  t: number,
  freq: number,
  dur: number,
  vol: number,
  type: OscillatorType = "sine",
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

/** Caída en combate: cuerpo contra el suelo + crujido de hueso. */
export function playCaidaSfx(): void {
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  tone(a, t, 130, 0.28, 0.5, "sine", 38); // impacto grave
  noise(a, t, 0.09, "lowpass", 700, 0.3); // polvo del golpe
  noise(a, t + 0.06, 0.05, "bandpass", 2400, 0.22); // crack
  noise(a, t + 0.13, 0.04, "bandpass", 3100, 0.16); // crack seco
}

/** Derrota: impacto sordo y campana fúnebre disonante en dos tañidos. */
export function playDerrotaSfx(): void {
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  tone(a, t, 120, 0.35, 0.5, "sine", 35);
  noise(a, t, 0.12, "lowpass", 600, 0.3);
  // campana grave con segunda menor batiendo
  [98, 103.8].forEach((f) => tone(a, t + 0.25, f, 2.6, 0.2, "sine"));
  [196, 207.6].forEach((f) => tone(a, t + 0.25, f, 1.8, 0.07, "triangle"));
  [82.4, 87.3].forEach((f) => tone(a, t + 1.35, f, 2.8, 0.16, "sine"));
}

/** Desmembramiento: silbido del filo, corte húmedo y el miembro al caer. */
export function playDesmembramientoSfx(): void {
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  noise(a, t, 0.16, "bandpass", 5200, 0.28, 900); // silbido descendente del filo
  noise(a, t + 0.1, 0.12, "lowpass", 1400, 0.3); // corte húmedo
  tone(a, t + 0.1, 220, 0.12, 0.16, "sawtooth", 60);
  tone(a, t + 0.32, 90, 0.2, 0.3, "sine", 45); // golpe al caer
}

/** Consumible: glugluteo del frasco + destello mágico. */
export function playConsumibleSfx(): void {
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  [0, 0.11, 0.22].forEach((d, i) =>
    tone(a, t + d, 300 - i * 40, 0.09, 0.14, "sine", 180 - i * 30),
  );
  [880, 1174.7, 1568].forEach((f, i) =>
    tone(a, t + 0.3 + i * 0.07, f, 0.5, 0.07, "triangle"),
  );
}

/** Fanfarria de fin de partida: tres acordes ascendentes de metal + brillo. */
export function playFanfarriaSfx(): void {
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  const chords: [number[], number, number][] = [
    [[261.63, 329.63, 392.0], 0, 0.45],
    [[349.23, 440.0, 523.25], 0.42, 0.45],
    [[392.0, 493.88, 587.33, 783.99], 0.84, 1.6],
  ];
  for (const [notes, at, dur] of chords) {
    for (const f of notes) {
      tone(a, t + at, f, dur, 0.08, "sawtooth");
      tone(a, t + at, f * 2, dur, 0.025, "triangle");
    }
  }
  [1568, 2093].forEach((f, i) => tone(a, t + 1.0 + i * 0.12, f, 0.9, 0.05, "triangle"));
}

/** Revelación de un objeto del botín en la pantalla final. */
export function playLootRevealSfx(i = 0): void {
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  tone(a, t, 523.25 * Math.pow(1.0595, i % 8), 0.35, 0.09, "triangle");
  noise(a, t, 0.03, "highpass", 6000, 0.05);
}

/** Sello que se abre: clic + campanilla al entrar a una sección del panel. */
export function playUiOpenSfx(): void {
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  noise(a, t, 0.03, "bandpass", 2000, 0.12);
  tone(a, t + 0.02, 523.25, 0.18, 0.09, "triangle");
  tone(a, t + 0.08, 783.99, 0.25, 0.07, "triangle");
}

/** Tick sutil al pasar sobre un botón del panel. */
export function playUiHoverSfx(): void {
  const a = ac();
  if (!a) return;
  noise(a, a.currentTime, 0.02, "bandpass", 3500, 0.045);
}

/** Volver al inicio del panel: campanilla descendente. */
export function playUiBackSfx(): void {
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  tone(a, t, 659.25, 0.12, 0.07, "triangle");
  tone(a, t + 0.06, 440, 0.2, 0.07, "triangle");
}

/** Toast de éxito: dos campanillas ascendentes. */
export function playSuccessSfx(): void {
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  tone(a, t, 659.25, 0.18, 0.09, "triangle");
  tone(a, t + 0.09, 987.77, 0.35, 0.08, "triangle");
}

/** Toast de error: zumbido grave descendente. */
export function playErrorSfx(): void {
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  tone(a, t, 220, 0.25, 0.1, "sawtooth", 130);
  tone(a, t + 0.02, 110, 0.3, 0.14, "sine", 80);
}
