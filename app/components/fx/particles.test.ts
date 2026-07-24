// Check de los helpers de FX. Ejecutar: npx tsx app/components/fx/particles.test.ts
import assert from "node:assert/strict";
import { easeOutBack, confettiColors, CANDY_PALETTE, clamp01 } from "./particles";

// easeOutBack: ancla en los extremos y sobrepasa 1 (el "boing") en el tramo final.
assert.ok(Math.abs(easeOutBack(0)) < 1e-9, `easeOutBack(0) = ${easeOutBack(0)}`);
assert.ok(Math.abs(easeOutBack(1) - 1) < 1e-9, `easeOutBack(1) = ${easeOutBack(1)}`);
const peak = Math.max(...Array.from({ length: 101 }, (_, i) => easeOutBack(i / 100)));
assert.ok(peak > 1.05, `easeOutBack debe sobrepasar 1 (pico ${peak.toFixed(3)})`);

// confettiColors: longitud correcta, todo en [0,1] y cada tripleta es un color de la paleta.
const N = 200;
const cols = confettiColors(N);
assert.equal(cols.length, N * 3);
const norm = CANDY_PALETTE.map((c) => c.map((v) => v / 255));
for (let i = 0; i < N; i++) {
  const rgb = [cols[i * 3], cols[i * 3 + 1], cols[i * 3 + 2]];
  assert.ok(rgb.every((v) => v >= 0 && v <= 1), `color fuera de rango en ${i}`);
  assert.ok(
    norm.some((p) => p.every((v, k) => Math.abs(v - rgb[k]) < 1e-6)),
    `color no pertenece a la paleta en ${i}`,
  );
}

assert.equal(clamp01(2), 1);
assert.equal(clamp01(-3), 0);

console.log("particles.test.ts: OK — easeOutBack, confettiColors y clamp01 verificados");
