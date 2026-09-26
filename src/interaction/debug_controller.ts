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
  private host: PlayerId;
  private bar: DebugBar;
  private unsubscribe: () => void;

  constructor(
    container: HTMLElement,
    view: Observable<PlayerView>,
    host: PlayerId,
    colorOf: (player: PlayerId) => string,
    actions: DebugActions,
  ) {
    this.view = view;
    this.host = host;
    this.actions = actions;
    this.bar = new DebugBar(container, {
      onSeat: actions.actAs,
      onRestart: () => confirm("Restart the game from turn 1?") && actions.restart(),
      onLobby: actions.toLobby,
    });
    const render = (current: PlayerView) =>
      this.bar.update(
        this.controllable(current).map((seat) => ({ id: seat.id, label: seat.name, color: colorOf(seat.id) })),
        current.you,
      );
    render(view.get());
    this.unsubscribe = view.onChange(render);
    window.addEventListener("keydown", this.onKeyDown);
  }

  dispose() {
    this.unsubscribe();
    window.removeEventListener("keydown", this.onKeyDown);
    this.bar.dispose();
  }

  private controllable(view: PlayerView) {
    return view.seats.filter((seat) => seat.id === this.host || seat.placeholder);
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "p" || event.target instanceof HTMLInputElement) {
      return;
    }
    const seats = this.controllable(this.view.get());
    const index = seats.findIndex(({ id }) => id === this.view.get().you);
    this.actions.actAs(seats[(index + 1) % seats.length].id);
  };
}
