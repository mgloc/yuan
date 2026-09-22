import { TileType, type Tile } from "./game_types.ts";
import { Renderer } from "./rendering/renderer.ts";
import { TileView } from "./rendering/views/tile_view.ts";
import { Timer } from "./core/timer.ts";

const width = window.innerWidth,
  height = window.innerHeight;

// Rendering

const renderer = new Renderer(width, height, document.body)

const tile: Tile = {
  type: TileType.RiceField
}
const tile_view = new TileView(renderer.scene, tile);
const tile_view_2 = new TileView(renderer.scene, tile);

let timer = new Timer();
function loop() {
  requestAnimationFrame(loop);
  let dt = timer.tick();

  tile_view.root.rotateX(dt);
  tile_view.root.rotateY(dt);

  renderer.render();
}
loop();
