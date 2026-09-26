import type { GameInfo } from "../game_types.ts";
import type { MatchView, PlayerView } from "../protocol.ts";

export function gameInfo(view: PlayerView, match: MatchView): GameInfo {
  return {
    turn: match.turn,
    options: view.options,
    tiles: match.tiles,
    provinces: match.provinces,
    players: view.seats.map(({ id, clan }) => ({ id, clan: clan! })),
    winner: match.winner,
    finished: match.finished,
  };
}
