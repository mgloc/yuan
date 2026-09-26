import type { Player, PlayerId } from "../game_types.ts";
import { HotseatSwitcher } from "../ui/hotseat_switcher.ts";
import type { Observable } from "./observable.ts";

export class HotseatController {
  private players: Player[];
  private activePlayer: Observable<PlayerId>;
  private switcher: HotseatSwitcher;
  private unsubscribe: () => void;

  constructor(container: HTMLElement, players: Player[], activePlayer: Observable<PlayerId>, colorOf: (player: PlayerId) => string) {
    this.players = players;
    this.activePlayer = activePlayer;
    this.switcher = new HotseatSwitcher(
      container,
      players.map((player) => ({ id: player.id, label: player.clan, color: colorOf(player.id) })),
      (id) => activePlayer.set(id),
    );
    this.switcher.setActive(activePlayer.get());
    this.unsubscribe = activePlayer.onChange((id) => this.switcher.setActive(id));
    window.addEventListener("keydown", this.onKeyDown);
  }

  dispose() {
    this.unsubscribe();
    window.removeEventListener("keydown", this.onKeyDown);
    this.switcher.dispose();
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "p") {
      return;
    }
    const index = this.players.findIndex(({ id }) => id === this.activePlayer.get());
    this.activePlayer.set(this.players[(index + 1) % this.players.length].id);
  };
}
