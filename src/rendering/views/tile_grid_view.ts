import * as THREE from "three";
import type { Tile } from "../../game_types.ts";
import { TILE_RADIUS, TileView } from "./tile_view.ts";

const SQRT3 = Math.sqrt(3);
const TILE_GAP = 1.05;
const TILE_STEP_X = 1.5 * TILE_RADIUS * TILE_GAP;
const TILE_STEP_Y = SQRT3 * TILE_RADIUS * TILE_GAP;

export class TileGridView {
  root: THREE.Group;
  views: TileView[] = [];

  constructor(parent: THREE.Object3D, grid: (Tile | null)[][]) {
    this.root = new THREE.Group();

    grid.forEach((grid_row, row) =>
      grid_row.forEach((tile, col) => {
        if (tile === null) {
          return;
        }
        const view = new TileView(this.root, tile);
        view.root.position.copy(hexToWorld(col, row));
        this.views.push(view);
      }),
    );

    const center = new THREE.Box3().setFromObject(this.root).getCenter(new THREE.Vector3());
    this.root.position.sub(center);

    parent.add(this.root);
  }

  dispose(parent: THREE.Object3D) {
    this.views.forEach((view) => view.dispose(this.root));
    this.views = [];
    parent.remove(this.root);
  }
}

/* Matrix to hex tile placement */
export function hexToWorld(col: number, row: number): THREE.Vector3 {
  const x = col * TILE_STEP_X;
  const y = (row + (col & 1 ? 0.5 : 0)) * TILE_STEP_Y;
  return new THREE.Vector3(x, y, 0);
}

