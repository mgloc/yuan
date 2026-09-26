import "./turn_bar.css";
import { readableOnDark } from "./color.ts";
import { element } from "./dom.ts";
import type { LogPart } from "./turn_text.ts";

export interface TurnBarSeat {
  label: string;
  clan: string;
  color: string;
  submitted: boolean;
  you: boolean;
}

export interface TurnBarData {
  turn: number;
  lastTurn: number;
  templeTarget: number;
  eruption: boolean;
  seats: TurnBarSeat[];
  status: string;
  winner: string | null;
}

export interface TurnLogEntry {
  turn: number;
  lines: LogPart[][];
}

export class TurnBar {
  root: HTMLElement;
  private title: HTMLElement;
  private seats: HTMLElement;
  private status: HTMLElement;
  private logButton: HTMLButtonElement;
  private log: HTMLElement;
  private logList: HTMLElement;

  constructor(container: HTMLElement) {
    this.root = element("div", "turn-bar");
    const bar = element("div", "turn-bar__bar");
    this.title = element("div", "turn-bar__title");
    this.seats = element("div", "turn-bar__seats");
    this.status = element("span", "turn-bar__hint turn-bar__status");
    this.logButton = element("button", "player-button player-button--ghost", "Log");
    this.logButton.addEventListener("click", () => (this.log.hidden = !this.log.hidden));
    bar.append(this.title, this.seats, this.status, this.logButton);

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
        const classes = ["turn-bar__seat", seat.submitted ? "turn-bar__seat--ready" : "", seat.you ? "turn-bar__seat--you" : ""];
        const node = element("span", classes.filter(Boolean).join(" "), seat.label);
        node.style.setProperty("--seat-color", seat.color);
        node.title = `${seat.clan} · ${seat.submitted ? "Plan submitted" : "Planning"}`;
        return node;
      }),
    );
    this.status.textContent = data.status;
    this.logButton.hidden = this.logList.childElementCount === 0;
  }

  setLog(entries: TurnLogEntry[], colorOf: (player: number) => string, reveal: boolean) {
    this.logList.replaceChildren(...entries.map((entry) => this.entry(entry, colorOf)).reverse());
    this.logButton.hidden = entries.length === 0;
    if (entries.length === 0) {
      this.log.hidden = true;
    } else if (reveal) {
      this.log.hidden = false;
    }
  }

  dispose() {
    this.root.remove();
  }

  private entry({ turn, lines }: TurnLogEntry, colorOf: (player: number) => string): HTMLElement {
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
    return entry;
  }
}
