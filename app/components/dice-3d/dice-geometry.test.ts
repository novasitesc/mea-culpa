// Check de la geometría de dados. Ejecutar: npx tsx app/components/dice-3d/dice-geometry.test.ts
// (buildDie ya lanza si el clustering no produce exactamente N caras —
//  eso valida de paso la planaridad de las cometas del d10)
import assert from "node:assert/strict";
import * as THREE from "three";
import { getDie, faceRestQuaternion, DIE_RADIUS } from "./dice-geometry";
import { DICE_TYPES, diceMax } from "../../../lib/types/dados";

const UP = new THREE.Vector3(0, 1, 0);

for (const type of DICE_TYPES) {
  const die = getDie(type);
  assert.equal(die.faces.length, diceMax(type), `${type}: caras`);
  assert.ok(die.restHeight > 0.2 && die.restHeight < DIE_RADIUS * 1.3, `${type}: restHeight ${die.restHeight}`);

  for (const face of die.faces) {
    // la cara ganadora debe quedar mirando a la dirección de lectura
    const q = faceRestQuaternion(type, face.value);
    const n = face.normal.clone().applyQuaternion(q);
    if (type === "d4") {
      assert.ok(n.z > 0.9, `${type} cara ${face.value}: normal hacia cámara (z=${n.z.toFixed(3)})`);
    } else {
      assert.ok(n.dot(UP) > 0.999, `${type} cara ${face.value}: normal arriba (dot=${n.dot(UP).toFixed(4)})`);
    }
    // y el número derecho: up local proyecta hacia -z (arriba en pantalla)
    if (type !== "d4") {
      const u = face.up.clone().applyQuaternion(q);
      assert.ok(u.z < -0.999, `${type} cara ${face.value}: número derecho (u.z=${u.z.toFixed(4)})`);
    }
  }
}

console.log("dice-geometry.test.ts: OK — d4–d20 con caras, reposo y orientación verificados");
