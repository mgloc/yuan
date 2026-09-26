import { Renderer } from "./rendering/renderer.ts";
import { TileGridView } from "./rendering/views/tile_grid_view.ts";
import { TilePicker } from "./rendering/picking.ts";
import { Timer } from "./core/timer.ts";
import { createTestBoard, createTestPlayers } from "./game/test_board.ts";
import { ProceduralPieceFactory } from "./rendering/pieces/procedural_factory.ts";
import { CLAN_COLORS } from "./rendering/clan_colors.ts";
import { Selection } from "./interaction/selection.ts";
import { TileSelectionController } from "./interaction/tile_selection_controller.ts";
import { HighlightLayers } from "./interaction/highlight_layers.ts";
import { Observable } from "./interaction/observable.ts";
import { Plans } from "./interaction/plans.ts";
import { PlayerBoardController } from "./interaction/player_board_controller.ts";
import { HotseatController } from "./interaction/hotseat_controller.ts";
import { TurnController } from "./interaction/turn_controller.ts";
import { InfoPanel } from "./ui/info_panel.ts";
import type { GameState, PlayerId } from "./game_types.ts";

const width = window.innerWidth,
  height = window.innerHeight;

const renderer = new Renderer(width, height, document.body);

const game = new Observable<GameState>({
  turn: 1,
  options: { bidding: false, clanPowers: true },
  ...createTestBoard(),
  players: createTestPlayers(),
  winner: null,
  finished: false,
});
const clanColor = (player: PlayerId) => CLAN_COLORS[game.get().players.find(({ id }) => id === player)!.clan];
const cssColor = (player: PlayerId) => `#${clanColor(player).toString(16).padStart(6, "0")}`;

const grid = new TileGridView(renderer.scene, game.get().tiles, new ProceduralPieceFactory(), renderer.sun.position);
grid.updateProvinces(game.get().provinces, clanColor);
game.onChange((state) => grid.updateProvinces(state.provinces, clanColor));

const picker = new TilePicker(renderer, grid.root);
const highlights = new HighlightLayers(grid);
const selection = new Selection();
const plans = new Plans();
new TileSelectionController(game, highlights, picker, selection, new InfoPanel(document.body));

const activePlayer = new Observable<PlayerId>(game.get().players[0].id);
new PlayerBoardController(document.body, game, activePlayer, plans, selection, highlights, cssColor);
new TurnController(document.body, game, plans, cssColor);
if (import.meta.env.DEV) {
  new HotseatController(document.body, game.get().players, activePlayer, cssColor);
}

const timer = new Timer();
function loop() {
  requestAnimationFrame(loop);
  grid.update(timer.tick());
  renderer.render();
}
loop();
