import { Renderer } from "./rendering/renderer.ts";
import { TileGridView } from "./rendering/views/tile_grid_view.ts";
import { TilePicker } from "./rendering/picking.ts";
import { Timer } from "./core/timer.ts";
import { createTestBoard, createTestPlayers } from "./game/test_board.ts";
import { ProceduralPieceFactory } from "./rendering/pieces/procedural_factory.ts";
import { CLAN_COLORS } from "./rendering/clan_colors.ts";
import { Selection } from "./interaction/selection.ts";
import { TileSelectionController } from "./interaction/tile_selection_controller.ts";
import { InfoPanel } from "./ui/info_panel.ts";

const width = window.innerWidth,
  height = window.innerHeight;

const renderer = new Renderer(width, height, document.body);

const board = createTestBoard();
const players = createTestPlayers();
const grid = new TileGridView(renderer.scene, board.tiles, new ProceduralPieceFactory());
grid.updateProvinces(board.provinces, (player) => CLAN_COLORS[players.find(({ id }) => id === player)!.clan]);
const picker = new TilePicker(renderer, grid.root);
const panel = new InfoPanel(document.body);
new TileSelectionController(board, grid, picker, new Selection(), panel);

const timer = new Timer();
function loop() {
  requestAnimationFrame(loop);
  timer.tick();
  renderer.render();
}
loop();
