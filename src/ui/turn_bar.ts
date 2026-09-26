import "./turn_bar.css";
import { element } from "./dom.ts";

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

export class TurnBar {
  root: HTMLElement;
  private title: HTMLElement;
  private seats: HTMLElement;
  private status: HTMLElement;

  constructor(container: HTMLElement) {
    this.root = element("div", "turn-bar");
    const bar = element("div", "turn-bar__bar");
    this.title = element("div", "turn-bar__title");
    this.seats = element("div", "turn-bar__seats");
    this.status = element("span", "turn-bar__hint turn-bar__status");
    bar.append(this.title, this.seats, this.status);
    this.root.append(bar);
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
  }

  dispose() {
    this.root.remove();
  }
}
