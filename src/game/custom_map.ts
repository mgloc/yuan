import { Clan, isLand, TileType, type Coord } from "../game_types.ts";
import { parseCell } from "./board_layout.ts";
import type { Capital, PrebuiltMap } from "./default_map.ts";
import { MAX_TEMPLES } from "./setup/setup.ts";
import { coordKey } from "./tile/coords.ts";

const MAX_ROWS = 40;
const MAX_COLS = 40;
const MAX_NAME_LENGTH = 40;
const MAX_LINE_LENGTH = 800;

export interface CustomMapSummary {
  name: string;
  players: number | null;
  provinces: number;
  capitals: Capital[];
  temples: number | null;
  bidding: boolean;
}

export function parseCustomMap(value: unknown): PrebuiltMap | string {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return "The map must be a JSON object";
  }
  const raw = value as Record<string, unknown>;
  const name = typeof raw.name === "string" && raw.name.trim() !== "" ? raw.name.trim().slice(0, MAX_NAME_LENGTH) : "Custom map";
  const layout = raw.layout;
  if (!Array.isArray(layout) || layout.length === 0 || layout.length > MAX_ROWS) {
    return `The layout must have 1 to ${MAX_ROWS} rows`;
  }
  if (!layout.every((line) => typeof line === "string" && line.length <= MAX_LINE_LENGTH)) {
    return "Every layout row must be text";
  }
  const grid: (TileType | null)[][] = [];
  const rows: string[] = [];
  try {
    for (const line of layout as string[]) {
      const tokens = line.trim().split(/\s+/).filter(Boolean);
      if (tokens.length > MAX_COLS) {
        return `The layout can be at most ${MAX_COLS} cells wide`;
      }
      grid.push(tokens.map((token) => parseCell(token)?.type ?? null));
      rows.push(tokens.join(" "));
    }
  } catch (error) {
    return (error as Error).message;
  }
  const typeAt = ({ col, row }: Coord) => grid[row]?.[col] ?? null;
  const land = (coord: Coord) => {
    const type = typeAt(coord);
    return type !== null && isLand({ type });
  };
  if (!grid.some((line, row) => line.some((_, col) => land({ col, row })))) {
    return "The map has no Province";
  }

  let capitals: Capital[] | undefined;
  if (raw.capitals !== undefined) {
    if (!Array.isArray(raw.capitals)) {
      return "Capitals must be a list";
    }
    capitals = [];
    for (const capital of raw.capitals as unknown[]) {
      const { clan, coord } = (capital ?? {}) as Record<string, unknown>;
      if (!(Object.values(Clan) as unknown[]).includes(clan) || !isCoord(coord) || !land(coord)) {
        return "Every Capital needs a Clan and a Province";
      }
      if (capitals.some((other) => other.clan === clan || coordKey(other.coord) === coordKey(coord))) {
        return "Two Capitals share a Clan or a Province";
      }
      capitals.push({ clan: clan as Clan, coord: { col: coord.col, row: coord.row } });
    }
  }

  let temples: Coord[] | undefined;
  if (raw.temples !== undefined) {
    if (!Array.isArray(raw.temples) || !raw.temples.every(isCoord)) {
      return "Temples must be a list of coordinates";
    }
    const unique = new Map((raw.temples as Coord[]).map(({ col, row }) => [coordKey({ col, row }), { col, row }]));
    temples = [...unique.values()];
    if (temples.some((coord) => typeAt(coord) !== TileType.Hills)) {
      return "Temples can only stand on Hills";
    }
    if (temples.length > MAX_TEMPLES) {
      return `There are only ${MAX_TEMPLES} Temples`;
    }
  }

  const players = Number.isInteger(raw.players) ? (raw.players as number) : undefined;
  return {
    name,
    layout: rows,
    ...(capitals === undefined || capitals.length === 0 ? {} : { capitals }),
    ...(temples === undefined ? {} : { temples }),
    ...(raw.bidding === true ? { bidding: true } : {}),
    ...(players === undefined ? {} : { players }),
  };
}

export function summariseMap(map: PrebuiltMap & { players?: number }): CustomMapSummary {
  const provinces = map.layout.reduce(
    (total, line) => total + line.trim().split(/\s+/).filter((token) => /^[RFMH](:|$)/.test(token)).length,
    0,
  );
  return {
    name: map.name,
    players: map.players ?? null,
    provinces,
    capitals: [...(map.capitals ?? [])],
    temples: map.temples === undefined ? null : map.temples.length,
    bidding: map.bidding === true,
  };
}

function isCoord(value: unknown): value is Coord {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const { col, row } = value as Record<string, unknown>;
  return Number.isInteger(col) && Number.isInteger(row);
}
