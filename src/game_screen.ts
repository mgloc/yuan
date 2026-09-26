import * as THREE from "three";
import type { GameInfo, PlayerId } from "./game_types.ts";
import { Timer } from "./core/timer.ts";
import { CameraFocusController } from "./interaction/camera_focus_controller.ts";
import { DebugController } from "./interaction/debug_controller.ts";
import { HighlightLayers } from "./interaction/highlight_layers.ts";
import { Observable } from "./interaction/observable.ts";
import { PlanDraft } from "./interaction/plan_draft.ts";
import { PlayerBoardController } from "./interaction/player_board_controller.ts";
import { Selection } from "./interaction/selection.ts";
import { TileSelectionController } from "./interaction/tile_selection_controller.ts";
import { TurnController } from "./interaction/turn_controller.ts";
import type { GameClient } from "./net/game_client.ts";
import { gameInfo } from "./net/view.ts";
import type { PlayerView } from "./protocol.ts";
import { CameraRig } from "./rendering/camera_rig.ts";
import { CLAN_COLORS, clanCssColor } from "./rendering/clan_colors.ts";
import { TilePicker } from "./rendering/picking.ts";
import { ProceduralPieceFactory } from "./rendering/pieces/procedural_factory.ts";
import { Renderer } from "./rendering/renderer.ts";
import { TableView } from "./rendering/views/table_view.ts";
import { TileGridView } from "./rendering/views/tile_grid_view.ts";
import { TILE_RADIUS } from "./rendering/views/tile_view.ts";
import { InfoPanel } from "./ui/info_panel.ts";

const FRAME_TOP_INSET = 72;

export class GameScreen {
  private view: Observable<PlayerView>;
  private game: Observable<GameInfo>;
  private draft = new PlanDraft();
  private renderer: Renderer;
  private grid: TileGridView;
  private disposers: (() => void)[] = [];
  private frame = 0;
  private draftKey: string;

  constructor(container: HTMLElement, client: GameClient, initial: PlayerView, onExit: () => void) {
    this.view = new Observable(initial);
    this.game = new Observable(gameInfo(initial, initial.match!));
    this.draftKey = draftKey(initial);

    const clanOf = (player: PlayerId) => this.view.get().seats.find(({ id }) => id === player)!.clan;
    const clanColor = (player: PlayerId) => CLAN_COLORS[clanOf(player)];
    const cssColor = (player: PlayerId) => clanCssColor(clanOf(player));

    this.renderer = new Renderer(window.innerWidth, window.innerHeight, container);
    const renderer = this.renderer;
    this.grid = new TileGridView(renderer.scene, initial.match!.tiles, new ProceduralPieceFactory(), renderer.sun.position);
    const grid = this.grid;
    grid.updateProvinces(this.game.get().provinces, clanColor);

    const picker = new TilePicker(renderer, grid.root);
    const highlights = new HighlightLayers(grid);
    const selection = new Selection();
    const panel = new InfoPanel(container);
    const tileSelection = new TileSelectionController(this.game, highlights, picker, selection, panel);
    const board = new PlayerBoardController(container, this.view, this.game, this.draft, selection, highlights, cssColor, {
      submit: (plan) => client.submit(plan),
      edit: () => client.edit(),
    });
    const turn = new TurnController(container, this.view, this.game, cssColor, onExit);
    const unsubscribe = this.game.onChange((game) => grid.updateProvinces(game.provinces, clanColor));
    const rig = new CameraRig(renderer);
    const focus = new CameraFocusController(rig, grid, selection);
    const bounds = new THREE.Box3().setFromObject(grid.root);
    const table = new TableView(renderer.scene, bounds, grid.tileCenters(), TILE_RADIUS);
    renderer.environment.setGround(table.floorZ);
    const layout = (apply: boolean) => {
      const bottom = window.innerHeight - board.root.getBoundingClientRect().top;
      container.style.setProperty("--hud-bottom", `${bottom}px`);
      renderer.setInsets({ top: FRAME_TOP_INSET, bottom });
      rig.frame(bounds, apply);
    };
    layout(true);
    const boardSize = new ResizeObserver(() => layout(false));
    boardSize.observe(board.root);
    const onResize = () => {
      renderer.resize(window.innerWidth, window.innerHeight);
      layout(false);
    };
    window.addEventListener("resize", onResize);

    this.disposers.push(
      unsubscribe,
      () => window.removeEventListener("resize", onResize),
      () => boardSize.disconnect(),
      () => container.style.removeProperty("--hud-bottom"),
      () => table.dispose(renderer.scene),
      () => focus.dispose(),
      () => rig.dispose(),
      () => turn.dispose(),
      () => board.dispose(),
      () => tileSelection.dispose(),
      () => panel.dispose(),
      () => picker.dispose(),
    );

    if (initial.debug && client.isHost) {
      const debug = new DebugController(container, this.view, initial.self, cssColor, {
        actAs: (player) => client.actAs(player),
        restart: () => client.restart(),
        toLobby: () => client.toLobby(),
      });
      this.disposers.push(() => debug.dispose());
    }

    const timer = new Timer();
    const loop = () => {
      this.frame = requestAnimationFrame(loop);
      const dt = timer.tick();
      rig.update(dt);
      grid.update(dt);
      renderer.render();
    };
    loop();
  }

  update(view: PlayerView) {
    if (view.match === null) {
      return;
    }
    const key = draftKey(view);
    if (key !== this.draftKey) {
      this.draftKey = key;
      this.draft.reset();
    }
    this.view.set(view);
    this.game.set(gameInfo(view, view.match));
  }

  dispose() {
    cancelAnimationFrame(this.frame);
    this.disposers.forEach((dispose) => dispose());
    this.grid.dispose(this.renderer.scene);
    this.renderer.dispose();
  }
}

function draftKey(view: PlayerView): string {
  return `${view.you}:${view.match?.turn}:${view.match?.log.length}`;
}
