import { ACTION_COST, ActionType, RESOURCE_TILE, type ActionLevel, type Board, type Coord, type PlayerId } from "../../game_types.ts";
import { isAdjacentToVolcano } from "../tile/checks.ts";
import { provinceAt, tileAt } from "../tile/coords.ts";
import { ownedProvinces } from "../tile/ownership.ts";

export type Resources = Record<ActionType, number>;

export function production(board: Board, coord: Coord): number {
  const province = provinceAt(board, coord);
  if (province === null || province.owner === null) {
    return 0;
  }
  return (province.doubled ? 2 : 1) * (isAdjacentToVolcano(board, coord) ? 2 : 1);
}

export function resources(board: Board, player: PlayerId): Resources {
  const counts = Object.fromEntries(Object.values(ActionType).map((type) => [type, 0])) as Resources;
  for (const coord of ownedProvinces(board, player)) {
    const type = tileAt(board, coord)?.type;
    const action = Object.values(ActionType).find((candidate) => RESOURCE_TILE[candidate] === type);
    if (action) {
      counts[action] += production(board, coord);
    }
  }
  return counts;
}

export function controlledTemples(board: Board, player: PlayerId): number {
  return ownedProvinces(board, player).filter((coord) => provinceAt(board, coord)?.temple).length;
}

export function actionCost(level: ActionLevel, discount: number): number {
  return Math.max(0, ACTION_COST[level] - discount);
}
