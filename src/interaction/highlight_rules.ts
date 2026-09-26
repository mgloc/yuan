import { isLand, type Board, type Coord } from "../game_types.ts";
import { adjacentProvinces } from "../game/tile/adjacency.ts";
import { coordKey, tileAt } from "../game/tile/coords.ts";
import { connectedProvinces } from "../game/tile/water.ts";
import { Highlight } from "../rendering/highlight.ts";

export function highlightsFor(board: Board, coord: Coord): Map<string, Highlight> {
  const highlights = new Map<string, Highlight>();
  const tile = tileAt(board, coord);
  if (tile === null || !isLand(tile)) {
    highlights.set(coordKey(coord), Highlight.Unplayable);
    return highlights;
  }
  connectedProvinces(board, coord).forEach((province) => highlights.set(coordKey(province), Highlight.Connected));
  adjacentProvinces(board, coord).forEach((province) => highlights.set(coordKey(province), Highlight.Adjacent));
  highlights.set(coordKey(coord), Highlight.Selected);
  return highlights;
}
