import { Clan, isLand, TileType, type Coord, type Grid, type Tile } from "../game_types.ts";
import type { Capital, PrebuiltMap } from "./default_map.ts";
import { CLAN_ORDER, placementError, tileCells, WORK_CENTER, WORK_COLS, WORK_ROWS, type SetupState } from "./setup/setup.ts";
import { tileGroup, type TileGroupId } from "./setup/tile_groups.ts";
import { coordKey } from "./tile/coords.ts";

export interface PlacedTile {
  id: TileGroupId;
  anchor: Coord;
  rotation: number;
}

export interface MapDraft {
  name: string;
  players: number;
  bidding: boolean;
  tiles: PlacedTile[];
  capitals: Partial<Record<Clan, Coord>>;
  temples: Coord[] | null;
}

export interface ExportedMap extends PrebuiltMap {
  players: number;
  capitals: Capital[];
  temples?: Coord[];
  editor: { offset: Coord; tiles: PlacedTile[] };
}

const SYMBOLS: Record<TileType, string> = {
  [TileType.RiceField]: "R",
  [TileType.Forest]: "F",
  [TileType.Mine]: "M",
  [TileType.Hills]: "H",
  [TileType.Water]: "~",
  [TileType.Mountain]: "^",
  [TileType.Volcano]: "V",
};

const CELL_WIDTH = 8;
export const MIN_MAP_PLAYERS = 2;
export const MAX_MAP_PLAYERS = 4;

export function emptyDraft(): MapDraft {
  return { name: "Custom map", players: MIN_MAP_PLAYERS, bidding: false, tiles: [], capitals: {}, temples: null };
}

export function draftGrid(draft: MapDraft): Grid<Tile> {
  const grid: Grid<Tile> = Array.from({ length: WORK_ROWS }, () => Array.from({ length: WORK_COLS }, () => null));
  for (const { id, anchor, rotation } of draft.tiles) {
    const group = tileGroup(id);
    if (group === undefined) {
      continue;
    }
    tileCells(anchor, rotation).forEach((cell, i) => {
      if (grid[cell.row]?.[cell.col] !== undefined) {
        grid[cell.row][cell.col] = { ...group.cells[i] };
      }
    });
  }
  return grid;
}

export function draftPlacementError(draft: MapDraft, anchor: Coord, rotation: number): string | null {
  const setup = { tiles: draftGrid(draft), placed: draft.tiles.length, origin: WORK_CENTER } as SetupState;
  return placementError(setup, anchor, rotation);
}

export function isLandAt(grid: Grid<Tile>, coord: Coord): boolean {
  const tile = grid[coord.row]?.[coord.col] ?? null;
  return tile !== null && isLand(tile);
}

export function isHillsAt(grid: Grid<Tile>, coord: Coord): boolean {
  return grid[coord.row]?.[coord.col]?.type === TileType.Hills;
}

export function draftTemples(draft: MapDraft, grid: Grid<Tile> = draftGrid(draft)): Coord[] {
  return (draft.temples ?? []).filter((coord) => isHillsAt(grid, coord));
}

export function draftCapitals(draft: MapDraft, grid: Grid<Tile> = draftGrid(draft)): Capital[] {
  return CLAN_ORDER.flatMap((clan) => {
    const coord = draft.capitals[clan];
    return coord !== undefined && isLandAt(grid, coord) ? [{ clan, coord }] : [];
  });
}

export function exportMap(draft: MapDraft): ExportedMap {
  const grid = draftGrid(draft);
  const cells = grid.flatMap((line, row) => line.flatMap((tile, col) => (tile === null ? [] : [{ col, row }])));
  const minRow = Math.min(...cells.map(({ row }) => row));
  const maxRow = Math.max(...cells.map(({ row }) => row));
  const firstCol = Math.min(...cells.map(({ col }) => col));
  const minCol = firstCol - (firstCol % 2);
  const maxCol = Math.max(...cells.map(({ col }) => col));
  const offset = cells.length === 0 ? { col: 0, row: 0 } : { col: minCol, row: minRow };
  const shift = ({ col, row }: Coord): Coord => ({ col: col - offset.col, row: row - offset.row });
  const layout =
    cells.length === 0
      ? []
      : Array.from({ length: maxRow - minRow + 1 }, (_, i) =>
          Array.from({ length: maxCol - minCol + 1 }, (_, j) => token(grid[minRow + i][minCol + j]))
            .map((cell, j, row) => (j === row.length - 1 ? cell : cell.padEnd(CELL_WIDTH)))
            .join("")
            .trimEnd(),
        );
  return {
    name: draft.name.trim() || "Custom map",
    players: draft.players,
    layout,
    capitals: draftCapitals(draft, grid).map(({ clan, coord }) => ({ clan, coord: shift(coord) })),
    ...(draft.temples === null ? {} : { temples: draftTemples(draft, grid).map(shift) }),
    bidding: draft.bidding,
    editor: { offset, tiles: draft.tiles.map((tile) => ({ ...tile, anchor: { ...tile.anchor } })) },
  };
}

export function importMap(value: unknown): MapDraft | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const map = value as Partial<ExportedMap>;
  const editor = map.editor;
  if (editor === undefined || !Array.isArray(editor.tiles) || !isCoord(editor.offset)) {
    return null;
  }
  const tiles = editor.tiles.filter(
    (tile): tile is PlacedTile => tileGroup(tile?.id) !== undefined && isCoord(tile.anchor) && Number.isInteger(tile.rotation),
  );
  const unshift = ({ col, row }: Coord): Coord => ({ col: col + editor.offset.col, row: row + editor.offset.row });
  const capitals: Partial<Record<Clan, Coord>> = {};
  for (const capital of Array.isArray(map.capitals) ? map.capitals : []) {
    if ((Object.values(Clan) as string[]).includes(capital?.clan) && isCoord(capital.coord)) {
      capitals[capital.clan] = unshift(capital.coord);
    }
  }
  const players = Number.isInteger(map.players) ? Math.min(MAX_MAP_PLAYERS, Math.max(MIN_MAP_PLAYERS, map.players!)) : MIN_MAP_PLAYERS;
  return {
    name: typeof map.name === "string" ? map.name : "Custom map",
    players,
    bidding: map.bidding === true,
    tiles,
    capitals,
    temples: Array.isArray(map.temples) ? map.temples.filter(isCoord).map(unshift) : null,
  };
}

export function hasCoord(coords: readonly Coord[], coord: Coord): boolean {
  return coords.some((other) => coordKey(other) === coordKey(coord));
}

function token(tile: Tile | null): string {
  if (tile === null) {
    return "_";
  }
  return tile.name === undefined ? SYMBOLS[tile.type] : `${SYMBOLS[tile.type]}:${tile.name}`;
}

function isCoord(value: unknown): value is Coord {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const { col, row } = value as Record<string, unknown>;
  return Number.isInteger(col) && Number.isInteger(row);
}
