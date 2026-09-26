import type { Board, Coord, PlayerId } from "../../game_types.ts";
import { allCoords, provinceAt } from "./coords.ts";

export function isFree(board: Board, coord: Coord): boolean {
  const province = provinceAt(board, coord);
  return province !== null && province.owner === null;
}

export function isControlledBy(board: Board, coord: Coord, player: PlayerId): boolean {
  return provinceAt(board, coord)?.owner === player;
}

export function isEnemyOf(board: Board, coord: Coord, player: PlayerId): boolean {
  const owner = provinceAt(board, coord)?.owner ?? null;
  return owner !== null && owner !== player;
}

export function ownedProvinces(board: Board, player: PlayerId): Coord[] {
  return allCoords(board).filter((coord) => isControlledBy(board, coord, player));
}
