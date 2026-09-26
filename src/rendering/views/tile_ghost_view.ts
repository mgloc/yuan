import * as THREE from "three";
import type { Coord, Tile, TileType } from "../../game_types.ts";
import { hexToWorld, TILE_RADIUS } from "../hex_layout.ts";
import { TILE_COLORS } from "./tile_view.ts";

const GHOST_SCALE = 0.94;
const GHOST_Z = 0.45;
const GHOST_OPACITY = 0.75;
const INVALID_COLOR = 0xd9534f;
const INVALID_OPACITY = 0.6;

export interface GhostCell {
  coord: Coord;
  tile: Tile;
}

export class TileGhostView {
  root = new THREE.Group();
  private geometry = hexGeometry(TILE_RADIUS * GHOST_SCALE);
  private materials = new Map<string, THREE.MeshBasicMaterial>();

  constructor() {
    this.root.visible = false;
    this.root.renderOrder = 2;
  }

  show(cells: GhostCell[], valid: boolean) {
    this.root.clear();
    for (const { coord, tile } of cells) {
      const mesh = new THREE.Mesh(this.geometry, this.material(valid ? tile.type : null));
      mesh.position.copy(hexToWorld(coord.col, coord.row)).setZ(GHOST_Z);
      mesh.renderOrder = 2;
      this.root.add(mesh);
    }
    this.root.visible = cells.length > 0;
  }

  hide() {
    this.root.visible = false;
    this.root.clear();
  }

  dispose() {
    this.root.removeFromParent();
    this.root.clear();
    this.geometry.dispose();
    this.materials.forEach((material) => material.dispose());
  }

  private material(type: TileType | null): THREE.MeshBasicMaterial {
    const key = type ?? "invalid";
    let material = this.materials.get(key);
    if (material === undefined) {
      material = new THREE.MeshBasicMaterial({
        color: type === null ? INVALID_COLOR : TILE_COLORS[type],
        transparent: true,
        opacity: type === null ? INVALID_OPACITY : GHOST_OPACITY,
        depthWrite: false,
      });
      this.materials.set(key, material);
    }
    return material;
  }
}

function hexGeometry(radius: number): THREE.ShapeGeometry {
  const shape = new THREE.Shape(
    Array.from({ length: 6 }, (_, i) => new THREE.Vector2(Math.cos((i * Math.PI) / 3) * radius, Math.sin((i * Math.PI) / 3) * radius)),
  );
  return new THREE.ShapeGeometry(shape);
}
