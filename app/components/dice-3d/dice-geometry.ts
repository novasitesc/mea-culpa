// Geometrías reales de dados d4–d20: caras planas agrupadas (un material por cara),
// UVs proyectadas sobre el plano de cada cara y cuaternión de reposo que deja la
// cara ganadora legible. Puro three, sin React.
import * as THREE from "three";
import { diceMax } from "@/lib/types/dados";
import type { DiceType } from "@/lib/types/dados";

export const DIE_RADIUS = 0.85;

export type DieFace = { value: number; normal: THREE.Vector3; up: THREE.Vector3 };

export type DieData = {
  geometry: THREE.BufferGeometry;
  edges: THREE.EdgesGeometry;
  faces: DieFace[];
  /** Distancia del centro al plano de una cara: altura de reposo sobre el suelo. */
  restHeight: number;
};

const UP = new THREE.Vector3(0, 1, 0);
// Un d4 no tiene caras opuestas paralelas: la cara legible queda inclinada hacia la
// cámara exactamente 19.47° (así otra cara apoya plana en el suelo).
const D4_DIR = new THREE.Vector3(0, Math.sin(0.3398), Math.cos(0.3398)).normalize();

function baseGeometry(type: DiceType): THREE.BufferGeometry {
  const r = DIE_RADIUS;
  switch (type) {
    case "d4": return new THREE.TetrahedronGeometry(r * 1.1);
    case "d6": return new THREE.BoxGeometry(r * 1.2, r * 1.2, r * 1.2);
    case "d8": return new THREE.OctahedronGeometry(r);
    case "d10": return trapezohedronGeometry(r * 1.05);
    case "d12": return new THREE.DodecahedronGeometry(r);
    case "d20": return new THREE.IcosahedronGeometry(r);
  }
}

/** Antiprisma apuntado (trapezoedro pentagonal): el d10 real, 10 caras cometa. */
function trapezohedronGeometry(radius: number): THREE.BufferGeometry {
  // c hace las cometas planas: c = (1 - cos36°) / (1 + cos36°) con ápices en y = ±1
  const c = (1 - Math.cos(Math.PI / 5)) / (1 + Math.cos(Math.PI / 5));
  const ring = Array.from({ length: 10 }, (_, k) => {
    const th = (k * Math.PI) / 5;
    return new THREE.Vector3(Math.cos(th), k % 2 === 0 ? -c : c, Math.sin(th));
  });
  const top = new THREE.Vector3(0, 1, 0);
  const bottom = new THREE.Vector3(0, -1, 0);

  const positions: number[] = [];
  const pushTri = (p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3) => {
    const n = new THREE.Vector3().subVectors(p2, p1).cross(new THREE.Vector3().subVectors(p3, p1));
    const center = new THREE.Vector3().addVectors(p1, p2).add(p3);
    const [a, b] = n.dot(center) >= 0 ? [p2, p3] : [p3, p2]; // normal hacia afuera
    positions.push(p1.x, p1.y, p1.z, a.x, a.y, a.z, b.x, b.y, b.z);
  };

  for (let k = 0; k < 10; k++) {
    const apex = k % 2 === 0 ? top : bottom; // cometas pares tocan el ápice superior
    const far = ring[k];
    const w1 = ring[(k + 9) % 10];
    const w2 = ring[(k + 1) % 10];
    pushTri(apex, w1, far);
    pushTri(apex, far, w2);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions.map((v) => v * radius), 3),
  );
  return geo;
}

function buildDie(type: DiceType): DieData {
  let geo = baseGeometry(type);
  if (geo.index) geo = geo.toNonIndexed();

  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const triCount = pos.count / 3;
  const v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();

  // Agrupar triángulos coplanarios (misma normal) en caras
  type Cluster = { normal: THREE.Vector3; tris: number[] };
  const clusters: Cluster[] = [];
  for (let t = 0; t < triCount; t++) {
    for (let i = 0; i < 3; i++) v[i].fromBufferAttribute(pos, t * 3 + i);
    const n = e1.subVectors(v[1], v[0]).cross(e2.subVectors(v[2], v[0])).clone().normalize();
    const cluster = clusters.find((cl) => cl.normal.dot(n) > 0.999);
    if (cluster) cluster.tris.push(t);
    else clusters.push({ normal: n, tris: [t] });
  }
  if (clusters.length !== diceMax(type)) {
    throw new Error(`dice-geometry: ${type} produjo ${clusters.length} caras`);
  }

  // Reordenar triángulos por cara y proyectar UVs sobre el plano de cada cara
  const newPos = new Float32Array(pos.count * 3);
  const newUv = new Float32Array(pos.count * 2);
  const out = new THREE.BufferGeometry();
  const faces: DieFace[] = [];
  let write = 0;

  clusters.forEach((cluster, faceIdx) => {
    const verts: THREE.Vector3[] = [];
    for (const t of cluster.tris) {
      for (let i = 0; i < 3; i++) verts.push(new THREE.Vector3().fromBufferAttribute(pos, t * 3 + i));
    }
    const center = verts.reduce((acc, p) => acc.add(p), new THREE.Vector3()).divideScalar(verts.length);

    const n = cluster.normal;
    const ref = Math.abs(n.y) < 0.99 ? UP : new THREE.Vector3(0, 0, 1);
    const up = ref.clone().sub(n.clone().multiplyScalar(ref.dot(n))).normalize();
    const uAxis = new THREE.Vector3().crossVectors(up, n).normalize();

    let extent = 0;
    const d = new THREE.Vector3();
    for (const p of verts) {
      d.subVectors(p, center);
      extent = Math.max(extent, Math.abs(d.dot(uAxis)), Math.abs(d.dot(up)));
    }
    const scale = 0.5 / (extent * 1.06);

    const start = write;
    for (const p of verts) {
      newPos.set([p.x, p.y, p.z], write * 3);
      d.subVectors(p, center);
      newUv.set([0.5 + d.dot(uAxis) * scale, 0.5 + d.dot(up) * scale], write * 2);
      write++;
    }
    out.addGroup(start, verts.length, faceIdx);
    faces.push({ value: faceIdx + 1, normal: n.clone(), up });
  });

  out.setAttribute("position", new THREE.BufferAttribute(newPos, 3));
  out.setAttribute("uv", new THREE.BufferAttribute(newUv, 2));
  out.computeVertexNormals();

  const f0Center = new THREE.Vector3();
  const firstGroupVerts = clusters[0].tris.length * 3;
  for (let i = 0; i < firstGroupVerts; i++) {
    f0Center.add(new THREE.Vector3().fromBufferAttribute(out.getAttribute("position") as THREE.BufferAttribute, i));
  }
  f0Center.divideScalar(firstGroupVerts);

  return {
    geometry: out,
    edges: new THREE.EdgesGeometry(out, 10),
    faces,
    restHeight: Math.abs(f0Center.dot(faces[0].normal)),
  };
}

const dieCache = new Map<DiceType, DieData>();
export function getDie(type: DiceType): DieData {
  let data = dieCache.get(type);
  if (!data) {
    data = buildDie(type);
    dieCache.set(type, data);
  }
  return data;
}

/** Cuaternión de reposo: la cara `value` queda mirando arriba (d4: hacia la cámara),
 *  con el número derecho en pantalla. La física nunca decide el número. */
export function faceRestQuaternion(type: DiceType, value: number): THREE.Quaternion {
  const { faces } = getDie(type);
  const face = faces[(value - 1) % faces.length];

  const dir = type === "d4" ? D4_DIR : UP;
  const textUp =
    type === "d4"
      ? UP.clone().sub(dir.clone().multiplyScalar(UP.dot(dir))).normalize()
      : new THREE.Vector3(0, 0, -1);

  const xL = new THREE.Vector3().crossVectors(face.up, face.normal);
  const mLocal = new THREE.Matrix4().makeBasis(xL, face.up, face.normal);
  const xW = new THREE.Vector3().crossVectors(textUp, dir);
  const mWorld = new THREE.Matrix4().makeBasis(xW, textUp, dir);

  return new THREE.Quaternion().setFromRotationMatrix(
    mWorld.multiply(mLocal.transpose()),
  );
}
