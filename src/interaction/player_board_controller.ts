import type { GameState, PlayerId } from "../game_types.ts";
import { coordKey } from "../game/tile/coords.ts";
import { Highlight } from "../rendering/highlight.ts";
import { PlayerBoard } from "../ui/player_board.ts";
import { playerBoardData } from "../ui/player_board_data.ts";
import type { HighlightLayers } from "./highlight_layers.ts";
import type { Observable } from "./observable.ts";
import type { Plans } from "./plans.ts";
import type { Selection } from "./selection.ts";

const TARGET_LAYER = "target";

export class PlayerBoardController {
  private game: Observable<GameState>;
  private activePlayer: Observable<PlayerId>;
  private plans: Plans;
  private selection: Selection;
  private highlights: HighlightLayers;
  private colorOf: (player: PlayerId) => string;
  private view: PlayerBoard;
  private unsubscribers: (() => void)[];

  constructor(
    container: HTMLElement,
    game: Observable<GameState>,
    activePlayer: Observable<PlayerId>,
    plans: Plans,
    selection: Selection,
    highlights: HighlightLayers,
    colorOf: (player: PlayerId) => string,
  ) {
    this.game = game;
    this.activePlayer = activePlayer;
    this.plans = plans;
    this.selection = selection;
    this.highlights = highlights;
    this.colorOf = colorOf;

    this.view = new PlayerBoard(container, {
      onTarget: () => plans.setTarget(activePlayer.get(), selection.get()),
      onClear: () => plans.setTarget(activePlayer.get(), null),
      onLevel: (type, level) => plans.toggleLevel(activePlayer.get(), type, level),
      onPass: () => plans.pass(activePlayer.get()),
      onSubmit: () => plans.submit(activePlayer.get()),
      onEdit: () => plans.edit(activePlayer.get()),
    });

    this.unsubscribers = [
      game.onChange(() => this.render()),
      activePlayer.onChange(() => this.render()),
      plans.onChange((player) => player === activePlayer.get() && this.render()),
      selection.onChange(() => this.render()),
    ];
    this.render();
  }

  dispose() {
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
    this.highlights.set(TARGET_LAYER, new Map());
    this.view.dispose();
  }

  private render() {
    const game = this.game.get();
    const id = this.activePlayer.get();
    const player = game.players.find((candidate) => candidate.id === id);
    if (player === undefined) {
      return;
    }
    const plan = this.plans.get(id);
    this.view.update(playerBoardData(game, player, plan, this.selection.get(), this.colorOf(id), this.plans.isSubmitted(id)));
    this.highlights.set(
      TARGET_LAYER,
      new Map(plan.target === null ? [] : [[coordKey(plan.target), Highlight.Target]]),
    );
  }
}
