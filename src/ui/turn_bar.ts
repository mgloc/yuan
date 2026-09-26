import "./turn_bar.css";
import { readableOnDark } from "./color.ts";
import { element } from "./dom.ts";
import type { LogPart } from "./turn_text.ts";

export interface TurnBarSeat {
  label: string;
  color: string;
  submitted: boolean;
}

export interface TurnBarData {
  turn: number;
  lastTurn: number;
  templeTarget: number;
  eruption: boolean;
  seats: TurnBarSeat[];
  canResolve: boolean;
  winner: string | null;
}

export class TurnBar {
  root: HTMLElement;
  private title: HTMLElement;
  private seats: HTMLElement;
  private resolveButton: HTMLButtonElement;
  private logButton: HTMLButtonElement;
  private log: HTMLElement;
  private logList: HTMLElement;

  constructor(container: HTMLElement, onResolve: () => void) {
    this.root = element("div", "turn-bar");
    const bar = element("div", "turn-bar__bar");
    this.title = element("div", "turn-bar__title");
    this.seats = element("div", "turn-bar__seats");
    this.resolveButton = element("button", "player-button", "Resolve turn");
    this.resolveButton.addEventListener("click", onResolve);
    this.logButton = element("button", "player-button player-button--ghost", "Log");
    this.logButton.addEventListener("click", () => (this.log.hidden = !this.log.hidden));
    bar.append(this.title, this.seats, this.resolveButton, this.logButton);

    this.log = element("section", "turn-log");
    this.log.hidden = true;
    this.logList = element("ol", "turn-log__list");
    this.log.append(this.logList);
    this.root.append(bar, this.log);
    container.appendChild(this.root);
  }

  update(data: TurnBarData) {
    this.title.replaceChildren(
      element("strong", "", data.winner === null ? `Turn ${data.turn} / ${data.lastTurn}` : `${data.winner} wins`),
      element("span", "turn-bar__hint", `${data.templeTarget} Temples to win${data.eruption ? " · Eruption this turn" : ""}`),
    );
    this.seats.replaceChildren(
      ...data.seats.map((seat) => {
        const node = element("span", `turn-bar__seat${seat.submitted ? " turn-bar__seat--ready" : ""}`, seat.label);
        node.style.setProperty("--seat-color", seat.color);
        node.title = seat.submitted ? "Plan submitted" : "Planning";
        return node;
      }),
    );
    this.resolveButton.disabled = !data.canResolve;
    this.resolveButton.hidden = data.winner !== null;
    this.logButton.hidden = this.logList.childElementCount === 0;
  }

  showLog(turn: number, lines: LogPart[][], colorOf: (player: number) => string) {
    const entry = element("li", "turn-log__turn");
    const list = element("ul", "turn-log__events");
    list.append(
      ...lines.map((line) => {
        const item = element("li", "");
        item.append(
          ...line.map((part) => {
            if (typeof part === "string") {
              return part;
            }
            const name = element("span", "turn-log__clan", part.text);
            name.style.color = readableOnDark(colorOf(part.player));
            return name;
          }),
        );
        return item;
      }),
    );
    entry.append(element("h4", "turn-log__heading", `Turn ${turn}`), list);
    this.logList.prepend(entry);
    this.logButton.hidden = false;
    this.log.hidden = false;
  }

  dispose() {
    this.root.remove();
  }
}
