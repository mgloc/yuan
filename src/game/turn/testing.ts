import {
  ActionType,
  Building,
  Clan,
  type ActionLevel,
  type Coord,
  type GameState,
  type Plan,
  type Player,
  type PlayerId,
  type Province,
} from "../../game_types.ts";
import { freeProvince, parseBoard } from "../board_layout.ts";

export interface TestGameOptions {
  provinces?: Record<string, Partial<Province>>;
  players?: Partial<Player>[];
  clanPowers?: boolean;
  turn?: number;
}

export function testGame(layout: string[], options: TestGameOptions = {}): GameState {
  const { tiles, provinces } = parseBoard(layout, (col) => `P${col}`);
  Object.entries(options.provinces ?? {}).forEach(([key, overrides]) => {
    const [col, row] = key.split(",").map(Number);
    provinces[row][col] = freeProvince(overrides);
  });
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
