import {
  Clan,
  FORTIFIED_DEFENSE,
  INDESTRUCTIBLE_ADJACENT_DEFENSE,
  type Board,
  type Coord,
  type GameState,
  type PlayerId,
} from "../../game_types.ts";
import { adjacentProvinces } from "../tile/adjacency.ts";
import { isBetweenMountains, reachableAcrossMountain } from "../tile/clan.ts";
import { coordKey, provinceAt } from "../tile/coords.ts";
import { ownedProvinces } from "../tile/ownership.ts";
import { connectedWithin } from "../tile/water.ts";

const INDESTRUCTIBLE_RAMPARTS = 2;
const XIANGI_MOUNTAIN_DEFENSE = 2;
const LIMITED_WATER_CELLS = 2;

export function clash(strengths: number[]): number[] {
  const remaining = [...strengths];
  while (remaining.filter((strength) => strength > 0).length > 1) {
    const weakest = Math.min(...remaining.filter((strength) => strength > 0));
    remaining.forEach((strength, i) => (remaining[i] = Math.max(0, strength - weakest)));
  }
  return remaining;
}

export function isIndestructible(board: Board, coord: Coord): boolean {
  return provinceAt(board, coord)?.ramparts === INDESTRUCTIBLE_RAMPARTS;
}

export function defenceOf(state: GameState, coord: Coord): number {
  const province = provinceAt(state, coord);
  if (province === null || province.owner === null) {
    return 0;
  }
  let defence = province.ramparts === 1 ? FORTIFIED_DEFENSE : 0;
  const shielded = adjacentProvinces(state, coord).some(
    (neighbor) => provinceAt(state, neighbor)?.owner === province.owner && isIndestructible(state, neighbor),
  );
  if (shielded) {
    defence += INDESTRUCTIBLE_ADJACENT_DEFENSE;
  }
  const clan = state.players.find(({ id }) => id === province.owner)?.clan;
  if (state.options.clanPowers && clan === Clan.Xiangi && province.armies > 0 && isBetweenMountains(state, coord)) {
    defence += XIANGI_MOUNTAIN_DEFENSE;
  }
  return defence;
}

export function armySources(state: GameState, player: PlayerId, target: Coord): Coord[] {
  const clan = state.players.find(({ id }) => id === player)?.clan;
  const powers = state.options.clanPowers;
  const waterLimit = powers && clan === Clan.Xiangi ? LIMITED_WATER_CELLS : Infinity;
  const key = coordKey(target);
  const reaches = (coords: Coord[]) => coords.some((coord) => coordKey(coord) === key);
  return ownedProvinces(state, player).filter((from) => {
    if (provinceAt(state, from)!.armies === 0) {
      return false;
    }
    if (reaches(adjacentProvinces(state, from)) || reaches(connectedWithin(state, from, waterLimit))) {
      return true;
    }
    return powers && clan === Clan.Weyu && reaches(reachableAcrossMountain(state, from));
  });
}
