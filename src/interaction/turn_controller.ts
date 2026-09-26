import { LAST_TURN, VOLCANO_ERUPTION_TURNS, templeTarget, type GameOptions, type GameState, type PlayerId } from "../game_types.ts";
import { resolveTurn } from "../game/turn/resolve.ts";
import { TurnBar } from "../ui/turn_bar.ts";
import { eventText } from "../ui/turn_text.ts";
import type { Observable } from "./observable.ts";
import type { Plans } from "./plans.ts";

export class TurnController {
  private game: Observable<GameState>;
  private plans: Plans;
  private colorOf: (player: PlayerId) => string;
  private newGame: (options: GameOptions) => GameState;
  private view: TurnBar;
  private unsubscribers: (() => void)[];

  constructor(
    container: HTMLElement,
    game: Observable<GameState>,
    plans: Plans,
    colorOf: (player: PlayerId) => string,
    newGame: (options: GameOptions) => GameState,
  ) {
    this.game = game;
    this.plans = plans;
    this.colorOf = colorOf;
    this.newGame = newGame;
    this.view = new TurnBar(container, {
      onResolve: () => this.resolve(),
      onNewGame: ({ clanPowers }) => this.restart({ ...this.game.get().options, clanPowers }),
    });
    this.unsubscribers = [game.onChange(() => this.render()), plans.onChange(() => this.render())];
    this.render();
  }

  dispose() {
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
    this.view.dispose();
  }

  private allSubmitted(): boolean {
    return this.game.get().players.every((player) => this.plans.isSubmitted(player.id));
  }

  private resolve() {
    const before = this.game.get();
    if (before.finished || !this.allSubmitted()) {
      return;
    }
    const { state, events } = resolveTurn(before, this.plans.all());
    this.view.showLog(before.turn, events.map((event) => eventText(state, event)), this.colorOf);
    this.game.set(state);
    this.plans.clear();
  }

  private restart(options: GameOptions) {
    this.plans.clear();
    this.view.clearLog();
    this.game.set(this.newGame(options));
  }

  private render() {
    const game = this.game.get();
    const winner = game.players.find(({ id }) => id === game.winner);
    this.view.update({
      turn: game.turn,
      lastTurn: LAST_TURN,
      templeTarget: templeTarget(game.turn),
      eruption: VOLCANO_ERUPTION_TURNS.has(game.turn),
      seats: game.players.map((player) => ({
        label: player.clan,
        color: this.colorOf(player.id),
        submitted: this.plans.isSubmitted(player.id),
      })),
      canResolve: !game.finished && this.allSubmitted(),
      winner: winner?.clan ?? null,
      settings: { clanPowers: game.options.clanPowers },
    });
  }
}
