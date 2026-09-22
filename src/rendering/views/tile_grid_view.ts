
const TILE_STEP_X = 1.5 * TILE_RADIUS;
const TILE_STEP_Y = SQRT3 * TILE_RADIUS;

const test_grid: (Tile | null)[][] = [
  [null, tile(TileType.Sea), tile(TileType.Sea)],
  [tile(TileType.Plain), tile(TileType.RiceField), null],
  [tile(TileType.Forest), tile(TileType.Mine), tile(TileType.Mountain)],
];

function tilesMeshes(grid: (Tile | null)[][]): THREE.Mesh[] {
  const meshes = [];

  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      const tile = grid[row][col];
      if (tile === null) {
        continue;
      }

      const mesh = new THREE.Mesh(TILE_GEOMETRY, TILE_MATERIALS.get(tile.type));
      mesh.position.x = row * TILE_STEP_X;
      mesh.position.y =
        col * TILE_STEP_Y + (row % 2 == 1 ? TILE_STEP_Y / 2 : 0);
      meshes.push(mesh);
    }
  }
  return meshes;
}

tilesMeshes(test_grid).map((tile) => scene.add(tile));
