import {
  ActionType,
  Building,
  Clan,
  TileType,
  type ActionLevel,
  type Coord,
  type GameState,
  type Grid,
  type Plan,
  type Player,
  type PlayerId,
  type Province,
  type Tile,
} from "../../game_types.ts";

const TILES: Record<string, TileType> = {
  R: TileType.RiceField,
  F: TileType.Forest,
  M: TileType.Mine,
  H: TileType.Hills,
  "~": TileType.Water,
  "^": TileType.Mountain,
  V: TileType.Volcano,
};

export interface TestGameOptions {
  provinces?: Record<string, Partial<Province>>;
  players?: Partial<Player>[];
  clanPowers?: boolean;
  turn?: number;
}

export function testGame(layout: string[], options: TestGameOptions = {}): GameState {
  const tiles: Grid<Tile> = layout.map((line) =>
    line.split(" ").map((symbol, col) => (symbol === "_" ? null : { type: TILES[symbol], name: `P${col}` })),
  );
  const provinces: Grid<Province> = tiles.map((row, r) =>
    row.map((tile, c) => {
      if (tile === null || tile.type === TileType.Water || tile.type === TileType.Mountain || tile.type === TileType.Volcano) {
        return null;
      }
      return {
        owner: null,
        building: null,
        doubled: false,
        ramparts: 0,
        armies: 0,
        temple: false,
        ...options.provinces?.[`${c},${r}`],
      };
    }),
  );
  const defaults: Player[] = [
    { id: 0, clan: Clan.Suhey, chao: 10 },
    { id: 1, clan: Clan.Xiangi, chao: 10 },
    { id: 2, clan: Clan.Weyu, chao: 10 },
  ];
  const players = (options.players ?? [{}, {}]).map((overrides, i) => ({ ...defaults[i], ...overrides }));
  return {
    turn: options.turn ?? 1,
    options: { bidding: false, clanPowers: options.clanPowers ?? false },
    tiles,
    provinces,
    players,
    winner: null,
    finished: false,
  };
}

export const village = (owner: PlayerId, overrides: Partial<Province> = {}): Partial<Province> => ({
  owner,
  building: Building.Village,
  ...overrides,
});

export const city = (owner: PlayerId, overrides: Partial<Province> = {}): Partial<Province> => ({
  owner,
  building: Building.City,
  ...overrides,
});

export function plan(target: Coord, actions: Partial<Record<ActionType, ActionLevel>>): Plan {
  return {
    target,
    actions: {
      [ActionType.Development]: actions.Development ?? null,
      [ActionType.Fortification]: actions.Fortification ?? null,
      [ActionType.Militarisation]: actions.Militarisation ?? null,
    },
  };
}

export const at = (col: number, row = 0): Coord => ({ col, row });
