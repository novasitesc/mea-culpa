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

/** Cansancio: exhalación pesada, lastre grave y dos latidos lentos. */
export function playCansancioSfx(): void {
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  noise(a, t, 0.75, "lowpass", 900, 0.16, 260); // exhalación que se apaga
  tone(a, t + 0.05, 210, 0.9, 0.1, "triangle", 82); // el cuerpo que pesa
  [0, 0.4].forEach((d) => tone(a, t + 0.25 + d, 62, 0.22, 0.26, "sine", 44)); // latidos
}

/** Recuperación de una caída: inhalación y acorde cálido ascendente. */
export function playRecuperacionSfx(): void {
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  noise(a, t, 0.34, "bandpass", 400, 0.1, 1700); // inhalación
  [392.0, 523.25, 659.25].forEach((f, i) =>
    tone(a, t + 0.18 + i * 0.09, f, 0.75, 0.085, "triangle"),
  );
  tone(a, t + 0.5, 1318.51, 0.9, 0.045, "sine"); // brillo final
}

/** Resurrección: swell etéreo, arpegio ascendente y campanillas celestiales. */
export function playRevivirSfx(): void {
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  noise(a, t, 0.7, "highpass", 3000, 0.05, 9000); // aire que asciende
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
    tone(a, t + 0.15 + i * 0.12, f, 0.95, 0.075, "triangle"),
  );
  // acorde de gloria sostenido
  [523.25, 659.25, 783.99].forEach((f) => tone(a, t + 1.05, f, 1.7, 0.06, "triangle"));
  // brillos altos que centellean
  [1568, 2093, 2637, 3136].forEach((f, i) =>
    tone(a, t + 0.7 + i * 0.09, f, 1.1, 0.035, "sine"),
  );
}

// ── Lanzamiento de conjuro ───────────────────────────────────────────────────
// Estructura común (canalización → descarga → cola) con el timbre de la
// descarga cambiado por escuela: es lo que hace que Evocación suene a fuego y
// Nigromancia a algo enfermo, sin escribir ocho sonidos distintos.
type EscuelaSfx = {
  /** Notas de la descarga; la primera marca el carácter del conjuro. */
  acorde: number[];
  onda: OscillatorType;
  /** Filtro del ruido de la descarga. */
  ruido: [BiquadFilterType, number, number];
  /** true → la cola desciende (magia sombría) en vez de ascender. */
  sombrio?: boolean;
};

const ESCUELA_SFX: Record<string, EscuelaSfx> = {
  "Abjuración":    { acorde: [392, 587.33, 783.99], onda: "sine",     ruido: ["highpass", 2200, 5200] },
  "Conjuración":   { acorde: [349.23, 523.25, 698.46], onda: "triangle", ruido: ["bandpass", 1400, 3200] },
  "Adivinación":   { acorde: [659.25, 987.77, 1318.5], onda: "sine",   ruido: ["highpass", 4000, 9000] },
  "Encantamiento": { acorde: [440, 554.37, 659.25], onda: "sine",      ruido: ["bandpass", 900, 2600] },
  "Evocación":     { acorde: [261.63, 329.63, 392], onda: "sawtooth",  ruido: ["lowpass", 2400, 600] },
  "Ilusión":       { acorde: [466.16, 622.25, 830.61], onda: "triangle", ruido: ["bandpass", 2600, 1200] },
  "Nigromancia":   { acorde: [155.56, 207.65, 233.08], onda: "sawtooth", ruido: ["lowpass", 700, 220], sombrio: true },
  "Transmutación": { acorde: [329.63, 415.3, 493.88], onda: "triangle", ruido: ["bandpass", 1800, 4200] },
};

const ESCUELA_SFX_DEFAULT: EscuelaSfx = {
  acorde: [392, 523.25, 659.25],
  onda: "triangle",
  ruido: ["bandpass", 1600, 3600],
};

/**
 * Conjuro lanzado (~2 s): la energía se canaliza, descarga en el acorde de su
 * escuela y deja una cola de brillos. Trucos y conjuros de nivel suenan igual
 * salvo por el peso, que crece con `spellLevel`.
 */
export function playConjuroSfx(escuela?: string | null, spellLevel = 1): void {
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  const cfg = (escuela && ESCUELA_SFX[escuela]) || ESCUELA_SFX_DEFAULT;
  const [filtro, fIni, fFin] = cfg.ruido;
  // Los conjuros altos pesan más, pero con techo para no reventar la mezcla.
  const peso = Math.min(1, 0.55 + spellLevel * 0.07);

  // Canalización: energía que se arremolina antes de soltarse
  noise(a, t, 0.55, "bandpass", cfg.sombrio ? 600 : 900, 0.07 * peso, cfg.sombrio ? 200 : 3400);
  tone(a, t, cfg.acorde[0] / 2, 0.6, 0.05 * peso, "sine", cfg.acorde[0] * (cfg.sombrio ? 0.6 : 0.9));

  // Descarga
  const d = t + 0.55;
  noise(a, d, 0.22, filtro, fIni, 0.22 * peso, fFin);
  cfg.acorde.forEach((f, i) => {
    tone(a, d + i * 0.035, f, 0.7 - i * 0.08, 0.075 * peso, cfg.onda);
    tone(a, d + i * 0.035, f * 2, 0.35, 0.025 * peso, "sine");
  });

  // Cola: asciende (magia luminosa) o cae (magia sombría)
  const cola = cfg.sombrio ? [0.5, 0.35, 0.25] : [2, 2.5, 3];
  cola.forEach((mult, i) =>
    tone(a, d + 0.3 + i * 0.11, cfg.acorde[0] * mult, 0.75 - i * 0.12, 0.03 * peso, "sine"),
  );
}

/**
 * Ascenso de nivel: swell ascendente, fanfarria mayor de tres acordes,
 * campana de proclamación y una lluvia de brillos que se apaga.
 * Es el sonido más largo del set (~4 s) porque acompaña al overlay 3D.
 */
export function playSubidaNivelSfx(): void {
  const a = ac();
  if (!a) return;
  const t = a.currentTime;

  // Swell: aire que asciende antes del impacto
  noise(a, t, 0.85, "bandpass", 300, 0.09, 5200);

  // Golpe de luz al estallar el sello
  tone(a, t + 0.8, 180, 0.3, 0.34, "sine", 60);
  noise(a, t + 0.8, 0.14, "lowpass", 1200, 0.24);

  // Fanfarria mayor ascendente (Do → Fa → Sol7) con octava de brillo
  const chords: [number[], number, number][] = [
    [[261.63, 329.63, 392.0], 0.82, 0.4],
    [[349.23, 440.0, 523.25], 1.2, 0.4],
    [[392.0, 493.88, 587.33, 783.99], 1.58, 1.9],
  ];
  for (const [notes, at, dur] of chords) {
    for (const f of notes) {
      pad(a, t + at, f, dur, 0.055, "sawtooth", 6);
      tone(a, t + at, f * 2, dur, 0.022, "triangle");
    }
  }

  // Campana de proclamación sobre el acorde final
  tone(a, t + 1.62, 1046.5, 2.2, 0.07, "triangle");
  tone(a, t + 1.62, 1568.0, 1.6, 0.035, "sine");

  // Lluvia de brillos que se apaga
  [2093, 2637, 3136, 2349, 1976, 2794].forEach((f, i) =>
    tone(a, t + 1.9 + i * 0.13, f, 0.8 - i * 0.08, 0.03, "sine"),
  );
}

/** Muerte: impacto profundo, barrido de fatalidad y doble tañido fúnebre disonante. */
export function playMatarSfx(): void {
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  tone(a, t, 92, 0.55, 0.5, "sine", 28); // golpe sordo del alma que cae
  noise(a, t, 0.2, "lowpass", 500, 0.36); // polvo del impacto
  tone(a, t + 0.04, 420, 0.55, 0.14, "sawtooth", 55); // barrido descendente de fatalidad
  // campana fúnebre grave con segunda menor batiendo
  [73.42, 77.78].forEach((f) => tone(a, t + 0.42, f, 3.4, 0.2, "sine"));
  [146.83, 155.56].forEach((f) => tone(a, t + 0.42, f, 2.2, 0.07, "triangle"));
  [61.74, 65.41].forEach((f) => tone(a, t + 1.7, f, 3.6, 0.17, "sine")); // segundo tañido, más grave
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

/** Click seco al entrar a un módulo del panel: pulsador mecánico, sin melodía. */
export function playUiClickSfx(): void {
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  noise(a, t, 0.012, "highpass", 2600, 0.22); // chasquido del pulsador
  tone(a, t, 1100, 0.02, 0.05, "square", 700); // cuerpo del contacto
  noise(a, t + 0.035, 0.02, "bandpass", 1200, 0.09); // rebote del muelle
}

/** Tick sutil al pasar sobre un botón del panel. */
export function playUiHoverSfx(): void {
  const a = ac();
  if (!a) return;
  noise(a, a.currentTime, 0.02, "bandpass", 3500, 0.045);
}

/** Volver al inicio del panel: barrido de "retroceso" que cae de tono. */
export function playUiBackSfx(): void {
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  noise(a, t, 0.2, "bandpass", 2600, 0.13, 480); // swoosh que desciende
  tone(a, t, 520, 0.18, 0.07, "sine", 190); // caída de tono principal
  tone(a, t + 0.05, 320, 0.22, 0.05, "triangle", 130); // cola grave
  tone(a, t + 0.16, 90, 0.14, 0.16, "sine", 55); // golpecito seco al cerrar
}

/** Cúmulo de osciladores desafinados (chorus): más cuerpo y variedad tímbrica. */
function pad(
  a: AudioContext,
  t: number,
  freq: number,
  dur: number,
  vol: number,
  type: OscillatorType = "sawtooth",
  detune = 8,
): void {
  for (const d of [-detune, 0, detune]) {
    const osc = a.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.detune.setValueAtTime(d, t);
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(a.destination);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }
}

// ── Ritual del sello: acorde sostenido que asciende con el progreso ──────────
// Voces armónicas limpias (triangle/sine, sin sierra grave que zumba) cuyo tono
// sigue a `charge` (0→1) y desciende al soltar. Dos timbres bien distintos:
//  · ascension → brillante, consonante (octava + duodécima), registro alto.
//  · revocation → sombrío, disonante (sub + trítono), registro grave.
export type SealVariant = "ascension" | "revocation";

type SealCfg = {
  base: number;
  oct: number;
  filtBase: number;
  filtRange: number;
  voices: { ratio: number; type: OscillatorType; vol: number }[];
};

const SEAL_CFG: Record<SealVariant, SealCfg> = {
  ascension: {
    base: 174.61, // F3
    oct: 1.5,
    filtBase: 1000,
    filtRange: 6000,
    voices: [
      { ratio: 1, type: "triangle", vol: 0.85 },
      { ratio: 2, type: "sine", vol: 0.42 }, // octava (brillo de campana)
      { ratio: 3, type: "sine", vol: 0.15 }, // duodécima (aire celestial)
    ],
  },
  revocation: {
    base: 98.0, // G2
    oct: 1.3,
    filtBase: 280,
    filtRange: 1700,
    voices: [
      { ratio: 0.5, type: "sine", vol: 0.55 }, // sub grave
      { ratio: 1, type: "triangle", vol: 0.85 },
      { ratio: 1.41421, type: "sine", vol: 0.24 }, // trítono: tensión sombría
    ],
  },
};

let sealNodes: {
  a: AudioContext;
  cfg: SealCfg;
  voices: { osc: OscillatorNode; ratio: number }[];
  gain: GainNode;
  filter: BiquadFilterNode;
} | null = null;

function stopSealNodes(fadeMs = 90): void {
  if (!sealNodes) return;
  const { a, voices, gain } = sealNodes;
  const t = a.currentTime;
  gain.gain.cancelScheduledValues(t);
  gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + fadeMs / 1000);
  const end = t + fadeMs / 1000 + 0.02;
  for (const v of voices) try { v.osc.stop(end); } catch {}
  sealNodes = null;
}

/** Empieza el acorde de carga del sello (al mantener pulsado). */
export function startSealCharge(variant: SealVariant = "ascension"): void {
  const a = ac();
  if (!a) return;
  stopSealNodes(30);
  const t = a.currentTime;
  const cfg = SEAL_CFG[variant];
  const gain = a.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(0.05, t + 0.08);
  const filter = a.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(cfg.filtBase, t);
  filter.Q.setValueAtTime(0.7, t);
  filter.connect(gain).connect(a.destination);
  const voices = cfg.voices.map((v) => {
    const osc = a.createOscillator();
    osc.type = v.type;
    osc.frequency.setValueAtTime(cfg.base * v.ratio, t);
    const vg = a.createGain();
    vg.gain.setValueAtTime(v.vol, t);
    osc.connect(vg).connect(filter);
    osc.start(t);
    return { osc, ratio: v.ratio };
  });
  sealNodes = { a, cfg, voices, gain, filter };
}

/** Sincroniza el acorde con el progreso (0→1) mientras se carga. */
export function updateSealCharge(charge: number): void {
  if (!sealNodes) return;
  const { a, cfg, voices, gain, filter } = sealNodes;
  const c = Math.min(1, Math.max(0, charge));
  const t = a.currentTime;
  const f = cfg.base * Math.pow(2, c * cfg.oct);
  for (const v of voices) v.osc.frequency.setTargetAtTime(f * v.ratio, t, 0.03);
  filter.frequency.setTargetAtTime(cfg.filtBase + c * cfg.filtRange, t, 0.04);
  gain.gain.setTargetAtTime(0.05 + c * 0.09, t, 0.05);
}

/** Soltar antes de completar: el acorde cae y se apaga. */
export function releaseSealCharge(): void {
  if (!sealNodes) return;
  const { a, voices, gain } = sealNodes;
  const t = a.currentTime;
  for (const v of voices) {
    const cur = v.osc.frequency.value;
    v.osc.frequency.cancelScheduledValues(t);
    v.osc.frequency.setValueAtTime(cur, t);
    v.osc.frequency.exponentialRampToValueAtTime(Math.max(30, cur * 0.45), t + 0.3);
  }
  gain.gain.cancelScheduledValues(t);
  gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
  const end = t + 0.36;
  for (const v of voices) try { v.osc.stop(end); } catch {}
  sealNodes = null;
}

/** Corta el acorde de carga (al completar o desmontar). */
export function stopSealCharge(): void {
  stopSealNodes(80);
}

/** El sello se cumple: golpe del cuño + anillo metálico brillante. */
export function playSealCompleteSfx(): void {
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  tone(a, t, 150, 0.16, 0.44, "sine", 52); // golpe grave del cuño
  noise(a, t, 0.08, "lowpass", 1000, 0.34); // impacto sordo
  [1046.5, 1567.98, 2093].forEach((f, i) =>
    tone(a, t + 0.02, f, 0.55 - i * 0.09, 0.08, "triangle"),
  );
  noise(a, t + 0.02, 0.05, "highpass", 6000, 0.09); // chispa del sello
}

/** Temblor del modal al sellar: retumbo de terremoto (ruido grave) + golpe. */
export function playSealShakeSfx(): void {
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  // Golpe seco inicial
  tone(a, t, 70, 0.18, 0.4, "sine", 40);
  // Retumbo grave a base de ruido filtrado (sin tono buzz)
  noise(a, t, 0.7, "lowpass", 220, 0.32);
  noise(a, t + 0.18, 0.5, "lowpass", 180, 0.22);
  noise(a, t + 0.4, 0.34, "lowpass", 260, 0.14);
  // Escombros que se desprenden
  noise(a, t + 0.3, 0.2, "bandpass", 1700, 0.07);
}

/** Decreto del DM consumado: fanfarria regia de dos acordes + campana. */
export function playDecreeSfx(): void {
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  pad(a, t, 261.63, 0.36, 0.07, "sawtooth"); // Do
  pad(a, t, 392.0, 0.36, 0.06, "sawtooth"); // Sol
  pad(a, t, 523.25, 0.36, 0.06, "sawtooth"); // Do agudo
  pad(a, t + 0.3, 349.23, 0.75, 0.07, "sawtooth"); // Fa
  pad(a, t + 0.3, 523.25, 0.75, 0.06, "sawtooth"); // Do
  pad(a, t + 0.3, 698.46, 0.75, 0.06, "sawtooth"); // Fa agudo
  tone(a, t + 0.32, 1046.5, 1.2, 0.06, "triangle"); // campana de proclamación
  noise(a, t + 0.3, 0.05, "highpass", 5000, 0.06);
}

/** Título de DM revocado: el sello se quiebra — impacto, esquirlas y doble tañido. */
export function playRevokeSfx(): void {
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  tone(a, t, 130, 0.32, 0.46, "sine", 34); // impacto de ruptura
  noise(a, t, 0.16, "lowpass", 460, 0.34); // grava del golpe
  // Esquirlas del sello que se quiebra (cristal/piedra)
  [2600, 3300, 4200, 5200].forEach((f, i) =>
    noise(a, t + 0.03 + i * 0.045, 0.05, "bandpass", f, 0.13),
  );
  // Tañido fúnebre descendente y disonante
  [130.81, 138.59].forEach((f) => tone(a, t + 0.26, f, 2.6, 0.17, "sine"));
  [65.41, 69.3].forEach((f) => tone(a, t + 0.95, f, 2.8, 0.15, "sine"));
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

/** Roce de pergamino al pasar sobre una tarjeta: swipe corto y cálido. */
export function playCardHoverSfx(): void {
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  noise(a, t, 0.035, "bandpass", 2600, 0.05, 1500); // roce de papel descendente
  tone(a, t, 560, 0.045, 0.028, "triangle", 700); // toque cálido apenas audible
}

/** Bolsa de cuero que se abre: golpe sordo + tintineo de hebilla. */
export function playBagOpenSfx(): void {
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  noise(a, t, 0.15, "lowpass", 520, 0.22, 200); // cuero abriéndose (whump)
  noise(a, t + 0.02, 0.05, "bandpass", 1800, 0.08); // roce de la solapa
  [1318.5, 1760].forEach((f, i) =>
    tone(a, t + 0.09 + i * 0.05, f, 0.2, 0.05, "triangle"),
  ); // tintineo metálico de la hebilla
}

/** Seleccionar un objeto: agarre breve + pluck ascendente con brillo. */
export function playItemSelectSfx(): void {
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  noise(a, t, 0.015, "highpass", 3000, 0.08); // clic de agarre
  tone(a, t, 784, 0.09, 0.07, "triangle", 988); // pluck ascendente breve
  tone(a, t + 0.02, 1568, 0.06, 0.03, "sine"); // brillo agudo
}

/** Bajas en el ejército: choque de espadas, redoble de guerra y caída de estandarte. */
export function playEjercitoBajaSfx(aniquilada = false): void {
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  // Choque de acero cortante (clash)
  noise(a, t, 0.18, "bandpass", 4200, 0.35, 1200);
  noise(a, t + 0.02, 0.12, "highpass", 3500, 0.25);
  tone(a, t, 880, 0.14, 0.22, "sawtooth", 220); // resonancia de hoja metálica
  tone(a, t + 0.04, 1320, 0.1, 0.15, "triangle", 440);

  // Tambor de guerra sordo (impacto en el pecho)
  tone(a, t + 0.06, 95, 0.35, 0.45, "sine", 32);
  noise(a, t + 0.06, 0.15, "lowpass", 450, 0.3);

  // Segundo golpe de combate
  noise(a, t + 0.18, 0.14, "bandpass", 3200, 0.28, 800);
  tone(a, t + 0.18, 80, 0.4, 0.4, "sine", 28);

  if (aniquilada) {
    // Si la unidad fue aniquilada: cuerno fúnebre y tañido grave de derrota
    [110, 116.54].forEach((f) => tone(a, t + 0.45, f, 2.2, 0.25, "sawtooth", f * 0.85));
    [55, 58.27].forEach((f) => tone(a, t + 0.7, f, 2.6, 0.3, "sine"));
    noise(a, t + 0.4, 0.4, "lowpass", 300, 0.25); // retumbar de escombros
  }
}

