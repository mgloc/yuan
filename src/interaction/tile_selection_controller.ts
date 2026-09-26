import type { Coord, GameInfo } from "../game_types.ts";
import type { TilePicker } from "../rendering/picking.ts";
import type { InfoPanel } from "../ui/info_panel.ts";
import { tileInfo } from "../ui/tile_info.ts";
import type { HighlightLayers } from "./highlight_layers.ts";
import { highlightsFor } from "./highlight_rules.ts";
import type { Observable } from "./observable.ts";
import type { Selection } from "./selection.ts";

const SELECTION_LAYER = "selection";

export class TileSelectionController {
  private game: Observable<GameInfo>;
  private highlights: HighlightLayers;
  private panel: InfoPanel;
  private selection: Selection;
  private unsubscribers: (() => void)[] = [];

  constructor(game: Observable<GameInfo>, highlights: HighlightLayers, picker: TilePicker, selection: Selection, panel: InfoPanel) {
    this.game = game;
    this.highlights = highlights;
    this.panel = panel;
    this.selection = selection;

    this.unsubscribers.push(
      picker.onPick((coord) => selection.toggle(coord)),
      selection.onChange((coord) => this.render(coord)),
      game.onChange(() => this.render(selection.get())),
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
    const info = coord === null ? null : tileInfo(this.game.get(), coord);
    if (coord === null || info === null) {
      this.highlights.set(SELECTION_LAYER, new Map());
      this.panel.hide();
      return;
    }
    this.highlights.set(SELECTION_LAYER, highlightsFor(this.game.get(), coord));
    this.panel.show(info);
  }
}
