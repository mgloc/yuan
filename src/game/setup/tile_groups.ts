import type { Tile } from "../../game_types.ts";
import { parseCell } from "../board_layout.ts";

export type TileGroupId = string;

export interface TileGroup {
  id: TileGroupId;
  minPlayers: number;
  cells: readonly Tile[];
}

const DEFINITIONS: readonly [TileGroupId, number, string][] = [
  ["A", 2, "~ ^ F:Altai ~ M:Ge ^ H:Cao"],
  ["B", 4, "F:Ju R:Mand ~ F:Huo ~ M:Li V"],
  ["C", 2, "~ F:Tan H:Qin ^ ^ M:Wuz ^"],
  ["E", 3, "~ H:Govi R:Hov R:Ik ^ ~ ~"],
  ["F", 2, "^ ^ ^ ~ F:Mao H:Khal R:Liang"],
  ["G", 2, "H:Xia ^ F:Ulan H:Nie M:Song R:Tang ^"],
  ["H", 4, "M:Bay ^ ~ ~ M:Zhou ~ R:Yan"],
  ["I", 2, "V ^ ^ F:Gu R:Fei ~ ^"],
  ["J", 4, "R:Lu M:Lai R:Jin ^ H:Huan ~ ^"],
  ["K", 2, "H:Suh ~ ~ ^ ^ F:Mi F:Ovor"],
  ["L", 3, "~ ~ ~ ~ M:Teng H:Wey M:Xiang"],
  ["N", 2, "H:Zou R:Mou H:Tov F:Yi R:Bogd ~ M:Guza"],
  ["O", 3, "~ ~ R:Yu F:Bul ^ V M:Ying"],
  ["Q", 2, "H:Cheng F:Zav ~ ~ ^ R:Bao M:Xu"],
  ["W", 3, "~ ^ ~ M:Bayan H:Zong F:Yang ^"],
];

export const TILE_GROUPS: readonly TileGroup[] = DEFINITIONS.map(([id, minPlayers, cells]) => ({
  id,
  minPlayers,
  cells: cells.split(" ").map((token) => parseCell(token)!),
}));

export function tileGroup(id: TileGroupId): TileGroup | undefined {
  return TILE_GROUPS.find((group) => group.id === id);
}

export function tileGroupsFor(players: number): TileGroup[] {
  return TILE_GROUPS.filter((group) => group.minPlayers <= players);
}
