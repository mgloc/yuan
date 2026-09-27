import { describe, expect, it } from "vitest";
import { ActionType, type GameState } from "../../game_types.ts";
import { at, city, plan, testGame, village } from "../turn/testing.ts";
import { planEffects, type ActionEffect } from "./effects.ts";

const effect = (game: GameState, type: ActionType, level: 1 | 2 | 3, col: number) =>
  text(planEffects(game, 0, plan(at(col), { [type]: level }))[type][level]);

const text = ({ lines, coords }: ActionEffect) => ({ text: lines.join(" · "), coords });

describe("plan effects", () => {
  it("lists the Provinces a Colonisation takes", () => {
    const game = testGame(["R R R R"], { provinces: { "0,0": city(0) } });
    const { text, coords } = effect(game, ActionType.Development, 2, 2);
    expect(coords).toEqual([at(2), at(1), at(3)]);
    expect(text).toContain("Take P2 and 2 free neighbours");
    expect(text).toContain("+2₵ at Income");
    expect(text).not.toContain("becomes a City");
  });

  it("warns when a Colonisation starts a new group", () => {
    const game = testGame(["R R ~ R R"], { provinces: { "0,0": city(0) } });
    expect(effect(game, ActionType.Development, 1, 4).text).toContain("P4 becomes a City");
  });

  it("names the Clans a Temple steals from", () => {
    const game = testGame(["H H H"], { provinces: { "0,0": city(1), "1,0": city(0) } });
    const { text, coords } = effect(game, ActionType.Development, 3, 1);
    expect(text).toContain("Steal up to 2₵ from Xiangi");
    expect(coords).toEqual([at(0)]);
  });

  it("predicts the outcome of an Attack", () => {
    const defended = testGame(["H H"], { provinces: { "0,0": city(0, { armies: 2 }), "1,0": city(1, { ramparts: 1 }) } });
    expect(effect(defended, ActionType.Militarisation, 1, 1).text).toContain("2 Armies vs 0 Armies + defence 2 · Fails, needs 3 Armies");
    expect(effect(defended, ActionType.Militarisation, 2, 1).text).toContain("Wins with 3 Armies moving in");
  });

  it("shows the Villages taken when the last City of a group falls", () => {
    const game = testGame(["H H H"], { provinces: { "0,0": city(0, { armies: 1 }), "1,0": city(1), "2,0": village(1) } });
    const { text, coords } = effect(game, ActionType.Militarisation, 1, 1);
    expect(text).toContain("you also take 1 Province");
    expect(coords).toEqual([at(0), at(2)]);
  });

  it("warns about Armies over the limit", () => {
    const game = testGame(["H"], { provinces: { "0,0": city(0, { armies: 2 }) } });
    expect(effect(game, ActionType.Militarisation, 3, 0).text).toBe("+3 Armies, 2 disbanded at end of turn (max 3)");
  });

  it("marks a Fortification that depends on an Attack", () => {
    const game = testGame(["H H"], { provinces: { "0,0": city(0, { armies: 2 }), "1,0": village(1) } });
    const effects = planEffects(game, 0, plan(at(1), { Militarisation: 1, Fortification: 2 }));
    expect(effects.Fortification[2].lines).toEqual(["Village becomes a City", "Only if the attack succeeds, refunded otherwise"]);
  });

  it("falls back to the rules without a target", () => {
    const game = testGame(["H"]);
    const effects = planEffects(game, 0, { ...plan(at(0), {}), target: null });
    expect(effects.Fortification[1].lines).toEqual(["Urbanisation: no effect", "Reinforcement: second City, doubles production"]);
  });
});
