import { isLand, TileType, type Board, type Coord } from "../../game_types.ts";
import { coordKey, tileAt } from "./coords.ts";
import { neighborCoords } from "./neighbors.ts";

function isWater(board: Board, coord: Coord): boolean {
  return tileAt(board, coord)?.type === TileType.Water;
}

function isProvince(board: Board, coord: Coord): boolean {
  const tile = tileAt(board, coord);
  return tile !== null && isLand(tile);
}

export function waterBodyFrom(board: Board, start: Coord): Coord[] {
  if (!isWater(board, start)) {
    return [];
  }
  const visited = new Set([coordKey(start)]);
  const body = [start];
  for (let i = 0; i < body.length; i++) {
    for (const neighbor of neighborCoords(board, body[i])) {
      const key = coordKey(neighbor);
      if (!visited.has(key) && isWater(board, neighbor)) {
        visited.add(key);
        body.push(neighbor);
      }
    }
  }
  return body;
}

export function connectedWithin(board: Board, from: Coord, maxWaterCells: number): Coord[] {
  const fromKey = coordKey(from);
  const visitedWater = new Set<string>();
  const provinces = new Map<string, Coord>();
  let frontier = neighborCoords(board, from).filter((neighbor) => isWater(board, neighbor));
  frontier.forEach((water) => visitedWater.add(coordKey(water)));

  for (let depth = 1; depth <= maxWaterCells && frontier.length > 0; depth++) {
    const next: Coord[] = [];
    for (const water of frontier) {
      for (const neighbor of neighborCoords(board, water)) {
        const key = coordKey(neighbor);
        if (isProvince(board, neighbor)) {
          if (key !== fromKey) {
            provinces.set(key, neighbor);
          }
        } else if (isWater(board, neighbor) && !visitedWater.has(key)) {
          visitedWater.add(key);
          next.push(neighbor);
        }
      }
    }
    frontier = next;
  }
  return [...provinces.values()];
}

export function connectedProvinces(board: Board, from: Coord): Coord[] {
  return connectedWithin(board, from, Infinity);
}

export function isConnected(board: Board, a: Coord, b: Coord): boolean {
  const target = coordKey(b);
  return connectedProvinces(board, a).some((province) => coordKey(province) === target);
}
