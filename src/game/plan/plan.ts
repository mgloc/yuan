import { ActionType, type Coord, type Plan } from "../../game_types.ts";
import { actionCost, type Resources } from "./economy.ts";

export function emptyPlan(): Plan {
  return {
    target: null,
    actions: {
      [ActionType.Development]: null,
      [ActionType.Fortification]: null,
      [ActionType.Militarisation]: null,
    },
  };
}

export function isPassing(plan: Plan): boolean {
  return Object.values(plan.actions).every((level) => level === null);
}

export function isComplete(plan: Plan): plan is Plan & { target: Coord } {
  return plan.target !== null && !isPassing(plan);
}

export function planCost(plan: Plan, resources: Resources): number {
  return Object.values(ActionType).reduce((total, type) => {
    const level = plan.actions[type];
    return total + (level === null ? 0 : actionCost(level, resources[type]));
  }, 0);
}
