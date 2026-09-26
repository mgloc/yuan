import type { GameState, Plan, PlayerId } from "../../game_types.ts";
import { cancelColonisationCollisions } from "./collisions.ts";
import { createContext } from "./context.ts";
import { resolveDevelopment } from "./development.ts";
import type { TurnEvent } from "./events.ts";
import { resolveFortification, resolveFortificationAfterAttack } from "./fortification.ts";
import { collectIncome } from "./income.ts";
import { resolveAttacks, resolveRecruitment } from "./militarisation.ts";
import { pay } from "./payment.ts";
import { upkeep } from "./upkeep.ts";
import { findWinner } from "./victory.ts";

export interface TurnResult {
  state: GameState;
  events: TurnEvent[];
}

export function resolveTurn(state: GameState, plans: ReadonlyMap<PlayerId, Plan>): TurnResult {
  const context = createContext(state, plans);
  context.orders
    .filter((order) => order.plan.target === null)
    .forEach((order) => context.events.push({ type: "Passed", player: order.player }));

  cancelColonisationCollisions(context);
  pay(context);
  resolveDevelopment(context);
  resolveFortification(context);
  resolveRecruitment(context);
  resolveAttacks(context);
  resolveFortificationAfterAttack(context);
  collectIncome(context);
  upkeep(context);

  const winner = findWinner(context.state);
  if (winner !== null) {
    context.state.winner = winner;
    context.state.finished = true;
    context.events.push({ type: "Victory", player: winner });
  } else {
    context.state.turn += 1;
  }
  return { state: context.state, events: context.events };
}
