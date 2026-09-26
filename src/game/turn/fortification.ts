import { ActionKind, ActionType, Building, type ActionLevel, type Coord, type PlayerId, type Province } from "../../game_types.ts";
import { activeActions, playerOf, type ActiveAction, type TurnContext } from "./context.ts";
import { reserve } from "./pools.ts";

export function resolveFortification(context: TurnContext) {
  for (const action of activeActions(context, ActionType.Fortification)) {
    if (followsAttack(action)) {
      action.order.fortificationDeferred = true;
      continue;
    }
    fortify(context, action);
  }
}

export function resolveFortificationAfterAttack(context: TurnContext) {
  for (const action of activeActions(context, ActionType.Fortification)) {
    const { order } = action;
    if (!order.fortificationDeferred) {
      continue;
    }
    if (order.attackSucceeded) {
      fortify(context, action);
      continue;
    }
    const refund = order.costs[ActionType.Fortification];
    if (refund > 0) {
      playerOf(context, order.player).chao += refund;
      context.events.push({ type: "Refunded", player: order.player, amount: refund });
    }
  }
}

function followsAttack({ order, province }: ActiveAction): boolean {
  return order.plan.actions[ActionType.Militarisation] !== null && province.owner !== null && province.owner !== order.player;
}

function fortify(context: TurnContext, action: ActiveAction) {
  const { order, level, target, province } = action;
  if (province.owner !== order.player || province.building === null) {
    context.events.push({ type: "ActionFailed", player: order.player, action: ActionType.Fortification, target, reason: "not your Province" });
    return;
  }
  const kind = province.building === Building.Village ? ActionKind.Urbanisation : ActionKind.Reinforcement;
  const failure = kind === ActionKind.Urbanisation ? urbanise(context, order.player, province, level) : reinforce(context, order.player, province, level);
  if (failure !== null) {
    context.events.push({ type: "ActionFailed", player: order.player, action: ActionType.Fortification, target, reason: failure });
    return;
  }
  context.events.push({ type: "ActionResolved", player: order.player, kind, level, target });
  if (level === 3) {
    addArmy(context, order.player, target, province);
  }
}

function urbanise(context: TurnContext, player: PlayerId, province: Province, level: ActionLevel): string | null {
  if (level === 1) {
    return null;
  }
  if (reserve(context.state, player).cities < 1) {
    return "no City left in reserve";
  }
  province.building = Building.City;
  if (level === 3) {
    province.ramparts = Math.max(province.ramparts, 1) as Province["ramparts"];
  }
  return null;
}

function reinforce(context: TurnContext, player: PlayerId, province: Province, level: ActionLevel): string | null {
  if (level === 3) {
    province.ramparts = 2;
    return null;
  }
  if (level === 1 && province.doubled) {
    return "City is already doubled";
  }
  if (!province.doubled) {
    if (reserve(context.state, player).cities < 1) {
      return "no City left in reserve";
    }
    province.doubled = true;
  }
  if (level === 2) {
    province.ramparts = Math.max(province.ramparts, 1) as Province["ramparts"];
  }
  return null;
}

function addArmy(context: TurnContext, player: PlayerId, coord: Coord, province: Province) {
  if (reserve(context.state, player).armies < 1) {
    context.events.push({ type: "PoolExhausted", player, piece: "Army", missing: 1 });
    return;
  }
  province.armies += 1;
  context.events.push({ type: "ArmiesCreated", player, coord, count: 1 });
}
