import type { Board, Coord } from "../../game_types.ts";
import { inBounds } from "./coords.ts";

const EVEN_COL_OFFSETS: readonly [number, number][] = [
  [0, -1],
  [0, 1],
  [-1, -1],
  [-1, 0],
  [1, -1],
  [1, 0],
];

const ODD_COL_OFFSETS: readonly [number, number][] = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [-1, 1],
  [1, 0],
  [1, 1],
];

export function neighborCoords(board: Board, coord: Coord): Coord[] {
  const offsets = coord.col & 1 ? ODD_COL_OFFSETS : EVEN_COL_OFFSETS;
  return offsets
    .map(([dcol, drow]) => ({ col: coord.col + dcol, row: coord.row + drow }))
    .filter((neighbor) => inBounds(board, neighbor) && board.tiles[neighbor.row][neighbor.col] !== null);
}
