import { describe, expect, it } from "vitest";
import { Clan } from "../../game_types.ts";
import { chooseClan, clanOfPlayer, clansAssigned, leaveBidding, placeBid, startClans } from "./bidding.ts";
import { citySetup, SetupStage, type SetupState } from "./setup.ts";
import { prebuiltBoard } from "../default_map.ts";

const capitals = [
  { clan: Clan.Mu, coord: { col: 0, row: 0 } },
  { clan: Clan.Xiangi, coord: { col: 7, row: 6 } },
  { clan: Clan.Weyu, coord: { col: 7, row: 0 } },
];

function bidding(players = 3, random = () => 0.5): SetupState {
  const setup = citySetup(prebuiltBoard([]), capitals.slice(0, players), players, true);
  startClans(setup, players, Array.from({ length: players }, (_, i) => i), random);
  return setup;
}

describe("clan draw without bidding", () => {
  it("gives every player a random Clan", () => {
    const setup = citySetup(prebuiltBoard([]), capitals, 3, false);
    startClans(setup, 3, [0, 1, 2], () => 0.99);
    expect(clansAssigned(setup)).toBe(true);
    expect([0, 1, 2].map((player) => clanOfPlayer(setup, player)).sort()).toEqual([Clan.Mu, Clan.Weyu, Clan.Xiangi]);
    expect(setup.bidding).toBeNull();
  });
});

describe("bidding for capitals", () => {
  it("keeps bids hidden until everyone has bid, then the highest pays and chooses", () => {
    const setup = bidding();
    expect(setup.stage).toBe(SetupStage.Clans);
    expect(setup.bidding!.contenders).toEqual([0, 1, 2]);
    expect(placeBid(setup, 0, 7, Math.random)).toBe("Bid between 0 and 6 Chão");
    expect(placeBid(setup, 0, 2, Math.random)).toBeNull();
    expect(placeBid(setup, 0, 3, Math.random)).toBe("You already placed your bid");
    expect(placeBid(setup, 1, 4, Math.random)).toBeNull();
    expect(setup.bidding!.history).toEqual([]);
    expect(placeBid(setup, 2, 1, Math.random)).toBeNull();
    expect(setup.bidding!.chooser).toBe(1);
    expect(setup.bidding!.chao).toEqual([6, 2, 6]);
    expect(setup.bidding!.history[0]).toMatchObject({ winner: 1, random: false });
    expect(chooseClan(setup, 0, Clan.Mu, 3, [0, 1, 2], Math.random)).toBe("It is not your turn to choose a Clan");
    expect(chooseClan(setup, 1, Clan.Suhey, 3, [0, 1, 2], Math.random)).toBe("This Clan is not available");
    expect(chooseClan(setup, 1, Clan.Weyu, 3, [0, 1, 2], Math.random)).toBeNull();
    expect(clanOfPlayer(setup, 1)).toBe(Clan.Weyu);
    expect(setup.bidding!.contenders).toEqual([0, 2]);
    placeBid(setup, 0, 0, Math.random);
    placeBid(setup, 2, 3, Math.random);
    chooseClan(setup, 2, Clan.Xiangi, 3, [0, 1, 2], Math.random);
    expect(clansAssigned(setup)).toBe(true);
    expect(clanOfPlayer(setup, 0)).toBe(Clan.Mu);
    expect(setup.bidding!.chao).toEqual([6, 2, 3]);
  });

  it("makes tied players re-bid, then draws at random when they tie on everything they have", () => {
    const setup = bidding(3, () => 0.99);
    placeBid(setup, 0, 3, Math.random);
    placeBid(setup, 1, 3, Math.random);
    placeBid(setup, 2, 1, Math.random);
    expect(setup.bidding!.chooser).toBeNull();
    expect(setup.bidding!.contenders).toEqual([0, 1]);
    expect(setup.bidding!.tieBreak).toBe(true);
    expect(placeBid(setup, 2, 1, Math.random)).toBe("You are not bidding this round");
    placeBid(setup, 0, 6, () => 0.99);
    placeBid(setup, 1, 6, () => 0.99);
    expect(setup.bidding!.history.at(-1)).toMatchObject({ winner: 1, random: true });
    expect(setup.bidding!.chooser).toBe(1);
    expect(setup.bidding!.chao[1]).toBe(0);
  });

  it("re-bids again when the tie is below everything the players have", () => {
    const setup = bidding(2);
    placeBid(setup, 0, 2, Math.random);
    placeBid(setup, 1, 2, Math.random);
    placeBid(setup, 0, 4, Math.random);
    placeBid(setup, 1, 4, Math.random);
    expect(setup.bidding!.chooser).toBeNull();
    expect(setup.bidding!.contenders).toEqual([0, 1]);
    placeBid(setup, 0, 5, Math.random);
    placeBid(setup, 1, 4, Math.random);
    expect(setup.bidding!.chooser).toBe(0);
    chooseClan(setup, 0, Clan.Xiangi, 2, [0, 1], Math.random);
    expect(clanOfPlayer(setup, 1)).toBe(Clan.Mu);
    expect(setup.bidding!.chao).toEqual([1, 6]);
  });

  it("lets a leaving player get a leftover Clan without blocking the others", () => {
    const setup = bidding();
    placeBid(setup, 0, 2, Math.random);
    leaveBidding(setup, 2, 3, [0, 1], Math.random);
    expect(setup.bidding!.contenders).toEqual([0, 1]);
    placeBid(setup, 1, 1, Math.random);
    expect(setup.bidding!.chooser).toBe(0);
    chooseClan(setup, 0, Clan.Mu, 3, [0, 1], Math.random);
    expect(clansAssigned(setup)).toBe(true);
    expect(clanOfPlayer(setup, 0)).toBe(Clan.Mu);
  });
});
