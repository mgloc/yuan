import { describe, expect, it } from "vitest";
import { Building, Clan, type GameState, type Plan, type PlayerId } from "../../game_types.ts";
import { provinceAt } from "../tile/coords.ts";
import { resolveTurn } from "./resolve.ts";
import { at, city, plan, testGame, village } from "./testing.ts";
import { planErrors } from "./validation.ts";

const resolve = (game: GameState, plans: [PlayerId, Plan][]) => resolveTurn(game, new Map(plans));
const owner = (game: GameState, col: number, row = 0) => provinceAt(game, at(col, row))?.owner ?? null;
const chao = (game: GameState, player: PlayerId) => game.players.find(({ id }) => id === player)!.chao;

describe("colonisation", () => {
  it("takes the target and its free neighbours", () => {
    const game = testGame(["R R F M"], { provinces: { "0,0": city(0) } });
    const { state } = resolve(game, [[0, plan(at(1), { Development: 1 })]]);
    expect([0, 1, 2, 3].map((col) => owner(state, col))).toEqual([0, 0, 0, null]);
    expect(provinceAt(state, at(1))!.building).toBe(Building.Village);
  });

  it("needs adjacency or a connection below level III", () => {
    const game = testGame(["R F F M R"], { provinces: { "0,0": city(0) } });
    const { state, events } = resolve(game, [[0, plan(at(4), { Development: 1 })]]);
    expect(owner(state, 4)).toBeNull();
    expect(events).toContainEqual(expect.objectContaining({ type: "ActionFailed" }));
  });

  it("reaches anywhere at level III and urbanises an isolated target", () => {
    const game = testGame(["H F F M R"], { provinces: { "0,0": city(0) } });
    const { state } = resolve(game, [[0, plan(at(4), { Development: 3 })]]);
    expect(owner(state, 4)).toBe(0);
    expect(owner(state, 3)).toBe(0);
    expect(provinceAt(state, at(4))!.building).toBe(Building.City);
    expect(chao(state, 0)).toBe(3);
  });

  it("crosses any number of Water cells", () => {
    const game = testGame(["R ~ ~ ~ F"], { provinces: { "0,0": city(0) } });
    expect(owner(resolve(game, [[0, plan(at(4), { Development: 1 })]]).state, 4)).toBe(0);
  });

  it("limits Xiangi to 2 Water cells with clan powers", () => {
    const game = testGame(["R ~ ~ ~ F"], { provinces: { "0,0": city(1) }, clanPowers: true });
    expect(owner(resolve(game, [[1, plan(at(4), { Development: 1 })]]).state, 4)).toBeNull();
  });

  it("cancels colliding colonisations, refunds nothing and pays the pass income", () => {
    const game = testGame(["R F M"], { provinces: { "0,0": city(0), "2,0": city(1) } });
    const { state } = resolve(game, [
      [0, plan(at(1), { Development: 2, Fortification: 1 })],
      [1, plan(at(1), { Development: 3 })],
    ]);
    expect(owner(state, 1)).toBeNull();
    expect(chao(state, 0)).toBe(16);
    expect(chao(state, 1)).toBe(16);
  });

  it("gives priority to the Clan that targeted the Province", () => {
    const game = testGame(["H F ~ H"], { provinces: { "0,0": city(0), "3,0": city(1) } });
    const { state } = resolve(game, [
      [0, plan(at(0), { Development: 1 })],
      [1, plan(at(1), { Development: 1 })],
    ]);
    expect(owner(state, 1)).toBe(1);
  });

  it("leaves Provinces claimed by several Clans free", () => {
    const game = testGame(["R F M"], { provinces: { "0,0": city(0), "2,0": city(1) } });
    const { state } = resolve(game, [
      [0, plan(at(0), { Development: 1 })],
      [1, plan(at(2), { Development: 1 })],
    ]);
    expect(owner(state, 1)).toBeNull();
  });

  it("lets Suhey keep contested Provinces with clan powers", () => {
    const game = testGame(["R F M"], { provinces: { "0,0": city(0), "2,0": city(1) }, clanPowers: true });
    const { state } = resolve(game, [
      [0, plan(at(0), { Development: 1 })],
      [1, plan(at(2), { Development: 1 })],
    ]);
    expect(owner(state, 1)).toBe(0);
  });

  it("stops when the Village pool is empty", () => {
    const layout = ["R R R R R R R R R R R R R R R R R R R R R"];
    const provinces = Object.fromEntries(Array.from({ length: 18 }, (_, col) => [`${col},0`, col === 0 ? city(0) : village(0)]));
    const game = testGame(layout, { provinces: { ...provinces, "18,0": village(0) } });
    const { state, events } = resolve(game, [[0, plan(at(0), { Development: 1 })]]);
    expect(owner(state, 19)).toBeNull();
    expect(events).toContainEqual(expect.objectContaining({ type: "PoolExhausted", piece: "Village" }));
  });
});

describe("expansion", () => {
  it("takes the free neighbours of the whole group and pays income at level II", () => {
    const game = testGame(["F R R M"], { provinces: { "1,0": city(0), "2,0": village(0) } });
    const { state } = resolve(game, [[0, plan(at(1), { Development: 2 })]]);
    expect(owner(state, 0)).toBe(0);
    expect(owner(state, 3)).toBe(0);
    expect(chao(state, 0)).toBe(10 - 2 + 2);
  });

  it("builds a Temple and steals 2 Chão from adjacent Clans", () => {
    const game = testGame(["H F M"], { provinces: { "0,0": city(0), "1,0": village(0), "2,0": city(1) } });
    const { state } = resolve(game, [[0, plan(at(1), { Development: 3 })]]);
    expect(provinceAt(state, at(1))!.temple).toBe(true);
    expect(chao(state, 0)).toBe(10 - 7 + 2);
    expect(chao(state, 1)).toBe(8 + 6);
  });

  it("cancels mutual Temple steals", () => {
    const game = testGame(["H F"], { provinces: { "0,0": city(0), "1,0": city(1) } });
    const { state } = resolve(game, [
      [0, plan(at(0), { Development: 3 })],
      [1, plan(at(1), { Development: 3 })],
    ]);
    expect(chao(state, 0)).toBe(3);
    expect(chao(state, 1)).toBe(3);
  });

  it("shares a third Clan's Chão equally between Temple builders", () => {
    const game = testGame(["H F H"], {
      provinces: { "0,0": city(0), "1,0": city(2), "2,0": city(1) },
      players: [{}, {}, { chao: 3 }],
    });
    const { state } = resolve(game, [
      [0, plan(at(0), { Development: 3 })],
      [1, plan(at(2), { Development: 3 })],
    ]);
    expect(chao(state, 0)).toBe(4);
    expect(chao(state, 1)).toBe(4);
    expect(chao(state, 2)).toBe(1 + 6);
  });
});

describe("fortification", () => {
  it("turns a Village into a City at level II", () => {
    const game = testGame(["R F"], { provinces: { "0,0": city(0), "1,0": village(0) } });
    const { state } = resolve(game, [[0, plan(at(1), { Fortification: 2 })]]);
    expect(provinceAt(state, at(1))!.building).toBe(Building.City);
  });

  it("builds a fortified City with an Army at level III", () => {
    const game = testGame(["R F"], { provinces: { "0,0": city(0), "1,0": village(0) } });
    const province = provinceAt(resolve(game, [[0, plan(at(1), { Fortification: 3 })]]).state, at(1))!;
    expect(province).toMatchObject({ building: Building.City, ramparts: 1, armies: 1 });
  });

  it("doubles a City once", () => {
    const game = testGame(["R"], { provinces: { "0,0": city(0) } });
    const first = resolve(game, [[0, plan(at(0), { Fortification: 1 })]]).state;
    expect(provinceAt(first, at(0))!.doubled).toBe(true);
    const { events } = resolve(first, [[0, plan(at(0), { Fortification: 1 })]]);
    expect(events).toContainEqual(expect.objectContaining({ type: "ActionFailed", reason: "City is already doubled" }));
  });

  it("makes an indestructible City with an Army at level III", () => {
    const game = testGame(["R"], { provinces: { "0,0": city(0) } });
    const province = provinceAt(resolve(game, [[0, plan(at(0), { Fortification: 3 })]]).state, at(0))!;
    expect(province).toMatchObject({ ramparts: 2, armies: 1, doubled: false });
  });

  it("applies to the City created by a colonisation the same turn", () => {
    const game = testGame(["R F F M R"], { provinces: { "0,0": city(0) }, players: [{ chao: 20 }, {}] });
    const province = provinceAt(resolve(game, [[0, plan(at(4), { Development: 3, Fortification: 2 })]]).state, at(4))!;
    expect(province).toMatchObject({ building: Building.City, doubled: true, ramparts: 1 });
  });

  it("refunds a Fortification planned after an attack that did not succeed", () => {
    const game = testGame(["M F"], { provinces: { "0,0": city(0, { armies: 1 }), "1,0": village(1, { armies: 1 }) } });
    const { state, events } = resolve(game, [[0, plan(at(1), { Militarisation: 1, Fortification: 2 })]]);
    expect(events).toContainEqual(expect.objectContaining({ type: "Refunded", amount: 4 }));
    expect(chao(state, 0)).toBe(10);
  });
});

describe("militarisation", () => {
  it("recruits Armies and disbands the excess at upkeep", () => {
    const game = testGame(["M"], { provinces: { "0,0": city(0, { armies: 2 }) } });
    const { state, events } = resolve(game, [[0, plan(at(0), { Militarisation: 3 })]]);
    expect(provinceAt(state, at(0))!.armies).toBe(3);
    expect(events).toContainEqual(expect.objectContaining({ type: "ArmiesDisbanded", count: 2 }));
  });

  it("is limited by the Army pool", () => {
    const game = testGame(["M R R"], {
      provinces: { "0,0": city(0, { armies: 3 }), "1,0": city(0, { armies: 3 }), "2,0": city(0, { armies: 2 }) },
    });
    const { state } = resolve(game, [[0, plan(at(2), { Militarisation: 3 })]]);
    expect(provinceAt(state, at(2))!.armies).toBe(3);
  });
});

describe("turn", () => {
  it("pays discounted costs and the pass income", () => {
    const game = testGame(["R R F"], { provinces: { "0,0": city(0) } });
    const { state } = resolve(game, [[0, plan(at(0), { Development: 2 })]]);
    expect(chao(state, 0)).toBe(10 - 3 + 2);
    expect(chao(state, 1)).toBe(16);
    expect(state.turn).toBe(2);
  });

  it("empties Provinces next to a Volcano on eruption turns", () => {
    const game = testGame(["R V F"], { provinces: { "0,0": city(0, { armies: 2, temple: true }) }, turn: 5 });
    const province = provinceAt(resolve(game, []).state, at(0))!;
    expect(province).toMatchObject({ owner: null, building: null, armies: 0, temple: true });
  });

  it("declares the winner with the most Mines on a tie", () => {
    const game = testGame(["H M H F"], {
      provinces: { "0,0": city(0, { temple: true }), "1,0": village(0), "2,0": city(1, { temple: true }), "3,0": village(1) },
      turn: 13,
    });
    const { state } = resolve(game, [[1, plan(at(2), { Fortification: 1 })]]);
    expect(state.finished).toBe(true);
    expect(state.winner).toBe(0);
  });

  it("lets Mu win with enough Provinces under clan powers", () => {
    const provinces = Object.fromEntries(Array.from({ length: 12 }, (_, col) => [`${col},0`, village(0, { temple: col < 2 })]));
    const game = testGame(["H H R R R R R R R R R R"], {
      provinces: { ...provinces, "2,0": city(0) },
      players: [{ clan: Clan.Mu }, {}],
      clanPowers: true,
      turn: 13,
    });
    expect(resolve(game, []).state.winner).toBe(0);
  });

  it("rejects plans that cannot be paid", () => {
    const game = testGame(["R"], { provinces: { "0,0": city(0) }, players: [{ chao: 3 }, {}] });
    expect(planErrors(game, 0, plan(at(0), { Development: 3 }))).toContain("Not enough Chão");
    expect(planErrors(game, 0, plan(at(0), { Development: 1 }))).toEqual([]);
  });
});
