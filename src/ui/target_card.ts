import { card, element } from "./dom.ts";
import type { PlayerBoardData } from "./player_board_data.ts";

export interface TargetCardHandlers {
  onTarget: () => void;
  onClear: () => void;
}

export class TargetCard {
  root: HTMLElement;
  private title: HTMLElement;
  private details: HTMLElement;
  private targetButton: HTMLButtonElement;
  private clearButton: HTMLButtonElement;

  constructor(handlers: TargetCardHandlers) {
    const { root, body } = card("Target");
    this.root = root;
    this.title = element("div", "target-name");
    this.details = element("p", "player-card__hint");
    this.targetButton = element("button", "player-button", "Target selected tile");
    this.clearButton = element("button", "player-button player-button--ghost", "Clear");
    this.targetButton.addEventListener("click", handlers.onTarget);
    this.clearButton.addEventListener("click", handlers.onClear);
    const actions = element("div", "player-card__actions");
    actions.append(this.targetButton, this.clearButton);
    body.append(this.title, this.details, actions);
  }

  update(data: PlayerBoardData) {
    const target = data.target;
    this.title.textContent = target?.title ?? "No target";
    this.title.classList.toggle("target-name--empty", target === null);
    this.details.textContent = target?.details ?? "Select a Province on the board, then target it.";
    this.targetButton.disabled = !data.canTarget;
    this.clearButton.hidden = target === null;
    this.clearButton.disabled = data.locked;
  }
}
