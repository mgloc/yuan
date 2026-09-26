import "./debug_bar.css";
import { element } from "./dom.ts";

export interface DebugSeat {
  id: number;
  label: string;
  color: string;
}

export interface DebugBarHandlers {
  onSeat: (id: number) => void;
  onRestart: () => void;
  onLobby: () => void;
}

export class DebugBar {
  root: HTMLElement;
  private seats: HTMLElement;
  private handlers: DebugBarHandlers;

  constructor(container: HTMLElement, handlers: DebugBarHandlers) {
    this.handlers = handlers;
    this.root = element("nav", "debug-bar");
    this.seats = element("div", "debug-bar__seats");
    const restart = element("button", "debug-bar__button", "Restart");
    restart.addEventListener("click", handlers.onRestart);
    const lobby = element("button", "debug-bar__button", "Lobby");
    lobby.addEventListener("click", handlers.onLobby);
    const actions = element("div", "debug-bar__actions");
    actions.append(restart, lobby);
    this.root.append(element("span", "debug-bar__label", "Debug · play as (P)"), this.seats, actions);
    container.appendChild(this.root);
  }

  update(seats: DebugSeat[], active: number) {
    this.seats.replaceChildren(
      ...seats.map((seat) => {
        const button = element("button", `debug-bar__seat${seat.id === active ? " debug-bar__seat--active" : ""}`, seat.label);
        button.style.setProperty("--seat-color", seat.color);
        button.addEventListener("click", () => this.handlers.onSeat(seat.id));
        return button;
      }),
    );
  }

  dispose() {
    this.root.remove();
  }
}
