import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { TileType, type Coord } from "../../game_types.ts";
import { random } from "./tile_relief.ts";

const APOTHEM_RATIO = Math.cos(Math.PI / 6);
const EDGE_NORMALS = [Math.PI / 6, Math.PI / 2, (5 * Math.PI) / 6].map((angle) => [Math.cos(angle), Math.sin(angle)]);
const EDGE_LIMIT = 0.95 * APOTHEM_RATIO;
const CENTER_CLEARANCE = 0.45;
const ARMY_SLOT = new THREE.Vector2(Math.cos((11 * Math.PI) / 6), Math.sin((11 * Math.PI) / 6)).multiplyScalar(0.5);
const ARMY_CLEARANCE = 0.2;
const LABEL_ANGLES = [Math.PI / 6, (5 * Math.PI) / 6, (3 * Math.PI) / 2];
const LABEL_NEAR = 0.53;
const LABEL_FAR = 0.76;
const LABEL_HALF_WIDTH = 0.44;

const FOREST_ATTEMPTS = 900;
const FOREST_MAX_TREES = 40;
const TREE_MIN_SIZE = 0.15;
const TREE_SIZE_RANGE = 0.09;
const TREE_SPACING = 0.7;
const TREE_TILT = 0.14;
const PINE_SHARE = 0.7;

const TRUNK_COLOR = new THREE.Color(0x6b4a2f);
const PINE_COLOR = new THREE.Color(0x2e5f2c);
const BROADLEAF_COLOR = new THREE.Color(0x5e9132);
const PROP_MATERIAL = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 });

interface TreeKind {
  trunk: THREE.BufferGeometry;
  foliage: THREE.BufferGeometry;
  color: THREE.Color;
  footprint: number;
}

const upright = (geometry: THREE.BufferGeometry) => geometry.rotateX(Math.PI / 2);

const PINE: TreeKind = {
  trunk: part(upright(new THREE.CylinderGeometry(0.05, 0.07, 0.2, 5)), 0.1),
  foliage: mergeGeometries(
    [
      [0.42, 0.45, 0.15],
      [0.32, 0.38, 0.4],
      [0.22, 0.34, 0.62],
    ].map(([radius, height, z]) => part(upright(new THREE.ConeGeometry(radius, height, 7)), z + height / 2)),
  ),
  color: PINE_COLOR,
  footprint: 0.42,
};

const BROADLEAF: TreeKind = {
  trunk: part(upright(new THREE.CylinderGeometry(0.05, 0.07, 0.36, 5)), 0.18),
  foliage: part(new THREE.IcosahedronGeometry(0.36, 0).scale(1, 1, 1.15), 0.62),
  color: BROADLEAF_COLOR,
  footprint: 0.38,
};

type Clearance = (x: number, y: number, reach: number) => boolean;

interface Tree {
  x: number;
  y: number;
  size: number;
  reach: number;
  kind: TreeKind;
}

export function createProps(type: TileType, radius: number, z: number, coord: Coord, labeled: boolean): THREE.Object3D | null {
  switch (type) {
    case TileType.Forest:
      return forest(radius, z, random(coord), clearance(labeled));
    default:
      return null;
  }
}

function forest(radius: number, z: number, next: () => number, free: Clearance): THREE.Object3D | null {
  const trees: Tree[] = [];
  for (let i = 0; i < FOREST_ATTEMPTS && trees.length < FOREST_MAX_TREES; i++) {
    const kind = next() < PINE_SHARE ? PINE : BROADLEAF;
    const size = TREE_MIN_SIZE + next() * TREE_SIZE_RANGE;
    const x = next() * 2 - 1;
    const y = next() * 2 - 1;
    const reach = kind.footprint * size;
    if (!free(x, y, reach) || trees.some((tree) => Math.hypot(tree.x - x, tree.y - y) < (tree.reach + reach) * TREE_SPACING)) {
      continue;
    }
    trees.push({ x, y, size, reach, kind });
  }
  if (trees.length === 0) {
    return null;
  }

  const parts = trees.flatMap((tree) => {
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(tree.x * radius, tree.y * radius, z),
      new THREE.Quaternion().setFromEuler(
        new THREE.Euler((next() - 0.5) * TREE_TILT, (next() - 0.5) * TREE_TILT, next() * Math.PI * 2),
      ),
      new THREE.Vector3().setScalar(tree.size * radius),
    );
    const tint = tree.kind.color.clone().offsetHSL((next() - 0.5) * 0.04, (next() - 0.5) * 0.12, (next() - 0.5) * 0.08);
    return [
      paint(tree.kind.trunk.clone().applyMatrix4(matrix), TRUNK_COLOR),
      paint(tree.kind.foliage.clone().applyMatrix4(matrix), tint),
    ];
  });
  const mesh = new THREE.Mesh(mergeGeometries(parts), PROP_MATERIAL);
  parts.forEach((geometry) => geometry.dispose());
  return mesh;
}

function clearance(labeled: boolean): Clearance {
  return (x, y, reach) => {
    if (Math.max(...EDGE_NORMALS.map(([nx, ny]) => Math.abs(x * nx + y * ny))) + reach > EDGE_LIMIT) {
      return false;
    }
    if (Math.hypot(x, y) - reach < CENTER_CLEARANCE) {
      return false;
    }
    if (Math.hypot(x - ARMY_SLOT.x, y - ARMY_SLOT.y) - reach < ARMY_CLEARANCE) {
      return false;
    }
    return (
      !labeled ||
      LABEL_ANGLES.every((angle) => {
        const radial = x * Math.cos(angle) + y * Math.sin(angle);
        const tangential = -x * Math.sin(angle) + y * Math.cos(angle);
        return radial + reach < LABEL_NEAR || radial - reach > LABEL_FAR || Math.abs(tangential) - reach > LABEL_HALF_WIDTH;
      })
    );
  };
}

function part(geometry: THREE.BufferGeometry, z: number): THREE.BufferGeometry {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  flat.deleteAttribute("uv");
  return flat.translate(0, 0, z);
}

function paint(geometry: THREE.BufferGeometry, color: THREE.Color): THREE.BufferGeometry {
  const count = geometry.getAttribute("position").count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors.set([color.r, color.g, color.b], i * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}
