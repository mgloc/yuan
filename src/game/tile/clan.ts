import { TileType, type Board, type Coord } from "../../game_types.ts";
import { adjacentProvinces } from "./adjacency.ts";
import { coordKey, tileAt } from "./coords.ts";
import { neighborCoords } from "./neighbors.ts";

function adjacentMountains(board: Board, coord: Coord): Coord[] {
  return neighborCoords(board, coord).filter((neighbor) => tileAt(board, neighbor)?.type === TileType.Mountain);
}

export function isBetweenMountains(board: Board, coord: Coord): boolean {
  return adjacentMountains(board, coord).length >= 2;
}

export function reachableAcrossMountain(board: Board, from: Coord): Coord[] {
  const fromKey = coordKey(from);
  const reachable = new Map<string, Coord>();
  for (const mountain of adjacentMountains(board, from)) {
    for (const province of adjacentProvinces(board, mountain)) {
      const key = coordKey(province);
      if (key !== fromKey) {
        reachable.set(key, province);
      }
    }
  }
  return [...reachable.values()];
}
