import { PASS_INCOME } from "../../game_types.ts";
import { isPassing } from "../plan/plan.ts";
import { playerOf, type TurnContext } from "./context.ts";

export function collectIncome(context: TurnContext) {
  for (const order of context.orders) {
    const passed = order.cancelled || isPassing(order.plan);
    const amount = order.income + (passed ? PASS_INCOME : 0);
    if (amount === 0) {
      continue;
    }
    playerOf(context, order.player).chao += amount;
    context.events.push({ type: "Income", player: order.player, amount });
  }
}
