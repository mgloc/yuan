import { describe, expect, it } from "vitest";
import { Clan, TileType, type Board } from "../game_types.ts";
import { parseBoard } from "./board_layout.ts";
import { draftGrid, draftPlacementError, emptyDraft, exportMap, importMap, type MapDraft } from "./map_maker.ts";
import { WORK_CENTER } from "./setup/setup.ts";
import { step } from "./setup/hex.ts";
import { neighborCoords } from "./tile/neighbors.ts";

const twoTiles = (): MapDraft => ({
  ...emptyDraft(),
  name: "Test",
  tiles: [
    { id: "A", anchor: WORK_CENTER, rotation: 0 },
    { id: "N", anchor: step(step(step(WORK_CENTER, 0), 0), 5), rotation: 2 },
  ],
});

describe("map maker", () => {
  it("only accepts tiles touching the map", () => {
    const draft = twoTiles();
    expect(draftPlacementError(draft, WORK_CENTER, 0)).toBe("The tile overlaps another tile");
    expect(draftPlacementError(draft, { col: 2, row: 2 }, 0)).toBe("The tile must touch a placed tile");
    expect(draftPlacementError(emptyDraft(), { col: 3, row: 3 }, 0)).toBe("The first tile goes at the centre");
  });

  it("exports a layout that keeps the hex neighbours", () => {
    const draft = twoTiles();
    expect(exportMap(draft)).not.toHaveProperty("temples");
    draft.temples = draftGrid(draft).flatMap((line, row) => line.flatMap((tile, col) => (tile?.type === TileType.Hills ? [{ col, row }] : [])));
    const map = exportMap(draft);
    const exported = parseBoard([...map.layout], () => undefined);
    const work = { tiles: draftGrid(draft), provinces: [] };
    const neighbours = (board: Board) =>
      new Map(
        board.tiles.flatMap((line, row) =>
          line.flatMap((tile, col) =>
            tile?.name === undefined
              ? []
              : [[tile.name, neighborCoords(board, { col, row }).map((coord) => board.tiles[coord.row][coord.col]?.name ?? null).filter(Boolean).sort()] as const],
          ),
        ),
      );
    expect(neighbours(exported)).toEqual(neighbours(work));
    expect(neighbours(exported).size).toBe(9);
    expect(map.temples).toHaveLength(3);
    expect(map.temples!.every(({ col, row }) => exported.tiles[row][col]?.type === TileType.Hills)).toBe(true);
  });

  it("round-trips through JSON", () => {
    const draft = twoTiles();
    draft.capitals[Clan.Mu] = step(WORK_CENTER, 1);
    draft.players = 3;
    draft.bidding = true;
    const restored = importMap(JSON.parse(JSON.stringify(exportMap(draft))))!;
    expect(restored.tiles).toEqual(draft.tiles);
    expect(restored.capitals).toEqual({ [Clan.Mu]: step(WORK_CENTER, 1) });
    expect(restored.players).toBe(3);
    expect(restored.bidding).toBe(true);
    expect(exportMap(restored)).toEqual(exportMap(draft));
  });

  it("rejects JSON without editor data", () => {
    expect(importMap({ layout: [] })).toBeNull();
    expect(importMap("nope")).toBeNull();
  });
});
