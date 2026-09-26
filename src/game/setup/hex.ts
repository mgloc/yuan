import type { Coord } from "../../game_types.ts";

export interface Axial {
  q: number;
  r: number;
}

export const DIRECTIONS: readonly Axial[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export function toAxial({ col, row }: Coord): Axial {
  return { q: col, r: row - Math.floor(col / 2) };
}

export function toCoord({ q, r }: Axial): Coord {
  return { col: q, row: r + Math.floor(q / 2) };
}

export function step(coord: Coord, direction: number): Coord {
  const { q, r } = toAxial(coord);
  const delta = DIRECTIONS[((direction % 6) + 6) % 6];
  return toCoord({ q: q + delta.q, r: r + delta.r });
}

export function ringAround(coord: Coord): Coord[] {
  return DIRECTIONS.map((_, direction) => step(coord, direction));
}
