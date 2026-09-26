import type { Board, Coord, Province, Tile } from "../../game_types.ts";

export function coordKey(coord: Coord): string {
  return `${coord.col},${coord.row}`;
}

export function inBounds(board: Board, coord: Coord): boolean {
  return (
    coord.row >= 0 &&
    coord.row < board.tiles.length &&
    coord.col >= 0 &&
    coord.col < board.tiles[coord.row].length
  );
}

export function tileAt(board: Board, coord: Coord): Tile | null {
  return inBounds(board, coord) ? board.tiles[coord.row][coord.col] : null;
}

export function provinceAt(board: Board, coord: Coord): Province | null {
  return inBounds(board, coord) ? (board.provinces[coord.row]?.[coord.col] ?? null) : null;
}

export function allCoords(board: Board): Coord[] {
  return board.tiles.flatMap((tiles_row, row) => tiles_row.map((_, col) => ({ col, row })));
}
