import { ARMY_POOL_SIZE, Building, CITY_POOL_SIZE, VILLAGE_POOL_SIZE, type Board, type PlayerId } from "../../game_types.ts";
import { provinceAt } from "../tile/coords.ts";
import { ownedProvinces } from "../tile/ownership.ts";

export interface Pieces {
  villages: number;
  cities: number;
  armies: number;
}

export function piecesOnBoard(board: Board, player: PlayerId): Pieces {
  const pieces: Pieces = { villages: 0, cities: 0, armies: 0 };
  for (const coord of ownedProvinces(board, player)) {
    const province = provinceAt(board, coord)!;
    if (province.building === Building.Village) {
      pieces.villages += 1;
    } else if (province.building === Building.City) {
      pieces.cities += province.doubled ? 2 : 1;
    }
    pieces.armies += province.armies;
  }
  return pieces;
}

export function reserve(board: Board, player: PlayerId): Pieces {
  const used = piecesOnBoard(board, player);
  return {
    villages: VILLAGE_POOL_SIZE - used.villages,
    cities: CITY_POOL_SIZE - used.cities,
    armies: ARMY_POOL_SIZE - used.armies,
  };
}
