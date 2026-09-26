import { ActionType, type GameInfo, type Plan, type Player } from "../../game_types.ts";
import { resources } from "../plan/economy.ts";
import { planBlockers } from "../plan/feasibility.ts";
import { isPassing, planCost } from "../plan/plan.ts";
import { provinceAt } from "../tile/coords.ts";

export function planErrors(game: GameInfo, player: Pick<Player, "id" | "chao">, plan: Plan): string[] {
  if (isPassing(plan)) {
    return [];
  }
  if (plan.target === null) {
    return ["Choose a target"];
  }
  if (provinceAt(game, plan.target) === null) {
    return ["The target must be a Province"];
  }
  const blockers = planBlockers(game, player.id, plan);
  const errors = Object.values(ActionType).flatMap((type) => {
    const level = plan.actions[type];
    const reason = level === null ? null : blockers[type][level];
    return reason === null ? [] : [`${type}: ${reason}`];
  });
  if (planCost(plan, resources(game, player.id)) > player.chao) {
    errors.push("Not enough Chão");
  }
  return errors;
}
