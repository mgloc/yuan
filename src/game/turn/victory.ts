import { Clan, LAST_TURN, TileType, templeTarget, type GameState, type Player, type PlayerId } from "../../game_types.ts";
import { controlledTemples } from "../plan/economy.ts";
import { provinceAt, tileAt } from "../tile/coords.ts";
import { ownedProvinces } from "../tile/ownership.ts";
import { piecesOnBoard } from "./pools.ts";

const MU_PROVINCE_FACTOR = 3;

export function findWinner(state: GameState): PlayerId | null {
  const target = templeTarget(state.turn);
  const mu = state.options.clanPowers
    ? state.players.find((player) => player.clan === Clan.Mu && provinceScore(state, player.id) >= MU_PROVINCE_FACTOR * target)
    : undefined;
  const candidates = state.players.filter((player) => controlledTemples(state, player.id) >= target);
  if (mu !== undefined) {
    return mu.id;
  }
  if (candidates.length > 0) {
    return rank(state, candidates)[0].id;
  }
  if (state.turn >= LAST_TURN) {
    const most = Math.max(...state.players.map((player) => controlledTemples(state, player.id)));
    return rank(state, state.players.filter((player) => controlledTemples(state, player.id) === most))[0].id;
  }
  return null;
}

function rank(state: GameState, players: Player[]): Player[] {
  const score = (player: Player) => [mines(state, player.id), player.chao, piecesOnBoard(state, player.id).armies];
  return [...players].sort((a, b) => {
    const [sa, sb] = [score(a), score(b)];
    return sb[0] - sa[0] || sb[1] - sa[1] || sb[2] - sa[2];
  });
}

function mines(state: GameState, player: PlayerId): number {
  return ownedProvinces(state, player).filter((coord) => tileAt(state, coord)?.type === TileType.Mine).length;
}

function provinceScore(state: GameState, player: PlayerId): number {
  return ownedProvinces(state, player).reduce((score, coord) => score + (provinceAt(state, coord)!.temple ? 2 : 1), 0);
}
