import { TileType, type Board, type Coord, type PlayerId } from "../../game_types.ts";
import { adjacentProvinces } from "./adjacency.ts";
import { provinceAt, tileAt } from "./coords.ts";
import { neighborCoords } from "./neighbors.ts";

export function isAdjacentToVolcano(board: Board, coord: Coord): boolean {
  return neighborCoords(board, coord).some((neighbor) => tileAt(board, neighbor)?.type === TileType.Volcano);
}

export function adjacentClans(board: Board, coord: Coord): Set<PlayerId> {
  const clans = new Set<PlayerId>();
  for (const neighbor of adjacentProvinces(board, coord)) {
    const owner = provinceAt(board, neighbor)?.owner ?? null;
    if (owner !== null) {
      clans.add(owner);
    }
  }
  return clans;
}
