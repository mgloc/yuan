import { LAST_TURN, VOLCANO_ERUPTION_TURNS, templeTarget, type GameInfo, type PlayerId } from "../game_types.ts";
import type { PlayerView } from "../protocol.ts";
import { LogPanel } from "../ui/log_panel.ts";
import { TurnBar } from "../ui/turn_bar.ts";
import { eventText } from "../ui/turn_text.ts";
import type { Observable } from "./observable.ts";

export class TurnController {
  private view: Observable<PlayerView>;
  private game: Observable<GameInfo>;
  private colorOf: (player: PlayerId) => string;
  private bar: TurnBar;
  private log: LogPanel;
  private shownTurns = -1;
  private unsubscribe: () => void;

  constructor(
    container: HTMLElement,
    view: Observable<PlayerView>,
    game: Observable<GameInfo>,
    colorOf: (player: PlayerId) => string,
    onExit: () => void,
  ) {
    this.view = view;
    this.game = game;
    this.colorOf = colorOf;
    this.bar = new TurnBar(container, onExit);
    this.log = new LogPanel(container);
    this.unsubscribe = game.onChange(() => this.render());
    this.render();
  }

  get root(): HTMLElement {
    return this.bar.root;
  }

  dispose() {
    this.unsubscribe();
    this.bar.dispose();
    this.log.dispose();
  }

  private render() {
    const view = this.view.get();
    const game = this.game.get();
    const log = view.match?.log ?? [];
    if (log.length !== this.shownTurns) {
      const entries = log.map(({ turn, events }) => ({ turn, lines: events.map((event) => eventText(game, event)) }));
      this.log.setEntries(entries, this.colorOf, this.shownTurns >= 0 && log.length > this.shownTurns);
      this.shownTurns = log.length;
    }

    const winner = view.seats.find(({ id }) => id === game.winner);
    this.bar.update({
      turn: game.turn,
      lastTurn: LAST_TURN,
      templeTarget: templeTarget(game.turn),
      eruption: VOLCANO_ERUPTION_TURNS.has(game.turn),
      seats: view.seats.map((seat) => ({
        label: seat.name,
        clan: seat.clan,
        color: this.colorOf(seat.id),
        submitted: seat.submitted,
        you: seat.id === view.you,
        left: seat.left,
      })),
      status: this.status(view, game),
      winner: winner === undefined ? null : `${winner.name} (${winner.clan})`,
      exitLabel: view.host === view.self ? "End game" : "Leave",
    });
  }

  private status(view: PlayerView, game: GameInfo): string {
    if (game.finished) {
      return "Game over";
    }
    const waiting = view.seats.filter(({ submitted, left }) => !submitted && !left);
    if (waiting.length === 0) {
      return "Resolving…";
    }
    if (!waiting.some(({ id }) => id === view.you)) {
      return `Waiting for ${waiting.map(({ name }) => name).join(", ")}`;
    }
    return "Plan your turn";
  }
}
