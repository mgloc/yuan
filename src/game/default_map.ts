import { Building, TileType, type Board, type Coord, type PlayerId } from "../game_types.ts";
import { parseBoard } from "./board_layout.ts";
import { allCoords, provinceAt, tileAt } from "./tile/coords.ts";

const LAYOUT = [
  "R M F ~ ~ H R R",
  "F H R ^ ~ F M F",
  "M ~ R F R ^ H R",
  "~ F H V H R ~ F",
  "H R ^ M F R M ~",
  "F M R ~ R ^ F R",
  "R F ~ ~ M H R M",
];

const NAMES = [
  "Altai", "Bao", "Cao", "Cheng", "Dalan", "Erdene", "Ge", "Govi", "Hov", "Huo", "Ju", "Khar", "Li", "Mand",
  "Nairam", "Olon", "Ordos", "Qing", "Ruo", "Sain", "Shen", "Tamir", "Tian", "Tuul", "Ulaan", "Wei", "Xan",
  "Xuan", "Yan", "Yeke", "Yun", "Zaya", "Zhao", "Zhen", "Zun", "Borgi", "Chuluun", "Delger", "Gan",
];

export const STARTING_CITIES: readonly Coord[] = [
  { col: 0, row: 0 },
  { col: 7, row: 6 },
  { col: 7, row: 0 },
  { col: 0, row: 6 },
];

export const MAX_PLAYERS = STARTING_CITIES.length;

export function createDefaultBoard(players: PlayerId[]): Board {
  let next = 0;
  const board = parseBoard(LAYOUT, () => NAMES[next++ % NAMES.length]);
  for (const coord of allCoords(board)) {
    const province = provinceAt(board, coord);
    if (province !== null && tileAt(board, coord)?.type === TileType.Hills) {
      province.temple = true;
    }
  }
  players.forEach((player, i) => {
    const province = provinceAt(board, STARTING_CITIES[i])!;
    province.owner = player;
    province.building = Building.City;
  });
  return board;
}
