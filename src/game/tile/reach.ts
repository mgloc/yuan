import type { Board, Coord } from "../../game_types.ts";
import { adjacentProvinces } from "./adjacency.ts";
import { coordKey } from "./coords.ts";
import { connectedProvinces } from "./water.ts";

export function reachableProvinces(board: Board, from: Coord): Coord[] {
  const reachable = new Map<string, Coord>();
  for (const province of [...adjacentProvinces(board, from), ...connectedProvinces(board, from)]) {
    reachable.set(coordKey(province), province);
  }
  return [...reachable.values()];
}

export function isReachable(board: Board, from: Coord, to: Coord): boolean {
  const target = coordKey(to);
  return reachableProvinces(board, from).some((province) => coordKey(province) === target);
}
