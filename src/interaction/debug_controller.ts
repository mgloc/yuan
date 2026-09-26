import type { PlayerId } from "../game_types.ts";
import type { PlayerView } from "../protocol.ts";
import { DebugBar } from "../ui/debug_bar.ts";
import type { Observable } from "./observable.ts";

export interface DebugActions {
  actAs: (player: PlayerId) => void;
  restart: () => void;
  toLobby: () => void;
}

export class DebugController {
  private view: Observable<PlayerView>;
  private actions: DebugActions;
  private bar: DebugBar;
  private unsubscribe: () => void;

  constructor(container: HTMLElement, view: Observable<PlayerView>, colorOf: (player: PlayerId) => string, actions: DebugActions) {
    this.view = view;
    this.actions = actions;
    this.bar = new DebugBar(container, {
      onSeat: actions.actAs,
      onRestart: () => confirm("Restart the game from turn 1?") && actions.restart(),
      onLobby: actions.toLobby,
    });
    const render = (current: PlayerView) =>
      this.bar.update(current.seats.map((seat) => ({ id: seat.id, label: seat.name, color: colorOf(seat.id) })), current.you);
    render(view.get());
    this.unsubscribe = view.onChange(render);
    window.addEventListener("keydown", this.onKeyDown);
  }

  dispose() {
    this.unsubscribe();
    window.removeEventListener("keydown", this.onKeyDown);
    this.bar.dispose();
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "p" || event.target instanceof HTMLInputElement) {
      return;
    }
    const { seats, you } = this.view.get();
    const index = seats.findIndex(({ id }) => id === you);
    this.actions.actAs(seats[(index + 1) % seats.length].id);
  };
}
