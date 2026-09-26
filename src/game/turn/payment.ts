import { ActionType } from "../../game_types.ts";
import { actionCost, resources } from "../plan/economy.ts";
import { isPassing } from "../plan/plan.ts";
import { playerOf, type TurnContext } from "./context.ts";

export function pay(context: TurnContext) {
  for (const order of context.orders) {
    if (order.cancelled || isPassing(order.plan)) {
      continue;
    }
    const discounts = resources(context.state, order.player);
    let total = 0;
    for (const type of Object.values(ActionType)) {
      const level = order.plan.actions[type];
      order.costs[type] = level === null ? 0 : actionCost(level, discounts[type]);
      total += order.costs[type];
    }
    playerOf(context, order.player).chao -= total;
    if (total > 0) {
      context.events.push({ type: "Paid", player: order.player, amount: total });
    }
  }
}
