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
  name?: string;
}

export function isLand(tile: Tile): boolean {
  return LAND_TILES.has(tile.type);
}

export type Grid<T> = (T | null)[][];

export interface Coord {
  col: number;
  row: number;
}

export const ActionType = {
  Development: "Development",
  Fortification: "Fortification",
  Militarisation: "Militarisation",
} as const;

export type ActionType = (typeof ActionType)[keyof typeof ActionType];

export type ActionLevel = 1 | 2 | 3;

export const ACTION_LEVELS: readonly ActionLevel[] = [1, 2, 3];

export const ActionKind = {
  Colonisation: "Colonisation",
  Expansion: "Expansion",
  Urbanisation: "Urbanisation",
  Reinforcement: "Reinforcement",
  Recruitment: "Recruitment",
  Attack: "Attack",
} as const;

export type ActionKind = (typeof ActionKind)[keyof typeof ActionKind];

export const ACTION_COST: Record<ActionLevel, number> = {
  1: 0,
  2: 4,
  3: 7,
};

export const RESOURCE_TILE: Record<ActionType, TileType> = {
  [ActionType.Development]: TileType.RiceField,
  [ActionType.Fortification]: TileType.Forest,
  [ActionType.Militarisation]: TileType.Mine,
};

export const Clan = {
  Mu: "Mu",
  Suhey: "Suhey",
  Weyu: "Weyu",
  Xiangi: "Xiangi",
} as const;

export type Clan = (typeof Clan)[keyof typeof Clan];

export const CLAN_CHAO_MODIFIER: Record<Clan, number> = {
  [Clan.Mu]: -2,
  [Clan.Suhey]: -1,
  [Clan.Weyu]: 0,
  [Clan.Xiangi]: 0,
};

export type PlayerId = number;

export interface Player {
  id: PlayerId;
  clan: Clan;
  chao: number;
}

export const Building = {
  Village: "Village",
  City: "City",
} as const;

export type Building = (typeof Building)[keyof typeof Building];

export type RampartCount = 0 | 1 | 2;

export interface Province {
  owner: PlayerId | null;
  building: Building | null;
  doubled: boolean;
  ramparts: RampartCount;
  armies: number;
  temple: boolean;
}

export interface Plan {
  target: Coord | null;
  actions: Record<ActionType, ActionLevel | null>;
}

export interface GameOptions {
  bidding: boolean;
  clanPowers: boolean;
}

export interface GameState {
  turn: number;
  options: GameOptions;
  tiles: Grid<Tile>;
  provinces: Grid<Province>;
  players: Player[];
  winner: PlayerId | null;
  finished: boolean;
}

export type Board = Pick<GameState, "tiles" | "provinces">;

export type PublicPlayer = Pick<Player, "id" | "clan">;

export interface GameInfo extends Board {
  turn: number;
  options: GameOptions;
  players: readonly PublicPlayer[];
  winner: PlayerId | null;
  finished: boolean;
}

export const STARTING_CHAO = 4;
export const STARTING_CHAO_WITH_BIDDING = 6;
export const PASS_INCOME = 6;
export const DEVELOPMENT_II_INCOME = 2;
export const TEMPLE_STEAL_AMOUNT = 2;
export const ARMY_POOL_SIZE = 9;
export const VILLAGE_POOL_SIZE = 18;
export const CITY_POOL_SIZE = 14;
export const MAX_ARMIES_PER_PROVINCE = 3;
export const FORTIFIED_DEFENSE = 2;
export const INDESTRUCTIBLE_ADJACENT_DEFENSE = 1;
export const LAST_TURN = 13;
export const VOLCANO_ERUPTION_TURNS: ReadonlySet<number> = new Set([5, 9, 13]);
export const TEMPLE_TARGET_BY_TURN: readonly number[] = [
  10, 10, 9, 9, 8, 8, 7, 7, 6, 6, 5, 5, 4,
];

export function templeTarget(turn: number): number {
  return TEMPLE_TARGET_BY_TURN[turn - 1];
}
