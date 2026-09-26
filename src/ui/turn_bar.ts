import "./turn_bar.css";
import { element } from "./dom.ts";

const OPEN_KEY = "yuan:turn-open";

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
  private toggle: HTMLButtonElement;
  private open = readOpen();

  constructor(container: HTMLElement, onExit: () => void) {
    this.root = element("div", "turn-bar");
    const bar = element("div", "turn-bar__bar");
    this.title = element("div", "turn-bar__title");
    this.toggle = element("button", "turn-bar__toggle");
    this.toggle.title = "Toggle turn details";
    this.toggle.append(this.title, element("span", "turn-bar__chevron"));
    this.toggle.addEventListener("click", () => this.setOpen(!this.open));
    this.seats = element("div", "turn-bar__seats");
    this.status = element("span", "turn-bar__hint turn-bar__status");
    this.exit = element("button", "player-button player-button--ghost turn-bar__exit");
    this.exit.addEventListener("click", onExit);
    bar.append(this.toggle, this.seats, this.status, this.exit);
    this.root.append(bar);
    container.appendChild(this.root);
    this.render();
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

  private setOpen(open: boolean) {
    this.open = open;
    try {
      localStorage.setItem(OPEN_KEY, open ? "1" : "0");
    } catch {}
    this.render();
  }

  private render() {
    this.root.classList.toggle("turn-bar--open", this.open);
    this.toggle.setAttribute("aria-expanded", String(this.open));
  }
}

function readOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) !== "0";
  } catch {
    return true;
  }
}
