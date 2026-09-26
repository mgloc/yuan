import { ActionType, type ActionLevel, type Coord, type GameState, type Plan, type Player, type PlayerId, type Province } from "../../game_types.ts";
import { emptyPlan, isComplete } from "../plan/plan.ts";
import { provinceAt } from "../tile/coords.ts";
import type { TurnEvent } from "./events.ts";

export interface Order {
  player: PlayerId;
  plan: Plan;
  cancelled: boolean;
  costs: Record<ActionType, number>;
  income: number;
  attackSucceeded: boolean;
}

export interface TurnContext {
  state: GameState;
  orders: Order[];
  events: TurnEvent[];
}

export function createContext(state: GameState, plans: ReadonlyMap<PlayerId, Plan>): TurnContext {
  const draft = structuredClone(state);
  return {
    state: draft,
    orders: draft.players.map((player) => {
      const plan = plans.get(player.id);
      return {
        player: player.id,
        plan: plan !== undefined && isComplete(plan) ? structuredClone(plan) : emptyPlan(),
        cancelled: false,
        costs: { [ActionType.Development]: 0, [ActionType.Fortification]: 0, [ActionType.Militarisation]: 0 },
        income: 0,
        attackSucceeded: false,
      };
    }),
    events: [],
  };
}

export interface ActiveAction {
  order: Order;
  level: ActionLevel;
  target: Coord;
  province: Province;
}

export function activeActions(context: TurnContext, type: ActionType): ActiveAction[] {
  return context.orders.flatMap((order) => {
    const level = order.plan.actions[type];
    const target = order.plan.target;
    const province = target === null ? null : provinceAt(context.state, target);
    if (order.cancelled || level === null || target === null || province === null) {
      return [];
    }
    return [{ order, level, target, province }];
  });
}

export function playerOf(context: TurnContext, id: PlayerId): Player {
  return context.state.players.find((player) => player.id === id)!;
}
