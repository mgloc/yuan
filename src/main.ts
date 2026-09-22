import { TileType, type Tile } from "./game_types.ts";
import { Renderer } from "./rendering/renderer.ts";
import { TileGridView } from "./rendering/views/tile_grid_view.ts";
import { Timer } from "./core/timer.ts";

const width = window.innerWidth,
  height = window.innerHeight;

const renderer = new Renderer(width, height, document.body);

const tile = (type: TileType): Tile => ({ type });

const test_grid: (Tile | null)[][] = [
  [null, tile(TileType.Mountain), null],
  [tile(TileType.Mine), tile(TileType.Sea), tile(TileType.Mountain)],
  [tile(TileType.Sea), tile(TileType.RiceField), tile(TileType.Forest)],
];

new TileGridView(renderer.scene, test_grid);

const timer = new Timer();
function loop() {
  requestAnimationFrame(loop);
  timer.tick();
  renderer.render();
}
loop();
