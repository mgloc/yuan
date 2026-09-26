import { describe, expect, it } from "vitest";
import { Building, Clan, type GameState, type Plan, type PlayerId } from "../../game_types.ts";
import { provinceAt } from "../tile/coords.ts";
import { resolveTurn } from "./resolve.ts";
import { at, city, plan, testGame, village } from "./testing.ts";

const resolve = (game: GameState, plans: [PlayerId, Plan][]) => resolveTurn(game, new Map(plans)).state;
const attack = (col: number, level: 1 | 2 | 3 = 1, row = 0) => plan(at(col, row), { Militarisation: level });
const owners = (game: GameState, cols: number[], row = 0) => cols.map((col) => provinceAt(game, at(col, row))?.owner ?? null);
const armies = (game: GameState, col: number, row = 0) => provinceAt(game, at(col, row))!.armies;

describe("attack", () => {
  it("takes an undefended Province and moves the Armies in", () => {
    const game = testGame(["H H H"], { provinces: { "0,0": city(0, { armies: 2 }), "1,0": village(1), "2,0": city(1) } });
    const state = resolve(game, [[0, attack(1)]]);
    expect(owners(state, [0, 1, 2])).toEqual([0, 0, 1]);
    expect([armies(state, 0), armies(state, 1)]).toEqual([0, 2]);
    expect(provinceAt(state, at(1))!.building).toBe(Building.Village);
  });

  it("lets the defender win ties", () => {
    const game = testGame(["H H H"], { provinces: { "0,0": city(0, { armies: 2 }), "1,0": village(1, { armies: 2 }), "2,0": city(1) } });
    const state = resolve(game, [[0, attack(1)]]);
    expect(owners(state, [1])).toEqual([1]);
    expect([armies(state, 0), armies(state, 1)]).toEqual([0, 0]);
  });

  it("needs more strength than a fortified City's defence", () => {
    const provinces = (count: number) => ({ "0,0": city(0, { armies: count }), "1,0": city(1, { ramparts: 1 }) });
    expect(owners(resolve(testGame(["H H"], { provinces: provinces(2) }), [[0, attack(1)]]), [1])).toEqual([1]);
    expect(owners(resolve(testGame(["H H"], { provinces: provinces(3) }), [[0, attack(1)]]), [1])).toEqual([0]);
  });

  it("cannot destroy an indestructible City but kills its Armies", () => {
    const game = testGame(["H H"], { provinces: { "0,0": city(0, { armies: 3 }), "1,0": city(1, { ramparts: 2, armies: 1 }) } });
    const state = resolve(game, [[0, attack(1)]]);
    expect(owners(state, [1])).toEqual([1]);
    expect(armies(state, 1)).toBe(0);
  });

  it("gives defence 1 to Provinces next to an indestructible City", () => {
    const provinces = (count: number) => ({ "0,0": city(0, { armies: count }), "1,0": village(1), "2,0": city(1, { ramparts: 2 }) });
    expect(owners(resolve(testGame(["H H H"], { provinces: provinces(1) }), [[0, attack(1)]]), [1])).toEqual([1]);
    expect(owners(resolve(testGame(["H H H"], { provinces: provinces(2) }), [[0, attack(1)]]), [1])).toEqual([0]);
  });

  it("adds a reserve Army at level II", () => {
    const game = testGame(["H H H"], { provinces: { "0,0": city(0, { armies: 1 }), "1,0": village(1, { armies: 1 }), "2,0": city(1) } });
    const state = resolve(game, [[0, attack(1, 2)]]);
    expect(owners(state, [1])).toEqual([0]);
    expect(armies(state, 1)).toBe(1);
  });

  it("cannot start with a reserve Army alone", () => {
    const game = testGame(["H H H"], { provinces: { "0,0": city(0), "1,0": village(1), "2,0": city(1) } });
    const { state, events } = resolveTurn(game, new Map([[0, attack(1, 2)]]));
    expect(owners(state, [1])).toEqual([1]);
    expect(events).toContainEqual(expect.objectContaining({ type: "ActionFailed", reason: "no Army adjacent or connected" }));
  });

  it("takes the Villages of a group left without a City", () => {
    const game = testGame(["H H H H"], {
      provinces: { "0,0": city(0, { armies: 2 }), "1,0": city(1), "2,0": village(1, { armies: 1 }), "3,0": village(1) },
    });
    const state = resolve(game, [[0, attack(1)]]);
    expect(owners(state, [0, 1, 2, 3])).toEqual([0, 0, 0, 0]);
    expect(armies(state, 2)).toBe(0);
  });

  it("resolves mutual attacks like the rulebook example", () => {
    const game = testGame(["H H H H H"], {
      provinces: {
        "0,0": city(0, { armies: 2 }),
        "1,0": city(1),
        "2,0": village(1, { armies: 2 }),
        "3,0": village(0),
        "4,0": city(0),
      },
    });
    const state = resolve(game, [
      [0, attack(1)],
      [1, attack(3)],
    ]);
    expect(owners(state, [0, 1, 2, 3, 4])).toEqual([0, 0, 0, 1, 0]);
    expect(provinceAt(state, at(3))!.building).toBe(Building.City);
  });

  it("makes rival attackers fight each other first", () => {
    const game = testGame(["H H H"], {
      provinces: { "0,0": city(0, { armies: 3 }), "1,0": village(1), "2,0": city(2, { armies: 2 }) },
      players: [{}, {}, {}],
    });
    const state = resolve(game, [
      [0, attack(1)],
      [2, attack(1)],
    ]);
    expect(owners(state, [1])).toEqual([0]);
    expect(armies(state, 1)).toBe(1);
  });

  it("gives each attacker the Villages it isolated", () => {
    const game = testGame(["H H H H H", "~ ~ ~ ~ ~", "H _ _ _ H"], {
      provinces: {
        "0,0": village(1),
        "1,0": village(1),
        "2,0": city(1),
        "3,0": village(1),
        "4,0": village(1),
        "0,2": city(0, { armies: 2 }),
        "4,2": city(2, { armies: 2 }),
      },
      players: [{}, {}, {}],
    });
    const state = resolve(game, [
      [0, attack(1)],
      [2, attack(3)],
    ]);
    expect(owners(state, [0, 1, 2, 3, 4])).toEqual([0, 0, 1, 2, 2]);
  });

  it("strikes adjacent undefended enemies at level III", () => {
    const game = testGame(["H H H H"], {
      provinces: { "0,0": city(0, { armies: 2 }), "1,0": village(1), "2,0": city(1), "3,0": village(1) },
    });
    const state = resolve(game, [[0, attack(1, 3)]]);
    expect(owners(state, [0, 1, 2, 3])).toEqual([0, 0, 0, 0]);
  });

  it("fortifies the conquered Province, now a City, after the attack", () => {
    const game = testGame(["H ~ H H"], { provinces: { "0,0": city(0, { armies: 2 }), "2,0": village(1), "3,0": city(1) } });
    const state = resolve(game, [[0, plan(at(2), { Militarisation: 1, Fortification: 2 })]]);
    expect(provinceAt(state, at(2))).toMatchObject({ owner: 0, building: Building.City, doubled: true, ramparts: 1 });
  });

  it("gives Xiangi +2 defence between two Mountains with clan powers", () => {
    const layout = ["^ H ^", "_ ~ _", "_ H _"];
    const provinces = { "1,2": city(0, { armies: 3 }), "1,0": city(1, { armies: 1 }) };
    const target = attack(1, 1, 0);
    expect(owners(resolve(testGame(layout, { provinces, clanPowers: true }), [[0, target]]), [1])).toEqual([1]);
    expect(owners(resolve(testGame(layout, { provinces }), [[0, target]]), [1])).toEqual([0]);
  });

  it("lets Weyu Armies cross a Mountain with clan powers", () => {
    const options = (clanPowers: boolean) => ({
      provinces: { "0,0": city(0, { armies: 2 }), "2,0": village(1) },
      players: [{ clan: Clan.Weyu }, {}],
      clanPowers,
    });
    expect(owners(resolve(testGame(["H ^ H"], options(true)), [[0, attack(2)]]), [2])).toEqual([0]);
    expect(owners(resolve(testGame(["H ^ H"], options(false)), [[0, attack(2)]]), [2])).toEqual([1]);
  });
});
