import type { ActionLevel, ActionType, Coord, Plan, PlayerId } from "../game_types.ts";
import { emptyPlan } from "../game/plan/plan.ts";

type PlansListener = (player: PlayerId, plan: Plan) => void;

export class Plans {
  private plans = new Map<PlayerId, Plan>();
  private submitted = new Set<PlayerId>();
  private listeners = new Set<PlansListener>();

  get(player: PlayerId): Plan {
    return this.plans.get(player) ?? emptyPlan();
  }

  all(): ReadonlyMap<PlayerId, Plan> {
    return this.plans;
  }

  isSubmitted(player: PlayerId): boolean {
    return this.submitted.has(player);
  }

  setTarget(player: PlayerId, target: Coord | null) {
    this.update(player, (plan) => ({ ...plan, target }));
  }

  toggleLevel(player: PlayerId, type: ActionType, level: ActionLevel) {
    this.update(player, (plan) => ({
      ...plan,
      actions: { ...plan.actions, [type]: plan.actions[type] === level ? null : level },
    }));
  }

  pass(player: PlayerId) {
    this.update(player, () => emptyPlan());
    this.submit(player);
  }

  submit(player: PlayerId) {
    this.submitted.add(player);
    this.notify(player);
  }

  edit(player: PlayerId) {
    this.submitted.delete(player);
    this.notify(player);
  }

  clear() {
    const players = new Set([...this.plans.keys(), ...this.submitted]);
    this.plans.clear();
    this.submitted.clear();
    players.forEach((player) => this.notify(player));
  }

  onChange(listener: PlansListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private update(player: PlayerId, change: (plan: Plan) => Plan) {
    if (this.submitted.has(player)) {
      return;
    }
    this.plans.set(player, change(this.get(player)));
    this.notify(player);
  }

  private notify(player: PlayerId) {
    const plan = this.get(player);
    this.listeners.forEach((listener) => listener(player, plan));
  }
}
