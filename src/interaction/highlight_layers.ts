import { HIGHLIGHT_PRIORITY, type Highlight } from "../rendering/highlight.ts";
import type { TileGridView } from "../rendering/views/tile_grid_view.ts";

export class HighlightLayers {
  private grid: TileGridView;
  private layers = new Map<string, ReadonlyMap<string, Highlight>>();

  constructor(grid: TileGridView) {
    this.grid = grid;
  }

  set(layer: string, highlights: ReadonlyMap<string, Highlight>) {
    this.layers.set(layer, highlights);
    this.apply();
  }

  private apply() {
    const merged = new Map<string, Highlight>();
    for (const highlights of this.layers.values()) {
      highlights.forEach((highlight, key) => {
        const current = merged.get(key);
        if (current === undefined || HIGHLIGHT_PRIORITY.indexOf(highlight) < HIGHLIGHT_PRIORITY.indexOf(current)) {
          merged.set(key, highlight);
        }
      });
    }
    this.grid.setHighlights(merged);
  }
}
