import type { Board, Clan, GameOptions, Plan, PlayerId } from "./game_types.ts";
import type { TurnEvent } from "./game/turn/events.ts";

export const MIN_PLAYERS = 2;

export interface Session {
  code: string;
  player: PlayerId;
  token: string;
}

export interface Seat {
  id: PlayerId;
  name: string;
  clan: Clan;
  submitted: boolean;
  placeholder: boolean;
  left: boolean;
}

export interface TurnLog {
  turn: number;
  events: TurnEvent[];
}

export interface MatchView extends Board {
  turn: number;
  winner: PlayerId | null;
  finished: boolean;
  chao: number;
  plan: Plan | null;
  log: TurnLog[];
}

export interface PlayerView {
  code: string;
  you: PlayerId;
  self: PlayerId;
  host: PlayerId;
  debug: boolean;
  options: GameOptions;
  seats: Seat[];
  match: MatchView | null;
}

export interface CreateRequest {
  name: string;
  debug: boolean;
}

export interface JoinRequest {
  name: string;
}

export interface Credentials {
  token: string;
  as?: PlayerId;
}

export type OptionsRequest = Credentials & { options: Pick<GameOptions, "clanPowers"> };

export type PlanRequest = Credentials & { plan: Plan };

export const RoomAction = {
  Options: "options",
  Start: "start",
  Plan: "plan",
  Edit: "edit",
  AddPlayer: "add-player",
  Restart: "restart",
  Lobby: "lobby",
  Leave: "leave",
  Delete: "delete",
} as const;

export type RoomAction = (typeof RoomAction)[keyof typeof RoomAction];

export interface ErrorResponse {
  error: string;
}
