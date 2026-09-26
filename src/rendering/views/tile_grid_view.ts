import * as THREE from "three";
import { TileType, type Coord, type Grid, type PlayerId, type Province, type Tile } from "../../game_types.ts";
import { coordKey } from "../../game/tile/coords.ts";
import type { Highlight } from "../highlight.ts";
import type { PieceFactory } from "../pieces/piece_factory.ts";
import { ProvinceView } from "./province_view.ts";
import { TILE_RADIUS, TileView, WATER_SURFACE_Z, tileTopZ } from "./tile_view.ts";
import { disposeObject } from "../dispose.ts";
import { hexToWorld } from "../hex_layout.ts";
import { WaterView } from "./water_view.ts";


export class TileGridView {
  root: THREE.Group;
  views = new Map<string, TileView>();
  provinceViews = new Map<string, ProvinceView>();
  water: WaterView | null = null;

  constructor(parent: THREE.Object3D, grid: Grid<Tile>, factory: PieceFactory, sunDirection: THREE.Vector3, origin: Coord | null = null) {
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

    if (origin !== null) {
      this.root.position.sub(hexToWorld(origin.col, origin.row));
    } else if (this.views.size > 0) {
      const center = new THREE.Box3().setFromObject(this.root).getCenter(new THREE.Vector3());
      this.root.position.sub(center);
    }

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
    this.water?.dispose(this.root);
    this.water = null;
    this.views.forEach((view) => view.dispose(this.root));
    this.views.clear();
    this.provinceViews.clear();
    disposeObject(this.root);
    parent.remove(this.root);
  }
}
