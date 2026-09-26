import { describe, expect, it } from "vitest";
import { Clan } from "../game_types.ts";
import { createGame } from "./setup.ts";
import { createTestBoard } from "./test_board.ts";

const chao = (clanPowers: boolean, bidding = false) =>
  createGame(createTestBoard(), [Clan.Mu, Clan.Suhey, Clan.Weyu], { clanPowers, bidding }).players.map((player) => player.chao);

describe("createGame", () => {
  it("applies the starting Chão modifiers only with clan rules", () => {
    expect(chao(true)).toEqual([2, 3, 4]);
    expect(chao(false)).toEqual([4, 4, 4]);
  });

  it("ignores the modifiers when bidding", () => {
    expect(chao(true, true)).toEqual([6, 6, 6]);
  });
});
