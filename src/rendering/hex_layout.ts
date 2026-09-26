import * as THREE from "three";
import type { Coord } from "../game_types.ts";

export const TILE_RADIUS = 2;
const TILE_STEP_X = 1.5 * TILE_RADIUS;
const TILE_STEP_Y = Math.sqrt(3) * TILE_RADIUS;

export function hexToWorld(col: number, row: number): THREE.Vector3 {
  const x = col * TILE_STEP_X;
  const y = (row + (col & 1 ? 0.5 : 0)) * TILE_STEP_Y;
  return new THREE.Vector3(x, y, 0);
}

export function worldToHex(x: number, y: number): Coord {
  const q = x / TILE_STEP_X;
  const r = y / TILE_STEP_Y - q / 2;
  const s = -q - r;
  let [rq, rr, rs] = [Math.round(q), Math.round(r), Math.round(s)];
  const [dq, dr, ds] = [Math.abs(rq - q), Math.abs(rr - r), Math.abs(rs - s)];
  if (dq > dr && dq > ds) {
    rq = -rr - rs;
  } else if (dr > ds) {
    rr = -rq - rs;
  }
  return { col: rq, row: rr + Math.floor(rq / 2) };
}
