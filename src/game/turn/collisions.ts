import { ActionType } from "../../game_types.ts";
import { coordKey } from "../tile/coords.ts";
import { activeActions, type Order, type TurnContext } from "./context.ts";

export function cancelColonisationCollisions(context: TurnContext) {
  const byTarget = new Map<string, Order[]>();
  for (const { order, target, province } of activeActions(context, ActionType.Development)) {
    if (province.owner === null) {
      const key = coordKey(target);
      byTarget.set(key, [...(byTarget.get(key) ?? []), order]);
    }
  }
  for (const orders of byTarget.values()) {
    if (orders.length < 2) {
      continue;
    }
    orders.forEach((order) => (order.cancelled = true));
    context.events.push({
      type: "ColonisationCollision",
      players: orders.map(({ player }) => player),
      target: orders[0].plan.target!,
    });
  }
}
