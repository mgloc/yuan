import { Building, TileType, type Board, type Coord, type PlayerId } from "../game_types.ts";
import { parseBoard } from "./board_layout.ts";
import { allCoords, coordKey, provinceAt, tileAt } from "./tile/coords.ts";

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

export interface PrebuiltMap {
  name: string;
  layout: readonly string[];
  cities?: readonly Coord[];
  temples?: readonly Coord[];
}

const DEFAULT_MAP: PrebuiltMap = { name: "Default", layout: LAYOUT, cities: STARTING_CITIES };

const RIVER_CONTROL: PrebuiltMap = {
  name: "River Control",
  layout: [
    "_       _       _       _       _       ^       _       H:Zong  M:Bayan ~       _       _       _       _",
    "_       ~       F:Huo   ~       H:Huan  R:Lu    R:Jin   F:Yang  ~       ^       _       _       _       _",
    "_       M:Li    F:Ju    R:Mand  ~       ^       M:Lai   H:Nie   ^       ^       F:Bul   R:Yu    _       _",
    "_       ~       V       M:Teng  ~       ~       M:Song  H:Xia   F:Ulan  V       ~       ~       _       _",
    "F:Mao   ^       ^       H:Wey   ~       ~       R:Tang  ^       ^       R:Ik    M:Ying  M:Zhou  ~       ~",
    "H:Khal  R:Liang ^       F:Gu    M:Xiang ^       ~       ~       ^       ~       R:Hov   ~       M:Bay   ^",
    "_       _       R:Fei   V       ^       R:Bao   H:Cheng F:Zav   ~       ~       H:Govi  F:Yi    R:Yan   _",
    "_       _       ~       ^       ^       ~       M:Xu    ^       ^       ~       R:Bogd  H:Zou   H:Tov   _",
    "_       ^       ^       H:Qin   M:Ge    ~       F:Altai F:Mi    H:Suh   ~       ~       M:Guza  R:Mou   _",
    "_       M:Wuz   ~       F:Tan   ^       H:Cao   ^       _       F:Ovor  _       _       _       _       _",
    "_       _       ^       _       _       _       _       _       _       _       _       _       _       _",
  ],
};

const CROSSING_THE_WATERS: PrebuiltMap = {
  name: "Crossing the Waters",
  layout: [
    "_       _       _       _       _       _       _       _       _       H:Cao   _       _       _",
    "_       _       _       ^       _       ^       R:Tang  M:Song  ^       ~       ^       _       _",
    "_       _       F:Tan   ~       M:Wuz   ^       H:Xia   H:Nie   F:Altai ~       M:Ge    R:Bogd  _",
    "_       _       H:Qin   ^       ^       ^       F:Ulan  ^       ^       ~       ~       H:Zou   F:Yi",
    "_       ^       ^       ^       V       ~       F:Bul   F:Mi    H:Suh   ~       M:Guza  R:Mou   H:Tov",
    "_       F:Gu    V       ~       M:Ying  ~       R:Yu    H:Wey   F:Ovor  ~       F:Zav   M:Xu    _",
    "_       _       R:Fei   H:Govi  ~       ~       M:Xiang ~       M:Teng  ~       H:Cheng R:Bao   _",
    "_       _       _       R:Hov   ~       ^       ~       ~       ~       ~       ^       _       _",
    "_       _       _       _       R:Ik    M:Bayan ~       ^       F:Mao   ^       ^       _       _",
    "_       _       _       _       _       H:Zong  ~       ^       H:Khal  R:Liang ^       _       _",
    "_       _       _       _       _       _       F:Yang  _       _       _       _       _       _",
  ],
  cities: [{ col: 8, row: 8 }, { col: 3, row: 7 }, { col: 10, row: 2 }],
};

export const PREBUILT_MAPS: Readonly<Record<number, PrebuiltMap>> = {
  2: DEFAULT_MAP,
  3: CROSSING_THE_WATERS,
  4: RIVER_CONTROL,
};

export function prebuiltMap(players: number): PrebuiltMap {
  return PREBUILT_MAPS[players] ?? DEFAULT_MAP;
}

export function prebuiltBoard(players: PlayerId[]): Board {
  const map = prebuiltMap(players.length);
  let next = 0;
  const board = parseBoard([...map.layout], () => NAMES[next++ % NAMES.length]);
  const temples = map.temples === undefined ? null : new Set(map.temples.map(coordKey));
  for (const coord of allCoords(board)) {
    const province = provinceAt(board, coord);
    if (province === null) {
      continue;
    }
    province.temple = temples === null ? tileAt(board, coord)?.type === TileType.Hills : temples.has(coordKey(coord));
  }
  players.forEach((player, i) => {
    const city = map.cities?.[i];
    const province = city === undefined ? null : provinceAt(board, city);
    if (province !== null) {
      province.owner = player;
      province.building = Building.City;
    }
  });
  return board;
}
