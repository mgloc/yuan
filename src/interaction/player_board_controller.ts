import type { GameInfo, Plan, PlayerId } from "../game_types.ts";
import { emptyPlan } from "../game/plan/plan.ts";
import { coordKey } from "../game/tile/coords.ts";
import type { PlayerView } from "../protocol.ts";
import { Highlight } from "../rendering/highlight.ts";
import { PlayerBoard } from "../ui/player_board.ts";
import { playerBoardData } from "../ui/player_board_data.ts";
import type { HighlightLayers } from "./highlight_layers.ts";
import type { Observable } from "./observable.ts";
import type { PlanDraft } from "./plan_draft.ts";
import type { Selection } from "./selection.ts";

const TARGET_LAYER = "target";

export interface PlanActions {
  submit: (plan: Plan) => void;
  edit: () => void;
}

export class PlayerBoardController {
  private view: Observable<PlayerView>;
  private game: Observable<GameInfo>;
  private draft: PlanDraft;
  private selection: Selection;
  private highlights: HighlightLayers;
  private colorOf: (player: PlayerId) => string;
  private board: PlayerBoard;
  private unsubscribers: (() => void)[];

  constructor(
    container: HTMLElement,
    side: HTMLElement,
    view: Observable<PlayerView>,
    game: Observable<GameInfo>,
    draft: PlanDraft,
    selection: Selection,
    highlights: HighlightLayers,
    colorOf: (player: PlayerId) => string,
    actions: PlanActions,
  ) {
    this.view = view;
    this.game = game;
    this.draft = draft;
    this.selection = selection;
    this.highlights = highlights;
    this.colorOf = colorOf;

    this.board = new PlayerBoard(container, side, {
      onTarget: () => draft.setTarget(selection.get()),
      onClear: () => draft.setTarget(null),
      onLevel: (type, level) => draft.toggleLevel(type, level),
      onPass: () => actions.submit(emptyPlan()),
      onSubmit: () => actions.submit(draft.get()),
      onEdit: () => {
        const submitted = view.get().match?.plan;
        if (submitted) {
          draft.set(submitted);
        }
        actions.edit();
      },
    });

    this.unsubscribers = [
      game.onChange(() => this.render()),
      draft.onChange(() => this.render()),
      selection.onChange(() => this.render()),
    ];
    this.render();
  }

  get root(): HTMLElement {
    return this.board.root;
  }

  dispose() {
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
    this.highlights.set(TARGET_LAYER, new Map());
    this.board.dispose();
  }

  private render() {
    const view = this.view.get();
    const seat = view.seats.find(({ id }) => id === view.you);
    if (view.match === null || seat === undefined) {
      return;
    }
    const plan = seat.submitted && view.match.plan !== null ? view.match.plan : this.draft.get();
    const player = { id: seat.id, clan: seat.clan, chao: view.match.chao };
    this.board.update(
      playerBoardData(this.game.get(), player, plan, this.selection.get(), this.colorOf(seat.id), seat.submitted),
    );
    this.highlights.set(TARGET_LAYER, new Map(plan.target === null ? [] : [[coordKey(plan.target), Highlight.Target]]));
  }
}
