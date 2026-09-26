import type { ActionLevel, ActionType, Coord, Plan } from "../game_types.ts";
import { emptyPlan } from "../game/plan/plan.ts";

type DraftListener = (plan: Plan) => void;

export class PlanDraft {
  private plan: Plan = emptyPlan();
  private listeners = new Set<DraftListener>();

  get(): Plan {
    return this.plan;
  }

  set(plan: Plan) {
    this.plan = plan;
    this.listeners.forEach((listener) => listener(plan));
  }

  setTarget(target: Coord | null) {
    this.set({ ...this.plan, target });
  }

  toggleLevel(type: ActionType, level: ActionLevel) {
    this.set({ ...this.plan, actions: { ...this.plan.actions, [type]: this.plan.actions[type] === level ? null : level } });
  }

  reset() {
    this.set(emptyPlan());
  }

  onChange(listener: DraftListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
