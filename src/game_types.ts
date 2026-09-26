export const TileType = {
  RiceField: "RiceField",
  Mine: "Mine",
  Forest: "Forest",
  Hills: "Hills",
  Water: "Water",
  Mountain: "Mountain",
  Volcano: "Volcano",
} as const;

export type TileType = (typeof TileType)[keyof typeof TileType];

const LAND_TILES: ReadonlySet<TileType> = new Set([
  TileType.RiceField,
  TileType.Mine,
  TileType.Forest,
  TileType.Hills,
]);

export interface Tile {
  type: TileType;
}

export function isLand(tile: Tile): boolean {
  return LAND_TILES.has(tile.type);
}
