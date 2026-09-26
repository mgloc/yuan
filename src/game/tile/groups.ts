import { Building, type Board, type Coord } from "../../game_types.ts";
import { adjacentProvinces } from "./adjacency.ts";
import { coordKey, provinceAt } from "./coords.ts";

export function groupOf(board: Board, coord: Coord): Coord[] {
  const owner = provinceAt(board, coord)?.owner ?? null;
  if (owner === null) {
    return [];
  }
  const visited = new Set([coordKey(coord)]);
  const group = [coord];
  for (let i = 0; i < group.length; i++) {
    for (const neighbor of adjacentProvinces(board, group[i])) {
      const key = coordKey(neighbor);
      if (!visited.has(key) && provinceAt(board, neighbor)?.owner === owner) {
        visited.add(key);
        group.push(neighbor);
      }
    }
  }
  return group;
}

export function groupHasCity(board: Board, group: Coord[]): boolean {
  return group.some((coord) => provinceAt(board, coord)?.building === Building.City);
}
