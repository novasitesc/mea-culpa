// Test determinista del motor de dados. Ejecutar: npx tsx lib/dice/engine.test.ts
import assert from "node:assert/strict";
import { resolveRoll, DiceConfigError } from "./engine";
import type { RewardConfig } from "./engine";

// RNG de cola: cada llamada consume el siguiente valor fijo.
function rngFrom(values: number[]) {
  let i = 0;
  return () => {
    if (i >= values.length) throw new Error(`RNG agotado tras ${values.length} llamadas`);
    return values[i++];
  };
}

const base: Omit<RewardConfig, "tipo"> = {
  id: 1,
  nombre: "Test",
  tipoDado: "d6",
  costoOro: 0,
  objetoId: null,
  cantidadDados: 1,
  multiplicadorOro: 1,
  sublista: [],
  lutCaras: [],
  subtablas: {},
};

// 1. item_fijo: dado decorativo, siempre el objeto ×1
{
  const out = resolveRoll({ ...base, tipo: "item_fijo", objetoId: 33 }, 1, rngFrom([0.999]));
  assert.deepEqual(out, [{ kind: "item", cara: 6, objetoId: 33, cantidad: 1 }]);
}

// 2. sublista: cara 11 (d20) cae en el rango 11–20
{
  const config: RewardConfig = {
    ...base,
    tipo: "sublista",
    tipoDado: "d20",
    sublista: [
      { objetoId: 1, valorMin: 1, valorMax: 10 },
      { objetoId: 2, valorMin: 11, valorMax: 20 },
    ],
  };
  const out = resolveRoll(config, 1, rngFrom([0.5]));
  assert.deepEqual(out, [{ kind: "item", cara: 11, objetoId: 2, cantidad: 1 }]);

  // sin rango que cubra la cara → error de config
  assert.throws(
    () => resolveRoll({ ...config, sublista: [{ objetoId: 1, valorMin: 1, valorMax: 5 }] }, 1, rngFrom([0.5])),
    DiceConfigError,
  );
}

// 3. oro_dados: 3d6 × 5 → caras [1,4,6], suma 11, oro 55
{
  const out = resolveRoll(
    { ...base, tipo: "oro_dados", cantidadDados: 3, multiplicadorOro: 5 },
    1,
    rngFrom([0, 0.5, 0.999]),
  );
  assert.deepEqual(out, [{ kind: "oro", cara: 1, caras: [1, 4, 6], cantidad: 55 }]);
}

// 4. lut: 6 tiradas cubren item con rango, oro con rango, salto a subtabla (oro e item),
//    cara nada y cara con config rota (item sin objeto → nada)
{
  const config: RewardConfig = {
    ...base,
    tipo: "lut",
    tipoDado: "d20",
    lutCaras: [
      { numeroCara: 1, tipo: "nada", oroMin: 0, oroMax: 0, objetoId: null, cantidadMin: 1, cantidadMax: 1, subtablaId: null },
      { numeroCara: 3, tipo: "item", oroMin: 0, oroMax: 0, objetoId: null, cantidadMin: 1, cantidadMax: 1, subtablaId: null },
      { numeroCara: 5, tipo: "item", oroMin: 0, oroMax: 0, objetoId: 42, cantidadMin: 2, cantidadMax: 5, subtablaId: null },
      { numeroCara: 10, tipo: "oro", oroMin: 10, oroMax: 50, objetoId: null, cantidadMin: 1, cantidadMax: 1, subtablaId: null },
      { numeroCara: 20, tipo: "subtabla", oroMin: 0, oroMax: 0, objetoId: null, cantidadMin: 1, cantidadMax: 1, subtablaId: 99 },
    ],
    subtablas: {
      99: {
        nombre: "Tesoro",
        caras: [
          { numeroCara: 1, tipo: "oro", objetoId: null, cantidadMin: 1, cantidadMax: 1, oroMin: 100, oroMax: 200 },
          { numeroCara: 15, tipo: "item", objetoId: 7, cantidadMin: 1, cantidadMax: 3, oroMin: 0, oroMax: 0 },
        ],
      },
    },
  };

  const out = resolveRoll(
    config,
    6,
    rngFrom([
      0.2, 0.5, //   t1: cara 5  → item 42, entre(2,5)=4
      0.45, 0.49, // t2: cara 10 → oro, entre(10,50)=30
      0.95, 0, 0.999, // t3: cara 20 → subtabla, subCara 1 → oro entre(100,200)=200
      0, //          t4: cara 1  → nada
      0.1, //        t5: cara 3  → item sin objeto → nada (no consume rng extra)
      0.95, 0.7, 0.4, // t6: cara 20 → subtabla, subCara 15 → item 7, entre(1,3)=2
    ]),
  );

  assert.deepEqual(out, [
    { kind: "item", cara: 5, objetoId: 42, cantidad: 4 },
    { kind: "oro", cara: 10, cantidad: 30 },
    { kind: "subtabla", cara: 20, subCara: 1, subtablaId: 99, premio: { kind: "oro", cara: 1, cantidad: 200 } },
    { kind: "nada", cara: 1 },
    { kind: "nada", cara: 3 },
    { kind: "subtabla", cara: 20, subCara: 15, subtablaId: 99, premio: { kind: "item", cara: 15, objetoId: 7, cantidad: 2 } },
  ]);
}

// 5. subtabla nunca se tira directamente
assert.throws(
  () => resolveRoll({ ...base, tipo: "subtabla" }, 1, rngFrom([])),
  (e: unknown) => e instanceof DiceConfigError && e.status === 400,
);

console.log("engine.test.ts: OK — 5 tipos + salto LUT→subtabla verificados");
