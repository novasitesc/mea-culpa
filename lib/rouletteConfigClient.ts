type RouletteConfigPayload = {
  enabled?: boolean;
  error?: string;
  [key: string]: unknown;
};

type FetchRouletteConfigOptions = {
  token?: string;
  force?: boolean;
};

const CACHE_TTL_MS = 5000;
const ANON_KEY = "__anon__";

let cachedData: RouletteConfigPayload | null = null;
let cachedUntil = 0;
let cachedTokenKey = ANON_KEY;
let inFlightRequest: Promise<RouletteConfigPayload> | null = null;
let inFlightTokenKey = ANON_KEY;

const getTokenKey = (token?: string) => token ?? ANON_KEY;

export async function fetchRouletteConfig(
  options: FetchRouletteConfigOptions = {},
): Promise<RouletteConfigPayload> {
  const { token, force = false } = options;
  const tokenKey = getTokenKey(token);
  const now = Date.now();

  if (!force && cachedData && now < cachedUntil && cachedTokenKey === tokenKey) {
    return cachedData;
  }

  if (inFlightRequest && inFlightTokenKey === tokenKey) {
    return inFlightRequest;
  }

  inFlightTokenKey = tokenKey;
  inFlightRequest = (async () => {
    const res = await fetch("/api/ruleta/config", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    const data = (await res.json()) as RouletteConfigPayload;
    if (!res.ok) {
      throw new Error(data.error ?? "Error cargando configuracion de ruleta");
    }

    cachedData = data;
    cachedTokenKey = tokenKey;
    cachedUntil = Date.now() + CACHE_TTL_MS;
    return data;
  })();

  try {
    return await inFlightRequest;
  } finally {
    if (inFlightTokenKey === tokenKey) {
      inFlightRequest = null;
    }
  }
}

export type { RouletteConfigPayload };
