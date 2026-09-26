import "./turn_bar.css";
import { element } from "./dom.ts";

export interface TurnBarSeat {
  label: string;
  clan: string;
  color: string;
  submitted: boolean;
  you: boolean;
  left: boolean;
}

export interface TurnBarData {
  turn: number;
  lastTurn: number;
  templeTarget: number;
  eruption: boolean;
  seats: TurnBarSeat[];
  status: string;
  winner: string | null;
  exitLabel: string;
}

export class TurnBar {
  root: HTMLElement;
  private title: HTMLElement;
  private seats: HTMLElement;
  private status: HTMLElement;
  private exit: HTMLButtonElement;

  constructor(container: HTMLElement, onExit: () => void) {
    this.root = element("div", "turn-bar");
    const bar = element("div", "turn-bar__bar");
    this.title = element("div", "turn-bar__title");
    this.seats = element("div", "turn-bar__seats");
    this.status = element("span", "turn-bar__hint turn-bar__status");
    this.exit = element("button", "player-button player-button--ghost turn-bar__exit");
    this.exit.addEventListener("click", onExit);
    bar.append(this.title, this.seats, this.status, this.exit);
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
        const classes = [
          "turn-bar__seat",
          seat.submitted && !seat.left ? "turn-bar__seat--ready" : "",
          seat.you ? "turn-bar__seat--you" : "",
          seat.left ? "turn-bar__seat--left" : "",
        ];
        const node = element("span", classes.filter(Boolean).join(" "), seat.label);
        node.style.setProperty("--seat-color", seat.color);
        node.title = `${seat.clan} · ${seat.left ? "Left the game, passes every turn" : seat.submitted ? "Plan submitted" : "Planning"}`;
        return node;
      }),
    );
    this.status.textContent = data.status;
    this.exit.textContent = data.exitLabel;
  }

  dispose() {
    this.root.remove();
  }
}
