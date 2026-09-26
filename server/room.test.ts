import { describe, expect, it } from "vitest";
import { Building, Clan } from "../src/game_types.ts";
import { emptyPlan } from "../src/game/plan/plan.ts";
import { STARTING_CITIES } from "../src/game/default_map.ts";
import { provinceAt } from "../src/game/tile/coords.ts";
import { plan } from "../src/game/turn/testing.ts";
import { newRoomState, Room } from "./room.ts";

let tokens = 0;
const newRoom = (debug = false) => new Room(newRoomState("CODE", debug), () => `token-${tokens++}`);

function lobby(players: number, debug = false) {
  const room = newRoom(debug);
  const members = Array.from({ length: players }, (_, i) => room.join(`P${i}`));
  return { room, members, host: members[0].token };
}

describe("lobby", () => {
  it("assigns clans in join order and caps the lobby at 4", () => {
    const { room } = lobby(4);
    expect(room.view(0).seats.map(({ clan }) => clan)).toEqual([Clan.Suhey, Clan.Xiangi, Clan.Weyu, Clan.Mu]);
    expect(() => room.join("late")).toThrow("full");
  });

  it("lets only the host change options and launch, with at least 2 players", () => {
    const { room, members, host } = lobby(1);
    expect(() => room.start(host)).toThrow("At least 2");
    const guest = room.join("guest");
    expect(() => room.setOptions(guest.token, { clanPowers: false })).toThrow("host");
    expect(() => room.start(guest.token)).toThrow("host");
    room.setOptions(host, { clanPowers: false });
    room.start(host);
    expect(room.view(members[0].id).match).not.toBeNull();
    expect(room.view(0).options.clanPowers).toBe(false);
    expect(() => room.join("late")).toThrow("already started");
  });

  it("places one starting City per player", () => {
    const { room, host } = lobby(3);
    room.start(host);
    const match = room.view(0).match!;
    STARTING_CITIES.forEach((coord, player) => {
      const province = provinceAt(match, coord)!;
      expect(province.owner).toBe(player < 3 ? player : null);
      expect(province.building).toBe(player < 3 ? Building.City : null);
    });
  });
});

describe("game", () => {
  it("shows each player only their own Chão and plan", () => {
    const { room, members, host } = lobby(2);
    room.start(host);
    room.submit(members[1].token, undefined, emptyPlan());
    expect(room.view(0).match!.chao).toBe(3);
    expect(room.view(1).match!.chao).toBe(4);
    expect(room.view(0).match!.plan).toBeNull();
    expect(room.view(1).match!.plan).toEqual(emptyPlan());
    expect(room.view(0).seats.map(({ submitted }) => submitted)).toEqual([false, true]);
    expect(JSON.stringify(room.view(0))).not.toContain('"players"');
  });

  it("resolves the turn once everyone has submitted", () => {
    const { room, members, host } = lobby(2);
    room.start(host);
    room.submit(host, undefined, plan(STARTING_CITIES[0], { Development: 1 }));
    expect(room.view(0).match!.turn).toBe(1);
    room.submit(members[1].token, undefined, emptyPlan());
    const match = room.view(0).match!;
    expect(match.turn).toBe(2);
    expect(match.log).toHaveLength(1);
    expect(room.view(0).seats.every(({ submitted }) => !submitted)).toBe(true);
    expect(room.view(1).match!.chao).toBe(10);
  });

  it("rejects invalid plans and lets players edit a submitted plan", () => {
    const { room, host } = lobby(2);
    room.start(host);
    expect(() => room.submit(host, undefined, plan(STARTING_CITIES[0], { Development: 3 }))).toThrow("Not enough Chão");
    room.submit(host, undefined, emptyPlan());
    expect(() => room.submit(host, undefined, emptyPlan())).toThrow("already submitted");
    room.edit(host, undefined);
    expect(room.view(0).seats[0].submitted).toBe(false);
  });
});

describe("debug mode", () => {
  it("lets the host add players, play any seat and restart", () => {
    const { room, host } = lobby(1, true);
    room.addPlayer(host);
    room.start(host);
    expect(room.actor(host, 1)).toBe(1);
    room.submit(host, 0, emptyPlan());
    room.submit(host, 1, emptyPlan());
    expect(room.view(0).match!.turn).toBe(2);
    room.restart(host);
    expect(room.view(0).match!.turn).toBe(1);
    expect(room.view(0).match!.log).toEqual([]);
    room.backToLobby(host);
    expect(room.view(0).match).toBeNull();
  });

  it("is refused outside debug mode and to guests", () => {
    const { room, members, host } = lobby(2);
    expect(() => room.addPlayer(host)).toThrow("Debug mode is off");
    expect(() => room.actor(host, 1)).toThrow("debug mode");
    const debugRoom = lobby(2, true);
    expect(() => debugRoom.room.actor(debugRoom.members[1].token, 0)).toThrow("host");
    expect(members).toHaveLength(2);
  });
});
