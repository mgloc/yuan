import { describe, expect, it } from "vitest";
import { Building, Clan, TileType } from "../src/game_types.ts";
import { emptyPlan } from "../src/game/plan/plan.ts";
import { prebuiltMap, STARTING_CITIES } from "../src/game/default_map.ts";
import { provinceAt } from "../src/game/tile/coords.ts";
import { plan } from "../src/game/turn/testing.ts";
import { placementError, SetupStage } from "../src/game/setup/setup.ts";
import { MapMode } from "../src/protocol.ts";
import { parseCustomMap } from "../src/game/custom_map.ts";
import type { PrebuiltMap } from "../src/game/default_map.ts";
import { newRoomState, Room } from "./room.ts";

let tokens = 0;
const inOrder = () => 0.999;
const newRoom = (debug = false) => new Room(newRoomState("CODE", debug), () => `token-${tokens++}`, inOrder);

function playBidding(room: Room, members: { token: string }[]) {
  for (let guard = 0; guard < 20 && room.view(0).setup?.stage === SetupStage.Clans; guard++) {
    const setup = room.view(0).setup!;
    const bidding = setup.bidding!;
    if (bidding.chooser !== null) {
      const free = setup.clans.find((_, index) => setup.owners[index] === null)!;
      room.chooseClan(members[bidding.chooser].token, undefined, free);
    } else {
      bidding.contenders.forEach((player, i) => room.bid(members[player].token, undefined, bidding.contenders.length - 1 - i));
    }
  }
}

function agreeOnTemples(room: Room, tokens: string[], as?: number[]) {
  if (room.view(0).setup?.stage !== SetupStage.Temples) {
    return;
  }
  tokens.forEach((token, i) => room.agree(token, as?.[i], true));
}

function launch(room: Room, tokens: string[]) {
  room.start(tokens[0]);
  agreeOnTemples(room, tokens);
}

function lobby(players: number, debug = false) {
  const room = newRoom(debug);
  const members = Array.from({ length: players }, (_, i) => room.join(`P${i}`));
  return { room, members, host: members[0].token };
}

describe("lobby", () => {
  it("gives nobody a Clan in the lobby and caps it at 4", () => {
    const { room } = lobby(4);
    expect(room.view(0).seats.map(({ clan }) => clan)).toEqual([null, null, null, null]);
    expect(() => room.join("late")).toThrow("full");
  });

  it("draws Clans at random for the capitals when not bidding", () => {
    const room = new Room(newRoomState("CODE", false), () => `token-${tokens++}`, () => 0);
    const host = room.join("Host").token;
    const guest = room.join("Guest").token;
    launch(room, [host, guest]);
    const seats = room.view(0).seats;
    expect(seats.map(({ clan }) => clan)).toEqual([Clan.Xiangi, Clan.Suhey]);
    expect(provinceAt(room.view(0).match!, STARTING_CITIES[1])).toMatchObject({ owner: 0, building: Building.City });
  });

  it("lets only the host change options and launch, with at least 2 players", () => {
    const { room, members, host } = lobby(1);
    expect(() => room.start(host)).toThrow("At least 2");
    const guest = room.join("guest");
    expect(() => room.setOptions(guest.token, { clanPowers: false })).toThrow("host");
    expect(() => room.start(guest.token)).toThrow("host");
    room.setOptions(host, { clanPowers: false });
    launch(room, [host, guest.token]);
    expect(room.view(members[0].id).match).not.toBeNull();
    expect(room.view(0).options.clanPowers).toBe(false);
    expect(() => room.join("late")).toThrow("already started");
  });

  it("makes Crossing the Waters bid for its fixed capitals", () => {
    const { room, members, host } = lobby(3);
    launch(room, members.map(({ token }) => token));
    const setup = room.view(0).setup!;
    expect(setup).toMatchObject({ stage: SetupStage.Clans, withBidding: true, clans: [Clan.Mu, Clan.Xiangi, Clan.Weyu] });
    expect(room.view(0).seats.every(({ clan }) => clan === null)).toBe(true);
    room.bid(host, undefined, 3);
    expect(room.view(0).setup!.bidding).toMatchObject({ submitted: [0], yourBid: 3 });
    expect(room.view(1).setup!.bidding).toMatchObject({ submitted: [0], yourBid: null });
    expect(JSON.stringify(room.view(1))).not.toContain('"bids"');
    room.bid(members[1].token, undefined, 1);
    room.bid(members[2].token, undefined, 0);
    room.chooseClan(host, undefined, Clan.Weyu);
    room.bid(members[1].token, undefined, 2);
    room.bid(members[2].token, undefined, 1);
    room.chooseClan(members[1].token, undefined, Clan.Mu);
    const view = room.view(0);
    expect(view.seats.map(({ clan }) => clan)).toEqual([Clan.Weyu, Clan.Mu, Clan.Xiangi]);
    expect(view.match!.chao).toBe(3);
    expect(room.view(1).match!.chao).toBe(4);
    expect(room.view(2).match!.chao).toBe(6);
    prebuiltMap(3).capitals!.forEach(({ clan, coord }) => {
      expect(provinceAt(view.match!, coord)).toMatchObject({ owner: view.seats.find((seat) => seat.clan === clan)!.id, building: Building.City });
    });
  });
});

describe("game", () => {
  it("shows each player only their own Chão and plan", () => {
    const { room, members } = lobby(2);
    launch(room, members.map(({ token }) => token));
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
    launch(room, members.map(({ token }) => token));
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
    const { room, members, host } = lobby(2);
    launch(room, members.map(({ token }) => token));
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
    agreeOnTemples(room, [host, host], [0, 1]);
    expect(room.actor(host, 1)).toBe(1);
    room.submit(host, 0, emptyPlan());
    room.submit(host, 1, emptyPlan());
    expect(room.view(0).match!.turn).toBe(2);
    room.restart(host);
    agreeOnTemples(room, [host, host], [0, 1]);
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

describe("leaving", () => {
  it("frees the seat in the lobby and renumbers the others", () => {
    const { room, members } = lobby(3);
    room.leave(members[1].token);
    const view = room.view(room.actor(members[2].token), members[2].token);
    expect(view.seats.map(({ name }) => name)).toEqual(["P0", "P2"]);
    expect(view.self).toBe(1);
    expect(() => room.actor(members[1].token)).toThrow("Unknown player");
  });

  it("forfeits a running game: the seat passes every turn", () => {
    const { room, members, host } = lobby(3);
    launch(room, members.map(({ token }) => token));
    playBidding(room, members);
    room.leave(members[2].token);
    expect(room.view(0).seats[2]).toMatchObject({ left: true, submitted: true });
    room.submit(host, undefined, emptyPlan());
    room.submit(members[1].token, undefined, emptyPlan());
    expect(room.view(0).match!.turn).toBe(2);
    expect(room.view(0).seats[2].submitted).toBe(true);
    expect(() => room.submit(members[2].token, undefined, emptyPlan())).toThrow("You left");
  });

  it("resolves at once when the last missing player leaves", () => {
    const { room, members, host } = lobby(2);
    launch(room, members.map(({ token }) => token));
    room.submit(host, undefined, emptyPlan());
    room.leave(members[1].token);
    expect(room.view(0).match!.turn).toBe(2);
  });

  it("does not let the host leave", () => {
    const { room, host } = lobby(2);
    expect(() => room.leave(host)).toThrow("delete the game instead");
  });
});

describe("map setup", () => {
  const customLobby = (players: number) => {
    const context = lobby(players);
    context.room.setOptions(context.host, { map: MapMode.Custom });
    context.room.start(context.host);
    return context;
  };

  function placeAllTiles(room: Room, tokens: string[]) {
    for (let guard = 0; room.view(0).setup?.stage === SetupStage.Tiles && guard < 50; guard++) {
      const setup = room.view(0).setup!;
      const player = setup.turn!;
      const state = { ...setup, origin: setup.origin } as never;
      search: for (let row = 0; row < setup.tiles.length; row++) {
        for (let col = 0; col < setup.tiles[row].length; col++) {
          if (placementError(state, { col, row }, 0) === null) {
            room.placeTile(tokens[player], undefined, setup.hands[player][0], { col, row }, 0);
            break search;
          }
        }
      }
    }
  }

  const provincesOf = (room: Room) =>
    room.view(0).setup!.tiles.flatMap((line, row) => line.flatMap((tile, col) => (tile?.name ? [{ col, row }] : [])));

  it("runs tiles, Cities and Temples before starting the game on the built map", () => {
    const { room, members } = customLobby(2);
    const tokens = members.map(({ token }) => token);
    expect(room.view(0).match).toBeNull();
    expect(room.view(0).setup).toMatchObject({ stage: SetupStage.Tiles, turn: 0, total: 8 });
    expect(() => room.placeTile(tokens[1], undefined, room.view(0).setup!.hands[1][0], { col: 10, row: 10 }, 0)).toThrow("not your turn");
    placeAllTiles(room, tokens);
    expect(room.view(0).setup!.stage).toBe(SetupStage.Cities);

    const provinces = provincesOf(room);
    room.setCity(tokens[1], undefined, Clan.Suhey, provinces[0]);
    room.setCity(tokens[0], undefined, Clan.Xiangi, provinces[9]);
    room.agree(tokens[0], undefined, true);
    expect(room.view(0).setup!.agreed).toEqual([0]);
    room.agree(tokens[1], undefined, true);
    expect(room.view(0).setup!.stage).toBe(SetupStage.Temples);

    const hills = provinces.find(({ col, row }) => room.view(0).setup!.tiles[row][col]!.type === TileType.Hills)!;
    room.toggleTemple(tokens[1], undefined, hills);
    room.agree(tokens[0], undefined, true);
    room.agree(tokens[1], undefined, true);
    const view = room.view(0);
    expect(view.setup).toBeNull();
    expect(view.match!.turn).toBe(1);
    expect(provinceAt(view.match!, provinces[0])).toMatchObject({ owner: 0, building: Building.City });
    expect(provinceAt(view.match!, provinces[9])).toMatchObject({ owner: 1, building: Building.City });
  });

  it("rejects bad setup input and keeps the lobby closed", () => {
    const { room, host } = customLobby(2);
    expect(() => room.placeTile(host, undefined, "Z9", { col: 10, row: 10 }, 0)).toThrow("not in your hand");
    expect(() => room.setCity(host, undefined, Clan.Suhey, { col: 0, row: 0 })).toThrow("Cities are not being placed");
    expect(() => room.agree(host, undefined, true)).toThrow("Tiles are still being placed");
    expect(() => room.join("late")).toThrow("already started");
    expect(() => room.setOptions(host, { map: MapMode.Prebuilt })).toThrow("already started");
  });

  it("gives the tiles of a player leaving during setup to the others", () => {
    const { room, members } = customLobby(3);
    room.leave(members[2].token);
    expect(room.view(0).setup!.hands.map((hand) => hand.length)).toEqual([6, 6, 0]);
    placeAllTiles(room, members.map(({ token }) => token));
    expect(room.view(0).setup!.stage).toBe(SetupStage.Cities);
  });
});

describe("prebuilt maps without fixed Cities", () => {
  it("skips tiles, then asks everyone to agree on Cities and Temples on Hills", () => {
    const { room, members, host } = lobby(4);
    room.start(host);
    const setup = room.view(0).setup!;
    expect(setup).toMatchObject({ stage: SetupStage.Cities, templesLocked: false, temples: [] });
    const provinces = setup.tiles.flatMap((line, row) => line.flatMap((tile, col) => (tile?.name ? [{ col, row }] : [])));
    members.forEach((member, i) => room.setCity(member.token, undefined, setup.clans[i], provinces[i * 7]));
    members.forEach((member) => room.agree(member.token, undefined, true));
    expect(room.view(0).setup!.stage).toBe(SetupStage.Temples);
    const typeOf = ({ col, row }: { col: number; row: number }) => setup.tiles[row][col]!.type;
    const hills = provinces.find((coord) => typeOf(coord) === TileType.Hills)!;
    const forest = provinces.find((coord) => typeOf(coord) === TileType.Forest)!;
    expect(() => room.toggleTemple(host, undefined, forest)).toThrow("A Temple goes on Hills");
    room.toggleTemple(host, undefined, hills);
    members.forEach((member) => room.agree(member.token, undefined, true));
    const view = room.view(0);
    expect(view.setup).toBeNull();
    expect(view.match!.provinces.flat().filter((province) => province?.temple)).toHaveLength(1);
    expect(provinceAt(view.match!, provinces[14])).toMatchObject({ owner: 2, building: Building.City });
  });
});

describe("Clans in play", () => {
  it("uses the host's picks, one per player", () => {
    const { room, members, host } = lobby(2);
    expect(() => room.setOptions(members[1].token, { clans: [Clan.Mu, Clan.Weyu] })).toThrow("host");
    room.setOptions(host, { clans: [Clan.Mu] });
    expect(() => room.start(host)).toThrow("Pick 2 Clans");
    room.setOptions(host, { clans: [Clan.Mu, Clan.Weyu] });
    launch(room, members.map(({ token }) => token));
    expect(room.view(0).seats.map(({ clan }) => clan).sort()).toEqual([Clan.Mu, Clan.Weyu]);
  });

  it("puts the picked Clans on a map's fixed capitals", () => {
    const { room, members, host } = lobby(3);
    room.setOptions(host, { clans: [Clan.Suhey, Clan.Weyu, Clan.Xiangi] });
    launch(room, members.map(({ token }) => token));
    expect(room.view(0).setup!.clans).toEqual([Clan.Suhey, Clan.Weyu, Clan.Xiangi]);
    playBidding(room, members);
    expect(room.view(0).seats.map(({ clan }) => clan).sort()).toEqual([Clan.Suhey, Clan.Weyu, Clan.Xiangi]);
  });
});

describe("imported maps", () => {
  const layout = ["H:Cao R:Bao ~ H:Nie", "F:Ju M:Ge H:Tov R:Lu"];
  const capitals = [
    { clan: Clan.Mu, coord: { col: 0, row: 1 } },
    { clan: Clan.Weyu, coord: { col: 3, row: 1 } },
  ];
  const imported = (map: object) => {
    const context = lobby(2);
    context.room.setOptions(context.host, { map: MapMode.Imported, customMap: parseCustomMap(map) as PrebuiltMap });
    return context;
  };

  it("needs a map before launching", () => {
    const { room, host } = lobby(2);
    room.setOptions(host, { map: MapMode.Imported });
    expect(() => room.start(host)).toThrow("Load a map file first");
  });

  it("starts at once when the map fixes Capitals and Temples", () => {
    const { room, host } = imported({ layout, capitals, temples: [{ col: 0, row: 0 }] });
    room.start(host);
    const match = room.view(0).match!;
    expect(match.provinces.flat().filter((province) => province?.temple)).toHaveLength(1);
    expect(provinceAt(match, capitals[1].coord)).toMatchObject({ building: Building.City });
  });

  it("asks for Temples only when the map has Capitals but no Temples", () => {
    const { room, members, host } = imported({ layout, capitals });
    room.start(host);
    expect(room.view(0).setup).toMatchObject({ stage: SetupStage.Temples, citiesLocked: true, clans: [Clan.Mu, Clan.Weyu] });
    room.toggleTemple(host, undefined, { col: 3, row: 0 });
    members.forEach((member) => room.agree(member.token, undefined, true));
    expect(room.view(0).match!.provinces.flat().filter((province) => province?.temple)).toHaveLength(1);
  });

  it("asks for Cities, then keeps the map's Temples", () => {
    const { room, members, host } = imported({ layout, temples: [{ col: 2, row: 1 }] });
    room.start(host);
    const setup = room.view(0).setup!;
    expect(setup).toMatchObject({ stage: SetupStage.Cities, templesLocked: true });
    room.setCity(host, undefined, setup.clans[0], { col: 0, row: 0 });
    room.setCity(host, undefined, setup.clans[1], { col: 1, row: 1 });
    members.forEach((member) => room.agree(member.token, undefined, true));
    expect(room.view(0).match!.provinces.flat().filter((province) => province?.temple)).toHaveLength(1);
  });
});
