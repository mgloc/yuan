import { Building, isLand, type Board, type Coord, type Grid, type PlayerId, type Tile } from "../../game_types.ts";
import { freeProvince } from "../board_layout.ts";
import { coordKey } from "../tile/coords.ts";
import { ringAround } from "./hex.ts";
import { tileGroup, tileGroupsFor, type TileGroupId } from "./tile_groups.ts";

export const SetupStage = {
  Tiles: "tiles",
  Cities: "cities",
  Temples: "temples",
} as const;

export type SetupStage = (typeof SetupStage)[keyof typeof SetupStage];

export const WORK_COLS = 23;
export const WORK_ROWS = 21;
export const WORK_CENTER: Coord = { col: 10, row: 10 };
export const MAX_TEMPLES = 18;
export const ROTATIONS = 6;

export interface SetupState {
  stage: SetupStage;
  tiles: Grid<Tile>;
  origin: Coord | null;
  hands: TileGroupId[][];
  turn: PlayerId | null;
  placed: number;
  total: number;
  cities: (Coord | null)[];
  temples: Coord[];
  agreed: PlayerId[];
  templesLocked?: boolean;
}

export function citySetup(board: Board, players: number): SetupState {
  const temples = board.provinces.flatMap((line, row) => line.flatMap((province, col) => (province?.temple ? [{ col, row }] : [])));
  return {
    stage: SetupStage.Cities,
    tiles: board.tiles,
    origin: null,
    hands: Array.from({ length: players }, () => []),
    turn: null,
    placed: 0,
    total: 0,
    cities: Array.from({ length: players }, () => null),
    temples,
    agreed: [],
    templesLocked: true,
  };
}

export function newSetup(players: number, random: () => number): SetupState {
  const groups = shuffle(tileGroupsFor(players).map(({ id }) => id), random);
  const hands: TileGroupId[][] = Array.from({ length: players }, () => []);
  groups.forEach((id, i) => hands[i % players].push(id));
  return {
    stage: SetupStage.Tiles,
    tiles: Array.from({ length: WORK_ROWS }, () => Array.from({ length: WORK_COLS }, () => null)),
    origin: WORK_CENTER,
    hands,
    turn: 0,
    placed: 0,
    total: groups.length,
    cities: Array.from({ length: players }, () => null),
    temples: [],
    agreed: [],
  };
}

export function tileCells(anchor: Coord, rotation: number): Coord[] {
  const ring = ringAround(anchor);
  return [anchor, ...ring.map((_, i) => ring[(i + rotation) % ROTATIONS])];
}

export function placementError(setup: SetupState, anchor: Coord, rotation: number): string | null {
  if (!Number.isInteger(rotation) || rotation < 0 || rotation >= ROTATIONS) {
    return "Invalid rotation";
  }
  if (setup.placed === 0 && coordKey(anchor) !== coordKey(setup.origin ?? WORK_CENTER)) {
    return "The first tile goes at the centre";
  }
  const cells = tileCells(anchor, rotation);
  if (cells.some((cell) => !inside(setup.tiles, cell))) {
    return "The tile goes off the table";
  }
  if (cells.some((cell) => setup.tiles[cell.row][cell.col] !== null)) {
    return "The tile overlaps another tile";
  }
  const keys = new Set(cells.map(coordKey));
  const touches = cells.some((cell) =>
    ringAround(cell).some((neighbor) => !keys.has(coordKey(neighbor)) && inside(setup.tiles, neighbor) && setup.tiles[neighbor.row][neighbor.col] !== null),
  );
  if (setup.placed > 0 && !touches) {
    return "The tile must touch a placed tile";
  }
  return null;
}

export function placeTile(setup: SetupState, player: PlayerId, id: TileGroupId, anchor: Coord, rotation: number, active: readonly PlayerId[]): string | null {
  if (setup.stage !== SetupStage.Tiles) {
    return "Tiles are already placed";
  }
  if (setup.turn !== player) {
    return "It is not your turn to place a tile";
  }
  const hand = setup.hands[player];
  const group = tileGroup(id);
  if (group === undefined || !hand.includes(id)) {
    return "This tile is not in your hand";
  }
  const error = placementError(setup, anchor, rotation);
  if (error !== null) {
    return error;
  }
  tileCells(anchor, rotation).forEach((cell, i) => (setup.tiles[cell.row][cell.col] = { ...group.cells[i] }));
  hand.splice(hand.indexOf(id), 1);
  setup.placed += 1;
  advanceTurn(setup, active);
  return null;
}

export function handOver(setup: SetupState, player: PlayerId, active: readonly PlayerId[]) {
  const others = active.filter((id) => id !== player);
  if (setup.stage !== SetupStage.Tiles || others.length === 0) {
    return;
  }
  setup.hands[player].splice(0).forEach((id, i) => setup.hands[others[i % others.length]].push(id));
  if (setup.turn === player) {
    advanceTurn(setup, others);
  }
}

export function setCity(setup: SetupState, clan: PlayerId, coord: Coord | null): string | null {
  if (setup.stage !== SetupStage.Cities) {
    return "Cities are not being placed";
  }
  if (clan < 0 || clan >= setup.cities.length) {
    return "Unknown Clan";
  }
  if (coord !== null) {
    if (!isProvince(setup.tiles, coord)) {
      return "A City goes on a Province";
    }
    if (setup.cities.some((city, other) => other !== clan && city !== null && coordKey(city) === coordKey(coord))) {
      return "Another Clan already starts there";
    }
  }
  setup.cities[clan] = coord;
  setup.agreed = [];
  return null;
}

export function toggleTemple(setup: SetupState, coord: Coord): string | null {
  if (setup.stage !== SetupStage.Temples || setup.templesLocked) {
    return "Temples are not being placed";
  }
  if (!isProvince(setup.tiles, coord)) {
    return "A Temple goes on a Province";
  }
  const index = setup.temples.findIndex((temple) => coordKey(temple) === coordKey(coord));
  if (index >= 0) {
    setup.temples.splice(index, 1);
  } else if (setup.temples.length >= MAX_TEMPLES) {
    return `There are only ${MAX_TEMPLES} Temples`;
  } else {
    setup.temples.push(coord);
  }
  setup.agreed = [];
  return null;
}

export function agreementError(setup: SetupState): string | null {
  if (setup.stage === SetupStage.Tiles) {
    return "Tiles are still being placed";
  }
  if (setup.stage === SetupStage.Cities && setup.cities.some((city) => city === null)) {
    return "Every Clan needs a starting City";
  }
  return null;
}

export function setAgreed(setup: SetupState, player: PlayerId, agreed: boolean): string | null {
  const error = agreed ? agreementError(setup) : null;
  if (error !== null) {
    return error;
  }
  setup.agreed = setup.agreed.filter((id) => id !== player);
  if (agreed) {
    setup.agreed.push(player);
  }
  return null;
}

export function everyoneAgreed(setup: SetupState, active: readonly PlayerId[]): boolean {
  return agreementError(setup) === null && active.every((player) => setup.agreed.includes(player));
}

export function nextStage(setup: SetupState): boolean {
  setup.agreed = [];
  if (setup.stage === SetupStage.Cities) {
    if (setup.templesLocked) {
      return true;
    }
    setup.stage = SetupStage.Temples;
    return false;
  }
  return setup.stage === SetupStage.Temples;
}

export function setupBoard(setup: SetupState): Board {
  const temples = new Set(setup.temples.map(coordKey));
  const provinces = setup.tiles.map((line, row) =>
    line.map((tile, col) => (tile !== null && isLand(tile) ? freeProvince({ temple: temples.has(coordKey({ col, row })) }) : null)),
  );
  setup.cities.forEach((city, player) => {
    const province = city === null ? null : provinces[city.row]?.[city.col];
    if (province) {
      province.owner = player;
      province.building = Building.City;
    }
  });
  return { tiles: setup.tiles.map((line) => line.map((tile) => (tile === null ? null : { ...tile }))), provinces };
}

function advanceTurn(setup: SetupState, active: readonly PlayerId[]) {
  const players = setup.hands.length;
  for (let offset = 1; offset <= players; offset++) {
    const candidate = ((setup.turn ?? -1) + offset) % players;
    if (active.includes(candidate) && setup.hands[candidate].length > 0) {
      setup.turn = candidate;
      return;
    }
  }
  const leftover = setup.hands.findIndex((hand, player) => hand.length > 0 && active.includes(player));
  if (leftover >= 0) {
    setup.turn = leftover;
    return;
  }
  finishTiles(setup);
}

function finishTiles(setup: SetupState) {
  setup.tiles = crop(setup.tiles);
  setup.origin = null;
  setup.turn = null;
  setup.stage = SetupStage.Cities;
  setup.temples = [];
  setup.agreed = [];
}

function crop(tiles: Grid<Tile>): Grid<Tile> {
  const used = tiles.flatMap((line, row) => line.flatMap((tile, col) => (tile === null ? [] : [{ col, row }])));
  if (used.length === 0) {
    return tiles;
  }
  const minRow = Math.min(...used.map(({ row }) => row));
  const maxRow = Math.max(...used.map(({ row }) => row));
  const minCol = Math.min(...used.map(({ col }) => col)) & ~1;
  const maxCol = Math.max(...used.map(({ col }) => col));
  return tiles.slice(minRow, maxRow + 1).map((line) => line.slice(minCol, maxCol + 1));
}

function inside(tiles: Grid<Tile>, { col, row }: Coord): boolean {
  return row >= 0 && row < tiles.length && col >= 0 && col < tiles[row].length;
}

function isProvince(tiles: Grid<Tile>, coord: Coord): boolean {
  if (!inside(tiles, coord)) {
    return false;
  }
  const tile = tiles[coord.row][coord.col];
  return tile !== null && isLand(tile);
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
