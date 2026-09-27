import { element } from "./dom.ts";
import type { PlayerBoardData } from "./player_board_data.ts";

export interface TargetCardHandlers {
  onTarget: () => void;
  onClear: () => void;
}

export class TargetCard {
  root: HTMLElement;
  private title: HTMLElement;
  private button: HTMLButtonElement;
  private clearing = false;

  constructor(handlers: TargetCardHandlers) {
    this.root = element("div", "plan-target");
    this.title = element("div", "target-name");
    this.button = element("button", "player-button");
    this.button.addEventListener("click", () => (this.clearing ? handlers.onClear() : handlers.onTarget()));
    const label = element("div", "plan-target__label");
    label.append(element("span", "plan-target__caption", "Target"), this.title);
    this.root.append(label, this.button);
  }

  update(data: PlayerBoardData) {
    const target = data.target;
    this.title.textContent = target?.title ?? "Select a Province on the board";
    this.title.classList.toggle("target-name--empty", target === null);
    this.clearing = !data.canTarget;
    this.button.textContent = data.canTarget ? (target === null ? "Target selected tile" : "Change target") : "Clear";
    this.button.classList.toggle("player-button--ghost", this.clearing);
    this.button.hidden = data.locked || (!data.canTarget && target === null);
  }
}
