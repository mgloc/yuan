import { ActionKind, ActionType, Building, type ActionLevel } from "../../game_types.ts";
import { activeActions, type TurnContext } from "./context.ts";
import { reserve } from "./pools.ts";

const RECRUITS: Record<ActionLevel, number> = { 1: 0, 2: 1, 3: 3 };

export function resolveRecruitment(context: TurnContext) {
  for (const { order, level, target, province } of activeActions(context, ActionType.Militarisation)) {
    if (province.owner !== order.player) {
      continue;
    }
    if (province.building !== Building.City) {
      context.events.push({ type: "ActionFailed", player: order.player, action: ActionType.Militarisation, target, reason: "Recruitment needs a City" });
      continue;
    }
    const available = Math.max(0, reserve(context.state, order.player).armies);
    const count = Math.min(RECRUITS[level], available);
    province.armies += count;
    context.events.push({ type: "ActionResolved", player: order.player, kind: ActionKind.Recruitment, level, target });
    if (count > 0) {
      context.events.push({ type: "ArmiesCreated", player: order.player, coord: target, count });
    }
    if (count < RECRUITS[level]) {
      context.events.push({ type: "PoolExhausted", player: order.player, piece: "Army", missing: RECRUITS[level] - count });
    }
  }
}

export function resolveAttacks(context: TurnContext) {
  for (const { order, target, province } of activeActions(context, ActionType.Militarisation)) {
    if (province.owner === order.player) {
      continue;
    }
    if (province.owner === null) {
      context.events.push({ type: "ActionFailed", player: order.player, action: ActionType.Militarisation, target, reason: "free Province" });
      continue;
    }
    context.events.push({ type: "AttackPending", player: order.player, target });
  }
}
