import { describe, expect, it } from "vitest";
import { Building, Clan, TileType } from "../../game_types.ts";
import { provinceAt } from "../tile/coords.ts";
import { ringAround } from "./hex.ts";
import {
  everyoneAgreed,
  handOver,
  MAX_TEMPLES,
  newSetup,
  nextStage,
  placementError,
  placeTile,
  setAgreed,
  setCity,
  SetupStage,
  setupBoard,
  tileCells,
  toggleTemple,
  WORK_CENTER,
  type SetupState,
} from "./setup.ts";
import { tileGroup } from "./tile_groups.ts";

const fixed = () => 0.42;

function placeAnywhere(setup: SetupState, active: number[]) {
  const player = setup.turn!;
  const id = setup.hands[player][0];
  for (let row = 0; row < setup.tiles.length; row++) {
    for (let col = 0; col < setup.tiles[row].length; col++) {
      if (placementError(setup, { col, row }, 0) === null) {
        expect(placeTile(setup, player, id, { col, row }, 0, active)).toBeNull();
        return;
      }
    }
  }
  throw new Error("No room left");
}

function placeAll(players: number): SetupState {
  const setup = newSetup(players, fixed, false);
  const active = Array.from({ length: players }, (_, i) => i);
  while (setup.stage === SetupStage.Tiles) {
    placeAnywhere(setup, active);
  }
  return setup;
}

describe("tile dealing", () => {
  it("deals the tiles for the player count evenly", () => {
    expect(newSetup(2, fixed, false).hands.map((hand) => hand.length)).toEqual([4, 4]);
    expect(newSetup(3, fixed, false).hands.map((hand) => hand.length)).toEqual([4, 4, 4]);
    expect(newSetup(4, fixed, false).hands.map((hand) => hand.length)).toEqual([4, 4, 4, 3]);
  });
});

describe("tile placement", () => {
  it("rotates the ring of a tile", () => {
    const ring = ringAround(WORK_CENTER);
    expect(tileCells(WORK_CENTER, 0)).toEqual([WORK_CENTER, ...ring]);
    expect(tileCells(WORK_CENTER, 1)).toEqual([WORK_CENTER, ...ring.slice(1), ring[0]]);
  });

  it("starts at the centre, then requires touching without overlap", () => {
    const setup = newSetup(2, fixed, false);
    const [first, second] = [setup.hands[0][0], setup.hands[1][0]];
    expect(placeTile(setup, 0, first, { col: 2, row: 2 }, 0, [0, 1])).toBe("The first tile goes at the centre");
    expect(placeTile(setup, 1, second, WORK_CENTER, 0, [0, 1])).toBe("It is not your turn to place a tile");
    expect(placeTile(setup, 0, first, WORK_CENTER, 2, [0, 1])).toBeNull();
    expect(setup.tiles[WORK_CENTER.row][WORK_CENTER.col]).toEqual(tileGroup(first)!.cells[0]);
    expect(setup.turn).toBe(1);
    expect(placeTile(setup, 1, second, WORK_CENTER, 0, [0, 1])).toBe("The tile overlaps another tile");
    expect(placeTile(setup, 1, second, { col: 2, row: 2 }, 0, [0, 1])).toBe("The tile must touch a placed tile");
    expect(placeTile(setup, 1, first, { col: 13, row: 10 }, 0, [0, 1])).toBe("This tile is not in your hand");
    expect(placeTile(setup, 1, second, { col: 13, row: 10 }, 0, [0, 1])).toBeNull();
  });

  it("moves on to Cities once every tile is placed, cropping the board with no Temples or Cities yet", () => {
    const setup = placeAll(3);
    expect(setup.stage).toBe(SetupStage.Cities);
    expect(setup.placed).toBe(12);
    expect(setup.tiles.flat().filter(Boolean)).toHaveLength(12 * 7);
    expect(setup.tiles.length).toBeLessThan(21);
    expect(setup.temples).toEqual([]);
    expect(setup.cities).toEqual([null, null, null]);
  });

  it("hands the tiles of a leaving player to the others", () => {
    const setup = newSetup(3, fixed, false);
    handOver(setup, 0, [1, 2]);
    expect(setup.hands.map((hand) => hand.length)).toEqual([0, 6, 6]);
    expect(setup.turn).toBe(1);
  });
});

describe("Cities and Temples by consensus", () => {
  it("needs a City per Clan on distinct Provinces before agreeing", () => {
    const setup = placeAll(2);
    const provinces = setup.tiles.flatMap((line, row) => line.flatMap((tile, col) => (tile && tile.name ? [{ col, row }] : [])));
    const water = setup.tiles.flatMap((line, row) => line.flatMap((tile, col) => (tile?.type === TileType.Water ? [{ col, row }] : [])));
    expect(setAgreed(setup, 0, true)).toBe("Every Clan needs a starting City");
    expect(setCity(setup, Clan.Suhey, water[0])).toBe("A City goes on a Province");
    expect(setCity(setup, Clan.Suhey, provinces[0])).toBeNull();
    expect(setCity(setup, Clan.Xiangi, provinces[0])).toBe("Another Clan already starts there");
    expect(setCity(setup, Clan.Xiangi, provinces[5])).toBeNull();
    expect(setAgreed(setup, 0, true)).toBeNull();
    expect(everyoneAgreed(setup, [0, 1])).toBe(false);
    setCity(setup, Clan.Xiangi, provinces[6]);
    expect(setup.agreed).toEqual([]);
    setAgreed(setup, 0, true);
    setAgreed(setup, 1, true);
    expect(everyoneAgreed(setup, [0, 1])).toBe(true);
    nextStage(setup);
    expect(setup.stage).toBe(SetupStage.Temples);

    const hills = provinces.filter(({ col, row }) => setup.tiles[row][col]!.type === TileType.Hills);
    const rice = provinces.find(({ col, row }) => setup.tiles[row][col]!.type === TileType.RiceField)!;
    expect(toggleTemple(setup, rice)).toBe("A Temple goes on Hills");
    expect(toggleTemple(setup, hills[0])).toBeNull();
    expect(toggleTemple(setup, hills[1])).toBeNull();
    expect(toggleTemple(setup, hills[1])).toBeNull();
    expect(setup.temples).toEqual([hills[0]]);
    nextStage(setup);
    expect(setup.stage).toBe(SetupStage.Clans);
    setup.owners = [1, 0];

    const board = setupBoard(setup);
    expect(provinceAt(board, provinces[0])).toMatchObject({ owner: 1, building: Building.City });
    expect(provinceAt(board, provinces[6])).toMatchObject({ owner: 0, building: Building.City });
    expect(board.provinces.flat().filter((province) => province?.temple)).toHaveLength(setup.temples.length);
  });

  it("caps the number of Temples", () => {
    const setup = placeAll(4);
    setup.stage = SetupStage.Temples;
    setup.tiles = [Array.from({ length: MAX_TEMPLES + 1 }, () => ({ type: TileType.Hills }))];
    setup.temples = [];
    const hills = setup.tiles[0].map((_, col) => ({ col, row: 0 }));
    hills.slice(0, MAX_TEMPLES).forEach((coord) => expect(toggleTemple(setup, coord)).toBeNull());
    expect(toggleTemple(setup, hills[MAX_TEMPLES])).toBe(`There are only ${MAX_TEMPLES} Temples`);
  });
});
