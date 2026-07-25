// Sonidos del comercio cargados desde archivos en /public/sounds.
// Reemplazables: sobrescribe el mismo .wav con tu grabación preferida.
// Toggle persistido en localStorage; se clona el nodo para permitir solapado.
const STORAGE_KEY = "comercio-sonido";

const FILES = {
  hover: { src: "/sounds/commerce-hover.wav", vol: 0.25 },
  click: { src: "/sounds/commerce-click.wav", vol: 0.4 },
  publish: { src: "/sounds/commerce-publish.wav", vol: 0.6 },
  coins: { src: "/sounds/commerce-coins.wav", vol: 0.75 },
  error: { src: "/sounds/commerce-error.wav", vol: 0.5 },
} as const;

export type CommerceSound = keyof typeof FILES;

const cache = new Map<CommerceSound, HTMLAudioElement>();

export function isCommerceSoundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY) !== "off";
}

export function setCommerceSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
  } catch {}
}

/** Precarga los audios; llamar tras el primer gesto del usuario. */
export function primeCommerceSound(): void {
  if (typeof window === "undefined") return;
  for (const key of Object.keys(FILES) as CommerceSound[]) {
    if (cache.has(key)) continue;
    const el = new Audio(FILES[key].src);
    el.preload = "auto";
    cache.set(key, el);
  }
}

export function playCommerce(sound: CommerceSound): void {
  if (!isCommerceSoundEnabled()) return;
  const base = cache.get(sound);
  const { src, vol } = FILES[sound];
  // Clonar permite disparos solapados sin cortar el anterior.
  const node = base ? (base.cloneNode() as HTMLAudioElement) : new Audio(src);
  node.volume = vol;
  void node.play().catch(() => {});
}
