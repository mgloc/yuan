import * as THREE from "three";
import { type Coord, type Tile, TileType } from "../../game_types";
import { HIGHLIGHT_COLORS, type Highlight } from "../highlight.ts";

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
  [TileType.Hills]: 0xaaffaa,
  [TileType.Water]: 0x3366aa,
  [TileType.Mountain]: 0x888888,
  [TileType.Volcano]: 0xb03a2e,
};
const TILE_MATERIALS = new Map<TileType, THREE.Material>(
  Object.entries(TILE_COLORS).map(([type, color]) => [
    type as TileType,
    new THREE.MeshBasicMaterial({ color }),
  ]),
);

const OUTLINE_OUTER_RADIUS = TILE_RADIUS * 0.98;
const OUTLINE_INNER_RADIUS = TILE_RADIUS * 0.82;
const OUTLINE_Z = TILE_HEIGHT + TILE_BEVEL_THINKNESS + 0.01;
const OUTLINE_GEOMETRY = new THREE.ShapeGeometry(outlineShape(OUTLINE_OUTER_RADIUS, OUTLINE_INNER_RADIUS));
const OUTLINE_MATERIALS = new Map<Highlight, THREE.Material>(
  Object.entries(HIGHLIGHT_COLORS).map(([highlight, color]) => [
    highlight as Highlight,
    new THREE.MeshBasicMaterial({ color }),
  ]),
);

export class TileView {
  root: THREE.Group;
  coord: Coord;
  private outline: THREE.Mesh;

  constructor(parent: THREE.Object3D, entity: Tile, coord: Coord) {
    this.root = new THREE.Group();
    this.coord = coord;
    this.root.userData.coord = coord;

    const material = TILE_MATERIALS.get(entity.type)!;
    const mesh = new THREE.Mesh(TILE_GEOMETRY, material);
    this.root.add(mesh);

    this.outline = new THREE.Mesh(OUTLINE_GEOMETRY);
    this.outline.position.z = OUTLINE_Z;
    this.outline.visible = false;
    this.root.add(this.outline);

    parent.add(this.root);
  }

  setHighlight(highlight: Highlight | null) {
    if (highlight === null) {
      this.outline.visible = false;
      return;
    }
    this.outline.material = OUTLINE_MATERIALS.get(highlight)!;
    this.outline.visible = true;
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

function outlineShape(outerRadius: number, innerRadius: number): THREE.Shape {
  const ring = tileShape(outerRadius);
  ring.holes.push(tileShape(innerRadius));
  return ring;
}
