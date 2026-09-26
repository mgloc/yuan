import { isLand, TileType, type Board, type Grid, type Province, type Tile } from "../game_types.ts";

const TILES: Record<string, TileType> = {
  R: TileType.RiceField,
  F: TileType.Forest,
  M: TileType.Mine,
  H: TileType.Hills,
  "~": TileType.Water,
  "^": TileType.Mountain,
  V: TileType.Volcano,
};

export function freeProvince(overrides: Partial<Province> = {}): Province {
  return { owner: null, building: null, doubled: false, ramparts: 0, armies: 0, temple: false, ...overrides };
}

export function parseBoard(layout: string[], name: (col: number, row: number) => string | undefined): Board {
  const tiles: Grid<Tile> = layout.map((line, row) =>
    line
      .trim()
      .split(/\s+/)
      .map((symbol, col) => {
        if (symbol === "_") {
          return null;
        }
        const tile: Tile = { type: TILES[symbol] };
        return isLand(tile) ? { ...tile, name: name(col, row) } : tile;
      }),
  );
  const provinces: Grid<Province> = tiles.map((line) => line.map((tile) => (tile !== null && isLand(tile) ? freeProvince() : null)));
  return { tiles, provinces };
}
