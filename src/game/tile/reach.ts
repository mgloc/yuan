import { Clan, type Board, type Coord, type GameInfo, type PlayerId } from "../../game_types.ts";
import { adjacentProvinces } from "./adjacency.ts";
import { coordKey } from "./coords.ts";
import { ownedProvinces } from "./ownership.ts";
import { connectedProvinces, connectedWithin } from "./water.ts";

const XIANGI_WATER_LIMIT = 2;

export function reachableProvinces(board: Board, from: Coord): Coord[] {
  const reachable = new Map<string, Coord>();
  for (const province of [...adjacentProvinces(board, from), ...connectedProvinces(board, from)]) {
    reachable.set(coordKey(province), province);
  }
  return [...reachable.values()];
}

export function isReachable(board: Board, from: Coord, to: Coord): boolean {
  const target = coordKey(to);
  return reachableProvinces(board, from).some((province) => coordKey(province) === target);
}

export function canColonise(game: GameInfo, player: PlayerId, target: Coord): boolean {
  const clan = game.players.find(({ id }) => id === player)?.clan;
  const waterLimit = game.options.clanPowers && clan === Clan.Xiangi ? XIANGI_WATER_LIMIT : Infinity;
  const key = coordKey(target);
  return ownedProvinces(game, player).some((from) =>
    [...adjacentProvinces(game, from), ...connectedWithin(game, from, waterLimit)].some((coord) => coordKey(coord) === key),
  );
}
