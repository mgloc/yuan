import { ACTION_LEVELS, ActionType, Clan, type Coord, type GameOptions, type GameState, type Plan, type PlayerId } from "../src/game_types.ts";
import { createDefaultBoard, MAX_PLAYERS } from "../src/game/default_map.ts";
import { createGame } from "../src/game/setup.ts";
import { resolveTurn } from "../src/game/turn/resolve.ts";
import { emptyPlan, isPassing } from "../src/game/plan/plan.ts";
import { planErrors } from "../src/game/turn/validation.ts";
import { MIN_PLAYERS, type PlayerView, type Seat, type TurnLog } from "../src/protocol.ts";

const CLAN_ORDER: readonly Clan[] = [Clan.Suhey, Clan.Xiangi, Clan.Weyu, Clan.Mu];
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
  options: GameOptions;
  members: Member[];
  game: GameState | null;
  plans: { [player: PlayerId]: Plan };
  log: TurnLog[];
}

export function newRoomState(code: string, debug: boolean): RoomState {
  return {
    code,
    debug,
    host: 0,
    options: { bidding: false, clanPowers: true },
    members: [],
    game: null,
    plans: {},
    log: [],
  };
}

export class Room {
  state: RoomState;
  private newToken: () => string;

  constructor(state: RoomState, newToken: () => string) {
    this.state = state;
    this.newToken = newToken;
  }

  get code(): string {
    return this.state.code;
  }

  get started(): boolean {
    return this.state.game !== null;
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

  setOptions(token: string, options: Partial<GameOptions>) {
    this.requireHost(token);
    this.requireLobby();
    if (typeof options.clanPowers === "boolean") {
      this.state.options = { ...this.state.options, clanPowers: options.clanPowers };
    }
  }

  start(token: string) {
    this.requireHost(token);
    this.requireLobby();
    if (this.state.members.length < MIN_PLAYERS) {
      throw new RoomError(409, `At least ${MIN_PLAYERS} players are needed`);
    }
    this.newGame();
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
    this.requireGame();
    this.newGame();
  }

  backToLobby(token: string) {
    this.requireDebugHost(token);
    this.state.game = null;
    this.state.plans = {};
    this.state.log = [];
    this.state.members = this.state.members.filter(({ left }) => !left).map((member, id) => ({ ...member, id }));
  }

  view(player: PlayerId, viewer?: string): PlayerView {
    const { code, host, debug, options, members, game, plans, log } = this.state;
    const seats: Seat[] = members.map((member) => ({
      id: member.id,
      name: member.name,
      clan: clanOf(member.id),
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
      options,
      seats,
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

  private newGame() {
    const players = this.state.members.map(({ id }) => id);
    this.state.game = createGame(createDefaultBoard(players), players.map(clanOf), this.state.options);
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

function clanOf(player: PlayerId): Clan {
  return CLAN_ORDER[player];
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

function isCoord(value: unknown): value is Coord {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const { col, row } = value as Record<string, unknown>;
  return Number.isInteger(col) && Number.isInteger(row);
}
