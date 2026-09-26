import * as THREE from "three";
import type { Coord, Grid, PlayerId, Province, Tile } from "../../game_types.ts";
import { coordKey } from "../../game/tile/coords.ts";
import type { Highlight } from "../highlight.ts";
import type { PieceFactory } from "../pieces/piece_factory.ts";
import { ProvinceView } from "./province_view.ts";
import { TILE_RADIUS, TileView, tileTopZ } from "./tile_view.ts";

const SQRT3 = Math.sqrt(3);
const TILE_GAP = 1.05;
const TILE_STEP_X = 1.5 * TILE_RADIUS * TILE_GAP;
const TILE_STEP_Y = SQRT3 * TILE_RADIUS * TILE_GAP;

export class TileGridView {
  root: THREE.Group;
  views = new Map<string, TileView>();
  provinceViews = new Map<string, ProvinceView>();

  constructor(parent: THREE.Object3D, grid: Grid<Tile>, factory: PieceFactory) {
    this.root = new THREE.Group();

    grid.forEach((grid_row, row) =>
      grid_row.forEach((tile, col) => {
        if (tile === null) {
          return;
        }
        const coord = { col, row };
        const view = new TileView(this.root, tile, coord);
        view.root.position.copy(hexToWorld(col, row));
        this.views.set(coordKey(coord), view);
        this.provinceViews.set(coordKey(coord), new ProvinceView(view.root, factory, tileTopZ(tile.type)));
      }),
    );

    const center = new THREE.Box3().setFromObject(this.root).getCenter(new THREE.Vector3());
    this.root.position.sub(center);

    parent.add(this.root);
  }

  viewAt(coord: Coord): TileView | null {
    return this.views.get(coordKey(coord)) ?? null;
  }

  updateProvinces(provinces: Grid<Province>, ownerColor: (player: PlayerId) => number) {
    this.provinceViews.forEach((view, key) => {
      const [col, row] = key.split(",").map(Number);
      const province = provinces[row]?.[col] ?? null;
      view.update(province, province?.owner == null ? null : ownerColor(province.owner));
    });
  }

  setHighlights(highlights: ReadonlyMap<string, Highlight>) {
    this.views.forEach((view, key) => view.setHighlight(highlights.get(key) ?? null));
  }

  dispose(parent: THREE.Object3D) {
    this.views.forEach((view) => view.dispose(this.root));
    this.views.clear();
    this.provinceViews.clear();
    parent.remove(this.root);
  }
}

/* Matrix to hex tile placement */
export function hexToWorld(col: number, row: number): THREE.Vector3 {
  const x = col * TILE_STEP_X;
  const y = (row + (col & 1 ? 0.5 : 0)) * TILE_STEP_Y;
  return new THREE.Vector3(x, y, 0);
}
