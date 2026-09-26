import * as THREE from "three";
import { TileType, type Coord, type Grid, type PlayerId, type Province, type Tile } from "../../game_types.ts";
import { coordKey } from "../../game/tile/coords.ts";
import type { Highlight } from "../highlight.ts";
import type { PieceFactory } from "../pieces/piece_factory.ts";
import { ProvinceView } from "./province_view.ts";
import { TILE_RADIUS, TileView, WATER_SURFACE_Z, tileTopZ } from "./tile_view.ts";
import { WaterView } from "./water_view.ts";

const SQRT3 = Math.sqrt(3);
const TILE_STEP_X = 1.5 * TILE_RADIUS;
const TILE_STEP_Y = SQRT3 * TILE_RADIUS;

export class TileGridView {
  root: THREE.Group;
  views = new Map<string, TileView>();
  provinceViews = new Map<string, ProvinceView>();
  water: WaterView | null = null;

  constructor(parent: THREE.Object3D, grid: Grid<Tile>, factory: PieceFactory, sunDirection: THREE.Vector3) {
    this.root = new THREE.Group();
    const waterCenters: THREE.Vector3[] = [];

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
        if (tile.type === TileType.Water) {
          waterCenters.push(view.root.position.clone());
        }
      }),
    );

    if (waterCenters.length > 0) {
      this.water = new WaterView(this.root, waterCenters, TILE_RADIUS, WATER_SURFACE_Z, sunDirection);
    }

    const center = new THREE.Box3().setFromObject(this.root).getCenter(new THREE.Vector3());
    this.root.position.sub(center);

    parent.add(this.root);
  }

  tileCenters(): THREE.Vector3[] {
    return [...this.views.values()].map((view) => view.root.getWorldPosition(new THREE.Vector3()));
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

  update(dt: number) {
    this.water?.update(dt);
  }

  setHighlights(highlights: ReadonlyMap<string, Highlight>) {
    this.views.forEach((view, key) => view.setHighlight(highlights.get(key) ?? null));
  }

  dispose(parent: THREE.Object3D) {
    this.views.forEach((view) => view.dispose(this.root));
    this.views.clear();
    this.provinceViews.clear();
    this.water?.dispose(this.root);
    this.water = null;
    parent.remove(this.root);
  }
}

/* Matrix to hex tile placement */
export function hexToWorld(col: number, row: number): THREE.Vector3 {
  const x = col * TILE_STEP_X;
  const y = (row + (col & 1 ? 0.5 : 0)) * TILE_STEP_Y;
  return new THREE.Vector3(x, y, 0);
}
