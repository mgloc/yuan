import * as THREE from "three";
import type { CameraRig } from "../rendering/camera_rig.ts";
import type { TileGridView } from "../rendering/views/tile_grid_view.ts";
import type { Selection } from "./selection.ts";

export class CameraFocusController {
  private rig: CameraRig;
  private selection: Selection;
  private unsubscribe: () => void;

  constructor(rig: CameraRig, grid: TileGridView, selection: Selection) {
    this.rig = rig;
    this.selection = selection;
    this.unsubscribe = selection.onChange((coord) => {
      const view = coord === null ? null : grid.viewAt(coord);
      if (view === null) {
        rig.restore();
      } else {
        rig.focus(view.root.getWorldPosition(new THREE.Vector3()));
      }
    });
    window.addEventListener("keydown", this.onKeyDown);
  }

  dispose() {
    this.unsubscribe();
    window.removeEventListener("keydown", this.onKeyDown);
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "h" || event.target instanceof HTMLInputElement) {
      return;
    }
    this.selection.set(null);
    this.rig.reset();
  };
}
