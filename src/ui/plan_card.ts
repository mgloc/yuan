import { ACTION_LEVELS, type ActionLevel, type ActionType } from "../game_types.ts";
import { card, element } from "./dom.ts";
import type { PlanRow, PlayerBoardData } from "./player_board_data.ts";

const ROMAN: Record<ActionLevel, string> = { 1: "I", 2: "II", 3: "III" };

export interface PlanCardHandlers {
  onLevel: (type: ActionType, level: ActionLevel) => void;
  onPass: () => void;
  onSubmit: () => void;
  onEdit: () => void;
}

export class PlanCard {
  root: HTMLElement;
  private handlers: PlanCardHandlers;
  private rows: HTMLElement;
  private total: HTMLElement;
  private passButton: HTMLButtonElement;
  private submitButton: HTMLButtonElement;
  private submitted = false;

  constructor(handlers: PlanCardHandlers) {
    const { root, body } = card("Plan");
    this.root = root;
    this.handlers = handlers;
    this.rows = element("div", "plan-rows");
    this.total = element("div", "plan-total");
    this.passButton = element("button", "player-button player-button--ghost", "Pass");
    this.submitButton = element("button", "player-button");
    this.passButton.addEventListener("click", handlers.onPass);
    this.submitButton.addEventListener("click", () => (this.submitted ? handlers.onEdit() : handlers.onSubmit()));
    const buttons = element("div", "player-card__actions plan-footer__buttons");
    buttons.append(this.passButton, this.submitButton);
    const footer = element("div", "plan-footer");
    footer.append(this.total, buttons);
    body.append(this.rows, footer);
  }

  update(data: PlayerBoardData) {
    const plan = data.plan;
    this.submitted = plan.submitted;
    this.rows.replaceChildren(...plan.rows.map((row) => this.row(row, data.target !== null, data.locked)));
    this.root.classList.toggle("player-card--locked", plan.submitted);
    this.passButton.disabled = data.locked;
    this.submitButton.textContent = plan.submitted ? "Edit plan" : plan.passing ? "Submit pass" : "Submit plan";
    this.submitButton.disabled = data.finished || (!plan.submitted && plan.errors.length > 0);
    this.total.classList.toggle("plan-total--error", !plan.submitted && plan.errors.length > 0);
    this.total.textContent = this.summary(data);
  }

  private summary(data: PlayerBoardData): string {
    const plan = data.plan;
    const status = plan.passing ? `Passing · +${plan.passIncome}₵ at Income` : `Total ${plan.total}₵ / ${data.chao}₵`;
    if (plan.submitted) {
      return `Submitted · ${status}`;
    }
    return plan.errors.length > 0 ? plan.errors.join(" · ") : status;
  }

  private row(row: PlanRow, hasTarget: boolean, locked: boolean): HTMLElement {
    const root = element("div", "plan-row");
    const label = element("div", "plan-row__label");
    const blocker = row.level === null ? null : row.blockers[row.level];
    label.append(element("span", "plan-row__type", row.type), element("span", "plan-row__kind", kindText(row, hasTarget)));
    label.classList.toggle("plan-row__label--invalid", hasTarget && row.level !== null && (row.kind === null || blocker !== null));
    root.append(label);
    for (const level of ACTION_LEVELS) {
      const button = element("button", "plan-level");
      const reason = row.blockers[level];
      button.disabled = locked || (reason !== null && row.level !== level);
      button.title = reason ?? "";
      button.classList.toggle("plan-level--active", row.level === level);
      button.classList.toggle("plan-level--blocked", reason !== null);
      button.append(element("span", "plan-level__roman", ROMAN[level]), element("span", "plan-level__cost", `${row.costs[level]}₵`));
      button.addEventListener("click", () => this.handlers.onLevel(row.type, level));
      root.append(button);
    }
    return root;
  }
}

function kindText(row: PlanRow, hasTarget: boolean): string {
  if (!hasTarget) {
    return "";
  }
  const selected = row.level === null ? null : row.blockers[row.level];
  if (selected !== null) {
    return selected;
  }
  const blocked = ACTION_LEVELS.filter((level) => row.blockers[level] !== null);
  if (row.kind === null) {
    return blocked.length > 0 ? row.blockers[blocked[0]]! : "not possible on this target";
  }
  const kind = row.conditional ? `${row.kind} if the attack succeeds` : row.kind;
  if (blocked.length === 0) {
    return kind;
  }
  return `${kind} · ${blocked.map((level) => ROMAN[level]).join("/")}: ${row.blockers[blocked[0]]}`;
}
