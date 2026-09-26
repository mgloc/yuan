import type { GameState, Plan, PlayerId } from "../../game_types.ts";
import { resources } from "../plan/economy.ts";
import { isPassing, planCost } from "../plan/plan.ts";
import { provinceAt } from "../tile/coords.ts";

export function planErrors(state: GameState, player: PlayerId, plan: Plan): string[] {
  if (isPassing(plan)) {
    return [];
  }
  if (plan.target === null) {
    return ["Choose a target"];
  }
  const errors: string[] = [];
  if (provinceAt(state, plan.target) === null) {
    errors.push("The target must be a Province");
  }
  const chao = state.players.find(({ id }) => id === player)?.chao ?? 0;
  if (planCost(plan, resources(state, player)) > chao) {
    errors.push("Not enough Chão");
  }
  return errors;
}
