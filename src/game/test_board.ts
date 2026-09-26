import { Building, Clan, TileType, type Board, type Grid, type PlayerId, type Province, type Tile } from "../game_types.ts";

const tile = (type: TileType, name?: string): Tile => ({ type, name });

const free = (overrides: Partial<Province> = {}): Province => ({
  owner: null,
  building: null,
  doubled: false,
  ramparts: 0,
  armies: 0,
  temple: false,
  ...overrides,
});

const owned = (owner: PlayerId, building: Building, overrides: Partial<Province> = {}): Province =>
  free({ owner, building, ...overrides });

export function createTestBoard(): Board {
  const tiles: Grid<Tile> = [
    [tile(TileType.Mine, "Altai"), tile(TileType.Water), tile(TileType.Water), tile(TileType.Forest, "Cao"), tile(TileType.Mountain)],
    [tile(TileType.Mountain), tile(TileType.RiceField, "Ge"), tile(TileType.Water), tile(TileType.Hills, "Huo"), tile(TileType.RiceField, "Ju")],
    [tile(TileType.Water), tile(TileType.Forest, "Li"), tile(TileType.Mountain), tile(TileType.Mine, "Mand"), tile(TileType.Volcano)],
    [tile(TileType.RiceField, "Bao"), tile(TileType.Water), tile(TileType.Hills, "Cheng"), tile(TileType.Forest, "Govi"), tile(TileType.Mine, "Hov")],
  ];

  const provinces: Grid<Province> = [
    [owned(0, Building.City, { doubled: true, armies: 2 }), null, null, free(), null],
    [null, owned(0, Building.Village, { armies: 1 }), null, owned(0, Building.Village, { temple: true }), owned(1, Building.City, { doubled: true, ramparts: 1 })],
    [null, free(), null, owned(1, Building.City, { ramparts: 1, armies: 1 }), null],
    [free(), null, free({ temple: true }), owned(1, Building.Village), owned(1, Building.City, { ramparts: 2, armies: 3 })],
  ];

  return { tiles, provinces };
}

export const TEST_CLANS: Clan[] = [Clan.Suhey, Clan.Xiangi];
