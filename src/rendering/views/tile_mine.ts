import * as THREE from "three";

export const MINE_PIT = {
  angle: Math.PI / 2,
  distance: 0.47,
  radius: 0.22,
};

const PIT_SEGMENTS = 28;
const PIT_TERRACES = 3;
const RIM_COLOR = new THREE.Color(0xc49a63);
const FLOOR_COLOR = new THREE.Color(0x5e3f25);
const PIT_MATERIAL = new THREE.MeshStandardMaterial({
  vertexColors: true,
  flatShading: true,
  roughness: 1,
  side: THREE.DoubleSide,
});

export function minePitCenter(radius: number): THREE.Vector2 {
  return new THREE.Vector2(
    Math.cos(MINE_PIT.angle) * MINE_PIT.distance * radius,
    Math.sin(MINE_PIT.angle) * MINE_PIT.distance * radius,
  );
}

export function mineHole(radius: number): THREE.Path {
  const center = minePitCenter(radius);
  const hole = new THREE.Path();
  hole.absarc(center.x, center.y, MINE_PIT.radius * radius, 0, Math.PI * 2, true);
  return hole;
}

export function createMinePit(radius: number, topZ: number, depth: number): THREE.Mesh {
  const pitRadius = MINE_PIT.radius * radius;
  const step = depth / PIT_TERRACES;
  const profile: THREE.Vector2[] = [new THREE.Vector2(0, -depth)];
  for (let i = 1; i <= PIT_TERRACES; i++) {
    const outer = (pitRadius * i) / PIT_TERRACES;
    const floor = -depth + (i - 1) * step;
    profile.push(
      new THREE.Vector2(outer * 0.78, floor),
      new THREE.Vector2(outer, floor + step * 0.25),
      new THREE.Vector2(outer * 1.001, floor + step),
    );
  }
  profile.push(new THREE.Vector2(pitRadius * 1.02, 0.001));

  const geometry = new THREE.LatheGeometry(profile, PIT_SEGMENTS).rotateX(Math.PI / 2);
  const positions = geometry.getAttribute("position");
  const colors = new Float32Array(positions.count * 3);
  const color = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    color.copy(FLOOR_COLOR).lerp(RIM_COLOR, 1 + positions.getZ(i) / depth);
    colors.set([color.r, color.g, color.b], i * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const pit = new THREE.Mesh(geometry, PIT_MATERIAL);
  const center = minePitCenter(radius);
  pit.position.set(center.x, center.y, topZ);
  return pit;
}
