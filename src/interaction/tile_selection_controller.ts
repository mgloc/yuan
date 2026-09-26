import type { Board, Coord } from "../game_types.ts";
import type { TilePicker } from "../rendering/picking.ts";
import type { TileGridView } from "../rendering/views/tile_grid_view.ts";
import type { InfoPanel } from "../ui/info_panel.ts";
import { tileInfo } from "../ui/tile_info.ts";
import { highlightsFor } from "./highlight_rules.ts";
import type { Selection } from "./selection.ts";

export class TileSelectionController {
  private board: Board;
  private grid: TileGridView;
  private panel: InfoPanel;
  private selection: Selection;
  private unsubscribers: (() => void)[] = [];

  constructor(board: Board, grid: TileGridView, picker: TilePicker, selection: Selection, panel: InfoPanel) {
    this.board = board;
    this.grid = grid;
    this.panel = panel;
    this.selection = selection;

    this.unsubscribers.push(
      picker.onPick((coord) => selection.toggle(coord)),
      selection.onChange((coord) => this.render(coord)),
    );
    window.addEventListener("keydown", this.onKeyDown);
  }

  dispose() {
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
    this.unsubscribers = [];
    window.removeEventListener("keydown", this.onKeyDown);
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      this.selection.set(null);
    }
  };

  private render(coord: Coord | null) {
    const info = coord === null ? null : tileInfo(this.board, coord);
    if (coord === null || info === null) {
      this.grid.setHighlights(new Map());
      this.panel.hide();
      return;
    }
    this.grid.setHighlights(highlightsFor(this.board, coord));
    this.panel.show(info);
  }
}
