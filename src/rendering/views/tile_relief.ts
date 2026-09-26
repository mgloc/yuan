import * as THREE from "three";
import { TileType, type Coord } from "../../game_types.ts";

const SUBDIVISIONS = 22;
const SURFACE_OFFSET = 0.002;
const APOTHEM_RATIO = Math.cos(Math.PI / 6);
const EDGE_NORMALS = [Math.PI / 6, Math.PI / 2, (5 * Math.PI) / 6].map((angle) => [Math.cos(angle), Math.sin(angle)]);
const FALLOFF_START = 0.45;
const FALLOFF_END = 0.92;

const ROCK_LIGHT = new THREE.Color(0xd9d9d6);
const SNOW_LINE = 0.3;
const SNOW_FADE = 0.1;
const LAVA_COLOR = 0xff6a1f;
const LAVA_CORE_COLOR = 0xb3260c;
const LAVA_MATERIAL = new THREE.MeshBasicMaterial({ color: LAVA_COLOR });
const LAVA_CORE_MATERIAL = new THREE.MeshBasicMaterial({ color: LAVA_CORE_COLOR });
const LAVA_GEOMETRY = new THREE.CircleGeometry(1, 16);
const RELIEF_MATERIAL = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 });

type Field = (x: number, y: number) => number;
type Colorize = (x: number, y: number, height: number) => THREE.Color;

export function createRelief(
  type: TileType,
  radius: number,
  z: number,
  coord: Coord,
  color: number,
): THREE.Object3D | null {
  switch (type) {
    case TileType.Mountain:
      return mountain(radius, z, random(coord), new THREE.Color(color));
    case TileType.Volcano:
      return volcano(radius, z, random(coord), new THREE.Color(color));
    default:
      return null;
  }
}

interface Massif {
  height: Field;
  ridges: Field;
}

function massif(radius: number, next: () => number, scale: number): Massif {
  const ridges = ridgedNoise(next, 2.2 / radius);
  const bumps = valueNoise(next);
  const domeHeight = (0.22 + next() * 0.1) * radius * scale;
  const ridgeHeight = (0.26 + next() * 0.12) * radius * scale;
  const bumpFrequency = 1.4 / radius;

  const height: Field = (x, y) => {
    const shape = falloff(x, y, radius);
    const dome = domeHeight * (0.7 + 0.3 * bumps(x * bumpFrequency, y * bumpFrequency));
    return Math.max(0, (dome + ridges(x, y) * ridgeHeight) * shape);
  };
  return { height, ridges };
}

function rockColor(base: THREE.Color, ridges: Field, streaks: Field, radius: number): Colorize {
  const snowLine = SNOW_LINE * radius;
  const snowFade = SNOW_FADE * radius;
  return (x, y, h) => {
    const altitude = THREE.MathUtils.smoothstep(h + (streaks(x, y) - 0.5) * snowFade, snowLine, snowLine + snowFade);
    const pattern = THREE.MathUtils.smoothstep(ridges(x, y) + streaks(x, y) * 0.3, 0.45, 0.8);
    return base.clone().lerp(ROCK_LIGHT, altitude * (0.35 + 0.65 * pattern) * 0.9);
  };
}

function mountain(radius: number, z: number, next: () => number, base: THREE.Color): THREE.Object3D {
  const { height, ridges } = massif(radius, next, 1);
  const streaks = scaled(valueNoise(next), 5 / radius);
  return terrain(radius, z, height, rockColor(base, ridges, streaks, radius));
}

function volcano(radius: number, z: number, next: () => number, base: THREE.Color): THREE.Object3D {
  const { height: rock, ridges } = massif(radius, next, 0.75);
  const streaks = scaled(valueNoise(next), 5 / radius);
  const craterX = (next() - 0.5) * 0.3 * radius;
  const craterY = (next() - 0.5) * 0.3 * radius;
  const craterRadius = (0.14 + next() * 0.06) * radius;
  const rimHeight = (0.32 + next() * 0.1) * radius;
  const craterDepth = rimHeight * 0.45;

  const craterDistance = (x: number, y: number) => Math.hypot(x - craterX, y - craterY) / craterRadius;

  const height: Field = (x, y) => {
    const d = craterDistance(x, y);
    const cone = d < 1 ? rimHeight - craterDepth * (1 - d * d) : rimHeight * Math.exp(-((d - 1) ** 2) * 0.35);
    const shaped = cone * falloff(x, y, radius);
    return d < 1 ? shaped : Math.max(rock(x, y), shaped);
  };

  const rockColorize = rockColor(base, ridges, streaks, radius);
  const scorched = base.clone().multiplyScalar(0.6);
  const colorize: Colorize = (x, y, h) => {
    const d = craterDistance(x, y);
    return d < 1.35 ? scorched.clone().lerp(new THREE.Color(LAVA_CORE_COLOR), Math.max(0, 1.35 - d) * 0.5) : rockColorize(x, y, h);
  };

  const group = new THREE.Group();
  group.add(terrain(radius, z, height, colorize));

  const lavaZ = z + SURFACE_OFFSET + rimHeight - craterDepth * 0.55;
  const lava = new THREE.Mesh(LAVA_GEOMETRY, LAVA_MATERIAL);
  lava.position.set(craterX, craterY, lavaZ);
  lava.scale.setScalar(craterRadius * 0.8);
  group.add(lava);

  const core = new THREE.Mesh(LAVA_GEOMETRY, LAVA_CORE_MATERIAL);
  core.position.set(craterX, craterY, lavaZ + 0.002);
  core.scale.setScalar(craterRadius * 0.35);
  group.add(core);
  return group;
}

function terrain(radius: number, z: number, height: Field, colorize: Colorize): THREE.Mesh {
  const positions: number[] = [];
  const colors: number[] = [];
  const corners = Array.from({ length: 6 }, (_, i) => {
    const angle = (i * Math.PI) / 3;
    return new THREE.Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius);
  });

  const push = (point: THREE.Vector2) => {
    const h = height(point.x, point.y);
    positions.push(point.x, point.y, z + SURFACE_OFFSET + h);
    const color = colorize(point.x, point.y, h);
    colors.push(color.r, color.g, color.b);
  };

  for (let side = 0; side < 6; side++) {
    const a = corners[side];
    const b = corners[(side + 1) % 6];
    const at = (i: number, j: number) =>
      new THREE.Vector2((a.x * i + b.x * j) / SUBDIVISIONS, (a.y * i + b.y * j) / SUBDIVISIONS);
    for (let i = 0; i < SUBDIVISIONS; i++) {
      for (let j = 0; j < SUBDIVISIONS - i; j++) {
        push(at(i, j));
        push(at(i + 1, j));
        push(at(i, j + 1));
        if (j < SUBDIVISIONS - i - 1) {
          push(at(i + 1, j));
          push(at(i + 1, j + 1));
          push(at(i, j + 1));
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, RELIEF_MATERIAL);
}

function falloff(x: number, y: number, radius: number): number {
  const distance = Math.max(...EDGE_NORMALS.map(([nx, ny]) => Math.abs(x * nx + y * ny))) / (radius * APOTHEM_RATIO);
  const t = Math.min(1, Math.max(0, (distance - FALLOFF_START) / (FALLOFF_END - FALLOFF_START)));
  return 1 - t * t * (3 - 2 * t);
}

function ridgedNoise(next: () => number, frequency: number): Field {
  const octaves = Array.from({ length: 4 }, (_, i) => ({
    noise: valueNoise(next),
    frequency: frequency * 2 ** i,
    amplitude: 0.5 ** i,
    angle: next() * Math.PI * 2,
  }));
  const total = octaves.reduce((sum, octave) => sum + octave.amplitude, 0);
  return (x, y) =>
    octaves.reduce((sum, octave) => {
      const cos = Math.cos(octave.angle);
      const sin = Math.sin(octave.angle);
      const n = octave.noise((x * cos - y * sin) * octave.frequency, (x * sin + y * cos) * octave.frequency);
      return sum + octave.amplitude * (1 - Math.abs(n * 2 - 1)) ** 2;
    }, 0) / total;
}

function scaled(field: Field, frequency: number): Field {
  return (x, y) => field(x * frequency, y * frequency);
}

function valueNoise(next: () => number): Field {
  const seed = Math.floor(next() * 2 ** 31);
  const offsetX = next() * 100;
  const offsetY = next() * 100;
  const lattice = (ix: number, iy: number) => {
    let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + seed;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  return (x, y) => {
    const px = x + offsetX;
    const py = y + offsetY;
    const ix = Math.floor(px);
    const iy = Math.floor(py);
    const fx = px - ix;
    const fy = py - iy;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const top = lattice(ix, iy) * (1 - sx) + lattice(ix + 1, iy) * sx;
    const bottom = lattice(ix, iy + 1) * (1 - sx) + lattice(ix + 1, iy + 1) * sx;
    return top * (1 - sy) + bottom * sy;
  };
}

function random(coord: Coord): () => number {
  let seed = (Math.imul(coord.col + 1, 73856093) ^ Math.imul(coord.row + 1, 19349663)) >>> 0;
  return () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
