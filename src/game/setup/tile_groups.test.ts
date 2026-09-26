import { describe, expect, it } from "vitest";
import { Building, Clan, isLand, TileType } from "../../game_types.ts";
import { provinceAt } from "../tile/coords.ts";
import { prebuiltBoard, prebuiltCapitals } from "../default_map.ts";
import { toAxial, toCoord, DIRECTIONS } from "./hex.ts";
import { TILE_GROUPS, tileGroupsFor } from "./tile_groups.ts";

describe("Territory tiles", () => {
  it("has 15 tiles of 7 cells with unique Province names", () => {
    expect(TILE_GROUPS).toHaveLength(15);
    TILE_GROUPS.forEach((group) => expect(group.cells).toHaveLength(7));
    const names = TILE_GROUPS.flatMap((group) => group.cells.filter(isLand).map(({ name }) => name));
    expect(names.every(Boolean)).toBe(true);
    expect(new Set(names).size).toBe(names.length);
    expect(tileGroupsFor(2)).toHaveLength(8);
    expect(tileGroupsFor(3)).toHaveLength(12);
    expect(tileGroupsFor(4)).toHaveLength(15);
  });

  const occurrences = (players: number[]) => {
    const board = prebuiltBoard(players);
    const cells = board.tiles.flatMap((line, row) => line.flatMap((tile, col) => (tile === null ? [] : [{ col, row }])));
    const same = (a: { type: TileType; name?: string } | null | undefined, b: { type: TileType; name?: string }) =>
      a !== null && a !== undefined && a.type === b.type && a.name === b.name;
    const count = (id: string) => {
      const group = TILE_GROUPS.find((candidate) => candidate.id === id)!;
      return cells.flatMap(({ col, row }) =>
        Array.from({ length: 6 }, (_, rotation) => rotation).filter((rotation) => {
          const { q, r } = toAxial({ col, row });
          const ring = DIRECTIONS.map((_, i) => DIRECTIONS[(i + rotation) % 6]).map((d) => toCoord({ q: q + d.q, r: r + d.r }));
          return [{ col, row }, ...ring].every((coord, i) => same(board.tiles[coord.row]?.[coord.col], group.cells[i]));
        }),
      ).length;
    };
    return { board, cells, count };
  };

  it("matches River Control (4 players): every tile appears once and Temples sit on Hills", () => {
    const { board, cells, count } = occurrences([0, 1, 2, 3]);
    expect(cells).toHaveLength(105);
    TILE_GROUPS.forEach((group) => expect(count(group.id), group.id).toBe(1));
    const hills = cells.filter(({ col, row }) => board.tiles[row][col]!.type === TileType.Hills).length;
    expect(board.provinces.flat().filter((province) => province?.temple)).toHaveLength(hills);
    expect(board.provinces.flat().some((province) => province !== null && province.owner !== null)).toBe(false);
  });

  it("matches Crossing the Waters (3 players): the 3-player tiles once, with three capitals on Provinces", () => {
    const { board, cells, count } = occurrences([0, 1, 2]);
    expect(cells).toHaveLength(12 * 7);
    tileGroupsFor(3).forEach((group) => expect(count(group.id), group.id).toBe(1));
    ["B", "H", "J"].forEach((id) => expect(count(id), id).toBe(0));
    const capitals = prebuiltCapitals(3)!;
    expect(capitals.map(({ clan }) => clan)).toEqual([Clan.Mu, Clan.Xiangi, Clan.Weyu]);
    capitals.forEach(({ coord }) => expect(provinceAt(board, coord)).not.toBeNull());
    expect(board.provinces.flat().some((province) => province?.building === Building.City)).toBe(false);
  });
});
