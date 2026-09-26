import { isLand, type Coord, type GameInfo, type Province } from "../game_types.ts";
import { isAdjacentToVolcano } from "../game/tile/checks.ts";
import { provinceAt, tileAt } from "../game/tile/coords.ts";
import type { PanelContent } from "./info_panel.ts";

const RAMPART_LABELS = ["None", "Fortified", "Indestructible"] as const;

export function tileInfo(board: GameInfo, coord: Coord): PanelContent | null {
  const tile = tileAt(board, coord);
  if (tile === null) {
    return null;
  }
  const rows: PanelContent["rows"] = [["Type", tile.type]];
  if (!isLand(tile)) {
    return { title: tile.type, rows };
  }

  const nearVolcano = isAdjacentToVolcano(board, coord);
  const province = provinceAt(board, coord);
  if (province !== null) {
    rows.push(...provinceRows(board, province, nearVolcano));
  }

  return { title: tile.name ?? tile.type, rows, note: nearVolcano ? "Production is doubled, near to volcano!" : undefined };
}

function provinceRows(game: GameInfo, province: Province, nearVolcano: boolean): PanelContent["rows"] {
  const rows: PanelContent["rows"] = [
    ["Owner", game.players.find(({ id }) => id === province.owner)?.clan ?? "Free"],
    ["Building", province.building ?? "None"],
  ];
  if (province.doubled && !nearVolcano) {
    rows.push(["Production", "Doubled"]);
  }
  if (province.ramparts > 0) {
    rows.push(["Ramparts", RAMPART_LABELS[province.ramparts]]);
  }
  rows.push(["Armies", String(province.armies)]);
  if (province.temple) {
    rows.push(["Temple", "Yes"]);
  }
  return rows;
}
