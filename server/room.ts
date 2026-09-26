import { ACTION_LEVELS, ActionType, Clan, type Coord, type GameOptions, type GameState, type Plan, type PlayerId } from "../src/game_types.ts";
import { createDefaultBoard, MAX_PLAYERS } from "../src/game/default_map.ts";
import { createGame } from "../src/game/setup.ts";
import { resolveTurn } from "../src/game/turn/resolve.ts";
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

interface Member {
  id: PlayerId;
  name: string;
  token: string;
}

type RoomListener = () => void;

export class Room {
  code: string;
  debug: boolean;
  host: PlayerId = 0;
  options: GameOptions = { bidding: false, clanPowers: true };
  private members: Member[] = [];
  private game: GameState | null = null;
  private plans = new Map<PlayerId, Plan>();
  private log: TurnLog[] = [];
  private listeners = new Set<RoomListener>();
  private newToken: () => string;

  constructor(code: string, debug: boolean, newToken: () => string) {
    this.code = code;
    this.debug = debug;
    this.newToken = newToken;
  }

  get started(): boolean {
    return this.game !== null;
  }

  onChange(listener: RoomListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  join(name: string): Member {
    if (this.started) {
      throw new RoomError(409, "The game has already started");
    }
    if (this.members.length >= MAX_PLAYERS) {
      throw new RoomError(409, "The lobby is full");
    }
    const member = { id: this.members.length, name: cleanName(name, this.members.length), token: this.newToken() };
    this.members.push(member);
    this.notify();
    return member;
  }

  actor(token: string, as?: PlayerId): PlayerId {
    const member = this.members.find((candidate) => candidate.token === token);
    if (member === undefined) {
      throw new RoomError(403, "Unknown player");
    }
    if (as === undefined || as === member.id) {
      return member.id;
    }
    if (!this.debug || member.id !== this.host) {
      throw new RoomError(403, "Only the host can play other seats in debug mode");
    }
    if (!this.members.some(({ id }) => id === as)) {
      throw new RoomError(404, "Unknown seat");
    }
    return as;
  }

  setOptions(token: string, options: Partial<GameOptions>) {
    this.requireHost(token);
    this.requireLobby();
    if (typeof options.clanPowers === "boolean") {
      this.options = { ...this.options, clanPowers: options.clanPowers };
    }
    this.notify();
  }

  start(token: string) {
    this.requireHost(token);
    this.requireLobby();
    if (this.members.length < MIN_PLAYERS) {
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
    if (this.plans.has(player)) {
      throw new RoomError(409, "The plan is already submitted");
    }
    const errors = planErrors(game, game.players[player], plan);
    if (errors.length > 0) {
      throw new RoomError(422, errors.join(", "));
    }
    this.plans.set(player, plan);
    if (this.plans.size === game.players.length) {
      this.resolve(game);
    }
    this.notify();
  }

  edit(token: string, as: PlayerId | undefined) {
    const player = this.actor(token, as);
    this.requireGame();
    this.plans.delete(player);
    this.notify();
  }

  addPlayer(token: string) {
    this.requireDebugHost(token);
    this.join(`Player ${this.members.length + 1}`);
  }

  restart(token: string) {
    this.requireDebugHost(token);
    this.requireGame();
    this.newGame();
  }

  backToLobby(token: string) {
    this.requireDebugHost(token);
    this.game = null;
    this.plans.clear();
    this.log = [];
    this.notify();
  }

  view(player: PlayerId): PlayerView {
    const seats: Seat[] = this.members.map((member) => ({
      id: member.id,
      name: member.name,
      clan: clanOf(member.id),
      submitted: this.plans.has(member.id),
    }));
    const game = this.game;
    return {
      code: this.code,
      you: player,
      host: this.host,
      debug: this.debug,
      options: this.options,
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
              plan: this.plans.get(player) ?? null,
              log: this.log,
            },
    };
  }

  private newGame() {
    const players = this.members.map(({ id }) => id);
    this.game = createGame(createDefaultBoard(players), players.map(clanOf), this.options);
    this.plans.clear();
    this.log = [];
    this.notify();
  }

  private resolve(game: GameState) {
    const { state, events } = resolveTurn(game, this.plans);
    this.log = [...this.log, { turn: game.turn, events }];
    this.game = state;
    this.plans.clear();
  }

  private requireHost(token: string) {
    if (this.actor(token) !== this.host) {
      throw new RoomError(403, "Only the host can do that");
    }
  }

  private requireDebugHost(token: string) {
    this.requireHost(token);
    if (!this.debug) {
      throw new RoomError(403, "Debug mode is off");
    }
  }

  private requireLobby() {
    if (this.started) {
      throw new RoomError(409, "The game has already started");
    }
  }

  private requireGame(): GameState {
    if (this.game === null) {
      throw new RoomError(409, "The game has not started");
    }
    return this.game;
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
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
