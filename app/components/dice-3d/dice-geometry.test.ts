// Check de la geometría de dados. Ejecutar: npx tsx app/components/dice-3d/dice-geometry.test.ts
// (buildDie ya lanza si el clustering no produce exactamente N caras —
//  eso valida de paso la planaridad de las cometas del d10)
import assert from "node:assert/strict";
import * as THREE from "three";
import { getDie, faceRestQuaternion, DIE_RADIUS } from "./dice-geometry";
import { CAMERA_TARGET, cameraPosFor } from "./dice-scene";
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

// ── La cara ganadora tiene que ser la que MÁS de frente se ve ────────────────
// El fallo que motivó esto: con la cámara a 45° la cara ganadora quedaba arriba
// (correcto), pero en un d20 la vecina inclinada 41.8° hacia la cámara se veía
// casi de frente y se leía el número equivocado. No basta con que gane: tiene
// que ganar por margen. Si alguien vuelve a bajar la cámara, esto revienta.
const TARGET = new THREE.Vector3(...CAMERA_TARGET);
const MARGEN_MIN = 0.12; // diferencia mínima de "frontalidad" (coseno) con la 2ª

for (const type of DICE_TYPES) {
  const die = getDie(type);
  const CAM = new THREE.Vector3(...cameraPosFor(type));

  for (const face of die.faces) {
    const q = faceRestQuaternion(type, face.value);
    // El dado reposa sobre la mesa en el centro de la zona de aterrizaje.
    const centro = new THREE.Vector3(0, die.restHeight, 0);
    const aCamara = CAM.clone().sub(centro).normalize();

    // Frontalidad de cada cara = cuánto apunta su normal hacia la cámara.
    const frontalidad = die.faces.map((f) =>
      f.normal.clone().applyQuaternion(q).dot(aCamara),
    );
    const ganadora = frontalidad[face.value - 1];
    const rivalMax = Math.max(
      ...frontalidad.filter((_, i) => i !== face.value - 1),
    );

    assert.ok(
      ganadora > rivalMax,
      `${type} cara ${face.value}: una cara rival se ve más de frente ` +
        `(ganadora ${ganadora.toFixed(3)} vs rival ${rivalMax.toFixed(3)})`,
    );
    assert.ok(
      ganadora - rivalMax >= MARGEN_MIN,
      `${type} cara ${face.value}: margen insuficiente sobre la rival ` +
        `(${(ganadora - rivalMax).toFixed(3)} < ${MARGEN_MIN}) — la lectura queda ambigua`,
    );
  }

  // Contorno de la cara ganadora: un polígono por cara, contenido en su plano.
  assert.equal(die.outlines.length, diceMax(type), `${type}: contornos`);
  die.outlines.forEach((outline, i) => {
    const pts = outline.getAttribute("position") as THREE.BufferAttribute;
    assert.ok(pts.count >= 3, `${type} cara ${i + 1}: contorno con ${pts.count} puntos`);

    // Todos los vértices a la misma altura sobre el plano de la cara: si el
    // anillo no fuese plano, atravesaría el dado y se vería por dentro.
    const n = die.faces[i].normal;
    const alturas = Array.from({ length: pts.count }, (_, k) =>
      new THREE.Vector3().fromBufferAttribute(pts, k).dot(n),
    );
    const spread = Math.max(...alturas) - Math.min(...alturas);
    assert.ok(spread < 1e-4, `${type} cara ${i + 1}: contorno no plano (${spread})`);
    // Y por fuera de la cara, para que no desaparezca dentro del sólido.
    assert.ok(alturas[0] > die.restHeight, `${type} cara ${i + 1}: contorno hundido`);
  });
}

// Los poliedros con cara arriba se miran casi a plomo; el d4 no puede.
for (const type of DICE_TYPES) {
  const cam = new THREE.Vector3(...cameraPosFor(type));
  const elevacion =
    (Math.atan2(cam.y - TARGET.y, Math.hypot(cam.x - TARGET.x, cam.z - TARGET.z)) * 180) / Math.PI;
  assert.ok(
    type === "d4" ? elevacion < 55 : elevacion > 70,
    `${type}: elevación de cámara inesperada (${elevacion.toFixed(1)}°)`,
  );
}

console.log("dice-geometry.test.ts: OK — caras, reposo, orientación y lectura sin ambigüedad");
