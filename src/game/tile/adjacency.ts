import { isLand, type Board, type Coord } from "../../game_types.ts";
import { tileAt } from "./coords.ts";
import { neighborCoords } from "./neighbors.ts";

export function isAdjacent(board: Board, a: Coord, b: Coord): boolean {
  return neighborCoords(board, a).some((neighbor) => neighbor.col === b.col && neighbor.row === b.row);
}

export function adjacentProvinces(board: Board, coord: Coord): Coord[] {
  return neighborCoords(board, coord).filter((neighbor) => {
    const tile = tileAt(board, neighbor);
    return tile !== null && isLand(tile);
  });
}
