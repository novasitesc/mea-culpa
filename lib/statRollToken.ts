// SOLO SERVIDOR — firma y verificación de tiradas de stats (4d6 drop lowest).
// Las tiradas se generan en el servidor y viajan al cliente junto a un token
// HMAC; al crear el personaje se verifica que los seis valores enviados sean
// exactamente los que el servidor tiró (mismo multiconjunto), sin necesidad de
// guardar estado en base de datos.

import { createHmac, timingSafeEqual } from "crypto";
import { ROLL_TOKEN_TTL_MS } from "@/lib/statAllocation";

export type DiceRoll = { dice: number[]; total: number };

function hmacSecret(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY no configurada");
  return `mea-culpa:roll-stats:v1:${key}`;
}

function signPayload(userId: string, totals: number[], expiresAt: number): string {
  const sorted = [...totals].sort((a, b) => a - b).join(",");
  return createHmac("sha256", hmacSecret())
    .update(`${userId}:${sorted}:${expiresAt}`)
    .digest("hex");
}

// Las tiradas son deterministas por (usuario, día, nº de personajes vivos):
// repetir la petición devuelve los mismos dados, así que no se puede "farmear"
// la tirada repitiendo hasta sacar valores altos. El destino es el destino.
export function rollAbilityScores(userId: string, characterCount: number): DiceRoll[] {
  const day = new Date().toISOString().slice(0, 10);
  const rolls: DiceRoll[] = [];
  let block = 0;
  let pool: Buffer = Buffer.alloc(0);
  let offset = 0;

  const nextDie = (): number => {
    for (;;) {
      if (offset >= pool.length) {
        pool = createHmac("sha256", hmacSecret())
          .update(`dice:${userId}:${day}:${characterCount}:${block++}`)
          .digest();
        offset = 0;
      }
      const byte = pool[offset++];
      // Rechazo para eliminar el sesgo del módulo (252 = 6 * 42)
      if (byte < 252) return (byte % 6) + 1;
    }
  };

  for (let i = 0; i < 6; i++) {
    const dice = [nextDie(), nextDie(), nextDie(), nextDie()];
    const total = dice.reduce((a, b) => a + b, 0) - Math.min(...dice);
    rolls.push({ dice, total });
  }
  return rolls;
}

export function createRollToken(userId: string, totals: number[]): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + ROLL_TOKEN_TTL_MS;
  return { token: `${expiresAt}.${signPayload(userId, totals, expiresAt)}`, expiresAt };
}

export function verifyRollToken(
  userId: string,
  totals: number[],
  token: unknown,
): { ok: true } | { ok: false; error: string } {
  if (typeof token !== "string" || !token.includes(".")) {
    return { ok: false, error: "Falta el token de la tirada de dados." };
  }
  const [expiresPart, signature] = token.split(".");
  const expiresAt = Number(expiresPart);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) {
    return { ok: false, error: "La tirada de dados expiró. Vuelve a lanzar los dados." };
  }
  const expected = signPayload(userId, totals, expiresAt);
  const a = Buffer.from(signature ?? "", "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, error: "Los valores no coinciden con la tirada del servidor." };
  }
  return { ok: true };
}
