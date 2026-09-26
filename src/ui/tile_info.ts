import { ActionType, isLand, RESOURCE_TILE, type Coord, type GameInfo, type Province } from "../game_types.ts";
import { adjacentProvinces } from "../game/tile/adjacency.ts";
import { isAdjacentToVolcano } from "../game/tile/checks.ts";
import { provinceAt, tileAt } from "../game/tile/coords.ts";
import { connectedProvinces } from "../game/tile/water.ts";
import type { PanelContent } from "./info_panel.ts";

const RAMPART_LABELS = ["None", "Fortified", "Indestructible"] as const;

export function tileInfo(board: GameInfo, coord: Coord): PanelContent | null {
  const tile = tileAt(board, coord);
  if (tile === null) {
    return null;
  }
  const rows: PanelContent["rows"] = [
    ["Type", tile.type],
    ["Coord", `${coord.col}, ${coord.row}`],
  ];
  if (!isLand(tile)) {
    return { title: tile.type, rows };
  }

  const discount = Object.values(ActionType).find((action) => RESOURCE_TILE[action] === tile.type);
  if (discount) {
    rows.push(["Discounts", discount]);
  }

  const province = provinceAt(board, coord);
  if (province !== null) {
    rows.push(...provinceRows(board, province));
  }

  rows.push(
    ["Adjacent provinces", String(adjacentProvinces(board, coord).length)],
    ["Connected provinces", String(connectedProvinces(board, coord).length)],
  );
  if (isAdjacentToVolcano(board, coord)) {
    rows.push(["Near volcano", "Double production"]);
  }

  return { title: tile.name ?? tile.type, rows };
}

function provinceRows(game: GameInfo, province: Province): PanelContent["rows"] {
  const rows: PanelContent["rows"] = [
    ["Owner", game.players.find(({ id }) => id === province.owner)?.clan ?? "Free"],
    ["Building", province.building ?? "None"],
  ];
  if (province.doubled) {
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
