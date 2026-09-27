import { ACTION_LEVELS, ActionType, type Board, type Clan, type Coord, type GameState, type Plan, type PlayerId } from "../src/game_types.ts";
import { MAX_PLAYERS, mapBoard, mapCapitals, prebuiltMap, type PrebuiltMap } from "../src/game/default_map.ts";
import { chooseClan, clanOfPlayer, clansAssigned, leaveBidding, placeBid, startClans } from "../src/game/setup/bidding.ts";
import { createGame } from "../src/game/setup.ts";
import { resolveTurn } from "../src/game/turn/resolve.ts";
import { emptyPlan, isPassing } from "../src/game/plan/plan.ts";
import { planErrors } from "../src/game/turn/validation.ts";
import {
  citySetup,
  everyoneAgreed,
  handOver,
  newSetup,
  nextStage,
  placeTile,
  setAgreed,
  setCity,
  SetupStage,
  setupBoard,
  toggleTemple,
  type SetupState,
} from "../src/game/setup/setup.ts";
import type { TileGroupId } from "../src/game/setup/tile_groups.ts";
import { MapMode, MIN_PLAYERS, type PlayerView, type RoomOptions, type Seat, type TurnLog } from "../src/protocol.ts";

const MAX_NAME_LENGTH = 24;

export class RoomError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface Member {
  id: PlayerId;
  name: string;
  token: string;
  placeholder: boolean;
  left?: boolean;
}

export interface RoomState {
  code: string;
  debug: boolean;
  host: PlayerId;
  options: RoomOptions;
  members: Member[];
  setup?: SetupState | null;
  game: GameState | null;
  plans: { [player: PlayerId]: Plan };
  log: TurnLog[];
}

export function newRoomState(code: string, debug: boolean): RoomState {
  return {
    code,
    debug,
    host: 0,
    options: { bidding: false, clanPowers: true, map: MapMode.Prebuilt, clans: [], customMap: null },
    members: [],
    setup: null,
    game: null,
    plans: {},
    log: [],
  };
}

export class Room {
  state: RoomState;
  private newToken: () => string;
  private random: () => number;

  constructor(state: RoomState, newToken: () => string, random: () => number = Math.random) {
    this.state = state;
    this.newToken = newToken;
    this.random = random;
  }

  get code(): string {
    return this.state.code;
  }

  get started(): boolean {
    return this.state.game !== null || this.setup !== null;
  }

  private get setup(): SetupState | null {
    return this.state.setup ?? null;
  }

  private get active(): PlayerId[] {
    return this.state.members.filter(({ left }) => !left).map(({ id }) => id);
  }

  join(name: string, placeholder = false): Member {
    const { members } = this.state;
    if (this.started) {
      throw new RoomError(409, "The game has already started");
    }
    if (members.length >= MAX_PLAYERS) {
      throw new RoomError(409, "The lobby is full");
    }
    const member: Member = { id: members.length, name: cleanName(name, members.length), token: this.newToken(), placeholder };
    members.push(member);
    return member;
  }

  actor(token: string, as?: PlayerId): PlayerId {
    const { members, debug, host } = this.state;
    const member = members.find((candidate) => candidate.token === token);
    if (member === undefined) {
      throw new RoomError(403, "Unknown player");
    }
    if (member.left) {
      throw new RoomError(403, "You left this game");
    }
    if (as === undefined || as === member.id) {
      return member.id;
    }
    if (!debug || member.id !== host) {
      throw new RoomError(403, "Only the host can play other seats in debug mode");
    }
    const seat = members.find(({ id }) => id === as);
    if (seat === undefined) {
      throw new RoomError(404, "Unknown seat");
    }
    if (!seat.placeholder) {
      throw new RoomError(403, "This seat belongs to another player");
    }
    return as;
  }

  setOptions(token: string, options: Partial<RoomOptions>) {
    this.requireHost(token);
    this.requireLobby();
    const next = { ...this.state.options };
    if (typeof options.clanPowers === "boolean") {
      next.clanPowers = options.clanPowers;
    }
    if (options.map === MapMode.Prebuilt || options.map === MapMode.Custom || options.map === MapMode.Imported) {
      next.map = options.map;
    }
    if (options.customMap !== undefined) {
      next.customMap = options.customMap;
    }
    if (typeof options.bidding === "boolean") {
      next.bidding = options.bidding;
    }
    if (options.clans !== undefined) {
      next.clans = [...options.clans];
    }
    this.state.options = next;
  }

  start(token: string) {
    this.requireHost(token);
    this.requireLobby();
    if (this.state.members.length < MIN_PLAYERS) {
      throw new RoomError(409, `At least ${MIN_PLAYERS} players are needed`);
    }
    if (this.state.options.map === MapMode.Imported && !this.state.options.customMap) {
      throw new RoomError(409, "Load a map file first");
    }
    const chosen = this.state.options.clans ?? [];
    if (chosen.length > 0 && chosen.length !== this.state.members.length) {
      throw new RoomError(409, `Pick ${this.state.members.length} Clans, one per player, or none for the default ones`);
    }
    this.begin();
  }

  placeTile(token: string, as: PlayerId | undefined, tile: TileGroupId, anchor: Coord, rotation: number) {
    const player = this.actor(token, as);
    this.check(placeTile(this.requireSetup(), player, tile, anchor, rotation, this.active));
  }

  setCity(token: string, as: PlayerId | undefined, clan: Clan, coord: Coord | null) {
    this.actor(token, as);
    this.check(setCity(this.requireSetup(), clan, coord));
  }

  toggleTemple(token: string, as: PlayerId | undefined, coord: Coord) {
    this.actor(token, as);
    this.check(toggleTemple(this.requireSetup(), coord));
  }

  agree(token: string, as: PlayerId | undefined, agreed: boolean) {
    const player = this.actor(token, as);
    this.check(setAgreed(this.requireSetup(), player, agreed));
    this.advanceSetup();
  }

  bid(token: string, as: PlayerId | undefined, amount: number) {
    const player = this.actor(token, as);
    this.check(placeBid(this.requireSetup(), player, amount, this.random));
    this.advanceSetup();
  }

  chooseClan(token: string, as: PlayerId | undefined, clan: Clan) {
    const player = this.actor(token, as);
    this.check(chooseClan(this.requireSetup(), player, clan, this.state.members.length, this.active, this.random));
    this.advanceSetup();
  }

  submit(token: string, as: PlayerId | undefined, plan: Plan) {
    const player = this.actor(token, as);
    const game = this.requireGame();
    if (game.finished) {
      throw new RoomError(409, "The game is over");
    }
    if (this.state.plans[player] !== undefined) {
      throw new RoomError(409, "The plan is already submitted");
    }
    const errors = planErrors(game, game.players[player], plan);
    if (errors.length > 0) {
      throw new RoomError(422, errors.join(", "));
    }
    this.state.plans[player] = isPassing(plan) ? emptyPlan() : plan;
    this.resolveIfReady();
  }

  leave(token: string) {
    const player = this.actor(token);
    if (player === this.state.host) {
      throw new RoomError(409, "The host cannot leave, delete the game instead");
    }
    if (!this.started) {
      this.state.members = this.state.members.filter(({ id }) => id !== player).map((member, id) => ({ ...member, id }));
      return;
    }
    this.state.members[player].left = true;
    const setup = this.setup;
    if (setup !== null) {
      handOver(setup, player, this.active);
      leaveBidding(setup, player, this.state.members.length, this.active, this.random);
      setup.agreed = setup.agreed.filter((id) => id !== player);
      this.advanceSetup();
      return;
    }
    if (!this.state.game!.finished) {
      this.state.plans[player] ??= emptyPlan();
      this.resolveIfReady();
    }
  }

  requireHost(token: string) {
    if (this.actor(token) !== this.state.host) {
      throw new RoomError(403, "Only the host can do that");
    }
  }

  edit(token: string, as: PlayerId | undefined) {
    const player = this.actor(token, as);
    if (this.requireGame().finished) {
      throw new RoomError(409, "The game is over");
    }
    delete this.state.plans[player];
  }

  addPlayer(token: string) {
    this.requireDebugHost(token);
    this.join(`Player ${this.state.members.length + 1}`, true);
  }

  restart(token: string) {
    this.requireDebugHost(token);
    if (!this.started) {
      throw new RoomError(409, "The game has not started");
    }
    this.begin();
  }

  backToLobby(token: string) {
    this.requireDebugHost(token);
    this.state.game = null;
    this.state.setup = null;
    this.state.plans = {};
    this.state.log = [];
    this.state.members = this.state.members.filter(({ left }) => !left).map((member, id) => ({ ...member, id }));
  }

  view(player: PlayerId, viewer?: string): PlayerView {
    const { code, host, debug, options, members, game, plans, log } = this.state;
    const seats: Seat[] = members.map((member) => ({
      id: member.id,
      name: member.name,
      clan: this.clanOf(member.id),
      submitted: plans[member.id] !== undefined,
      placeholder: member.placeholder,
      left: member.left === true,
    }));
    const self = members.find(({ token }) => token === viewer)?.id ?? player;
    return {
      code,
      you: player,
      self,
      host,
      debug,
      options: { ...options, map: options.map ?? MapMode.Prebuilt, clans: options.clans ?? [], customMap: options.customMap ?? null },
      seats,
      setup: this.setupView(player),
      match:
        game === null
          ? null
          : {
              turn: game.turn,
              tiles: game.tiles,
              provinces: game.provinces,
              winner: game.winner,
              finished: game.finished,
              chao: game.players[player].chao,
              plan: plans[player] ?? null,
              log,
            },
    };
  }

  private clanOf(player: PlayerId): Clan | null {
    if (this.state.game !== null) {
      return this.state.game.players[player]?.clan ?? null;
    }
    return this.setup === null ? null : clanOfPlayer(this.setup, player);
  }

  private setupView(player: PlayerId): PlayerView["setup"] {
    const setup = this.setup;
    if (setup === null) {
      return null;
    }
    const { stage, tiles, origin, hands, turn, placed, total, cities, temples, agreed, clans, owners, withBidding, bidding } = setup;
    return {
      stage,
      tiles,
      origin,
      hands,
      turn,
      placed,
      total,
      cities,
      temples,
      agreed,
      clans,
      owners,
      withBidding,
      templesLocked: setup.templesLocked === true,
      citiesLocked: setup.citiesLocked === true,
      bidding:
        bidding === null
          ? null
          : {
              chao: bidding.chao,
              contenders: bidding.contenders,
              submitted: bidding.contenders.filter((id) => bidding.bids[id] !== undefined),
              yourBid: bidding.bids[player] ?? null,
              chooser: bidding.chooser,
              tieBreak: bidding.tieBreak,
              history: bidding.history,
            },
    };
  }

  private begin() {
    this.state.game = null;
    this.state.plans = {};
    this.state.log = [];
    const players = this.state.members.map(({ id }) => id);
    const chosen = this.state.options.clans ?? [];
    if (this.state.options.map === MapMode.Custom) {
      const setup = newSetup(players.length, this.random, this.state.options.bidding, chosen);
      this.state.setup = setup;
      this.state.members.filter(({ left }) => left).forEach(({ id }) => handOver(setup, id, this.active));
    } else {
      const map = this.mapToPlay(players.length);
      const withBidding = this.state.options.bidding || map.bidding === true;
      this.state.setup = citySetup(mapBoard(map), mapCapitals(map, players.length), players.length, withBidding, chosen, map.temples !== undefined);
    }
    this.advanceSetup();
  }

  private mapToPlay(players: number): PrebuiltMap {
    const custom = this.state.options.map === MapMode.Imported ? this.state.options.customMap : null;
    return custom ?? prebuiltMap(players);
  }

  private advanceSetup() {
    const setup = this.setup;
    if (setup === null) {
      return;
    }
    while ((setup.stage === SetupStage.Cities || setup.stage === SetupStage.Temples) && everyoneAgreed(setup, this.active)) {
      nextStage(setup);
    }
    if (setup.stage !== SetupStage.Clans) {
      return;
    }
    if (setup.bidding === null && !clansAssigned(setup)) {
      startClans(setup, this.state.members.length, this.active, this.random);
    }
    if (clansAssigned(setup)) {
      const clans = this.state.members.map(({ id }) => clanOfPlayer(setup, id)!);
      this.state.setup = null;
      this.newGame(setupBoard(setup), clans, setup.bidding?.chao, setup.withBidding);
    }
  }

  private check(error: string | null) {
    if (error !== null) {
      throw new RoomError(422, error);
    }
  }

  private requireSetup(): SetupState {
    if (this.setup === null) {
      throw new RoomError(409, "The map is not being set up");
    }
    return this.setup;
  }

  private newGame(board: Board, clans: Clan[], chao: readonly number[] | undefined, bidding: boolean) {
    this.state.game = createGame(board, clans, { bidding, clanPowers: this.state.options.clanPowers }, chao);
    this.state.plans = {};
    this.state.log = [];
    this.passForLeavers();
  }

  private resolveIfReady() {
    const game = this.requireGame();
    if (Object.keys(this.state.plans).length === game.players.length) {
      this.resolve(game);
    }
  }

  private passForLeavers() {
    if (this.state.game === null || this.state.game.finished) {
      return;
    }
    this.state.members.filter(({ left }) => left).forEach(({ id }) => (this.state.plans[id] = emptyPlan()));
  }

  private resolve(game: GameState) {
    const plans = new Map(Object.entries(this.state.plans).map(([player, plan]) => [Number(player), plan]));
    const { state, events } = resolveTurn(game, plans);
    this.state.log = [...this.state.log, { turn: game.turn, events }];
    this.state.game = state;
    this.state.plans = {};
    this.passForLeavers();
    this.resolveIfReady();
  }

  private requireDebugHost(token: string) {
    this.requireHost(token);
    if (!this.state.debug) {
      throw new RoomError(403, "Debug mode is off");
    }
  }

  private requireLobby() {
    if (this.started) {
      throw new RoomError(409, "The game has already started");
    }
  }

  private requireGame(): GameState {
    if (this.state.game === null) {
      throw new RoomError(409, "The game has not started");
    }
    return this.state.game;
  }
}

function cleanName(name: string, index: number): string {
  const trimmed = name.trim().slice(0, MAX_NAME_LENGTH);
  return trimmed === "" ? `Player ${index + 1}` : trimmed;
}

export function parsePlan(value: unknown): Plan | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const { target, actions } = value as Record<string, unknown>;
  if (target !== null && !isCoord(target)) {
    return null;
  }
  if (typeof actions !== "object" || actions === null) {
    return null;
  }
  const levels = actions as Record<string, unknown>;
  const parsed = {} as Plan["actions"];
  for (const type of Object.values(ActionType)) {
    const level = levels[type] ?? null;
    if (level !== null && !ACTION_LEVELS.includes(level as never)) {
      return null;
    }
    parsed[type] = level as Plan["actions"][ActionType];
  }
  return { target, actions: parsed };
}

export function isCoord(value: unknown): value is Coord {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const { col, row } = value as Record<string, unknown>;
  return Number.isInteger(col) && Number.isInteger(row);
}
