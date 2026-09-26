import {
  CLAN_CHAO_MODIFIER,
  STARTING_CHAO,
  STARTING_CHAO_WITH_BIDDING,
  type Board,
  type Clan,
  type GameOptions,
  type GameState,
} from "../game_types.ts";

export function startingChao(clan: Clan, options: GameOptions): number {
  if (options.bidding) {
    return STARTING_CHAO_WITH_BIDDING;
  }
  return STARTING_CHAO + (options.clanPowers ? CLAN_CHAO_MODIFIER[clan] : 0);
}

export function createGame(board: Board, clans: Clan[], options: GameOptions, chao?: readonly number[]): GameState {
  return {
    turn: 1,
    options,
    ...board,
    players: clans.map((clan, id) => ({ id, clan, chao: chao?.[id] ?? startingChao(clan, options) })),
    winner: null,
    finished: false,
  };
}
