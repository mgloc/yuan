import * as THREE from "three";
import { type Tile, TileType } from "../../game_types";

export const TILE_RADIUS = 2;
const TILE_HEIGHT = TILE_RADIUS / 10;
const TILE_BEVEL_THINKNESS = TILE_RADIUS / 20;
const TILE_GEOMETRY = new THREE.ExtrudeGeometry(tileShape(TILE_RADIUS), {
  depth: TILE_HEIGHT,
  bevelEnabled: true,
  steps: 1,
  bevelThickness: TILE_BEVEL_THINKNESS,
});
const TILE_COLORS: Record<TileType, number> = {
  [TileType.RiceField]: 0xc8e66a,
  [TileType.Mine]: 0xb0906a,
  [TileType.Forest]: 0x4a8f4a,
  [TileType.Plain]: 0xaaffaa,
  [TileType.Sea]: 0x3366aa,
  [TileType.Mountain]: 0x888888,
};
const TILE_MATERIALS = new Map<TileType, THREE.Material>(
  Object.entries(TILE_COLORS).map(([type, color]) => [
    type as TileType,
    new THREE.MeshBasicMaterial({ color }),
  ]),
);

export class TileView {
  root: THREE.Group;
  constructor(parent: THREE.Object3D, entity: Tile) {
    this.root = new THREE.Group();

    const material = TILE_MATERIALS.get(entity.type)!;
    const mesh = new THREE.Mesh(TILE_GEOMETRY, material);
    this.root.add(mesh);

    parent.add(this.root);
  }

  dispose(parent: THREE.Object3D) {
    parent.remove(this.root);
  }
}

function tileShape(radius: number): THREE.Shape {
  const hexagon = new THREE.Shape();

  for (let i = 0; i < 6; i++) {
    const angle = (i * 2 * Math.PI) / 6;

    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);

    if (i === 0) {
      hexagon.moveTo(x, y);
    } else {
      hexagon.lineTo(x, y);
    }
  }
  return hexagon;
}
