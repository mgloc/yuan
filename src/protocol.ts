import type { Board, Clan, Coord, GameOptions, Grid, Plan, PlayerId, Tile } from "./game_types.ts";
import type { PrebuiltMap } from "./game/default_map.ts";
import type { BidRound, SetupStage } from "./game/setup/setup.ts";
import type { TileGroupId } from "./game/setup/tile_groups.ts";
import type { TurnEvent } from "./game/turn/events.ts";

export const MIN_PLAYERS = 2;

export const MapMode = {
  Prebuilt: "prebuilt",
  Custom: "custom",
  Imported: "imported",
} as const;

export type MapMode = (typeof MapMode)[keyof typeof MapMode];

export interface RoomOptions extends GameOptions {
  map: MapMode;
  clans: Clan[];
  customMap: PrebuiltMap | null;
}

export interface Session {
  code: string;
  player: PlayerId;
  token: string;
}

export interface Seat {
  id: PlayerId;
  name: string;
  clan: Clan | null;
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

export interface SetupView {
  stage: SetupStage;
  tiles: Grid<Tile>;
  origin: Coord | null;
  hands: TileGroupId[][];
  turn: PlayerId | null;
  placed: number;
  total: number;
  cities: (Coord | null)[];
  temples: Coord[];
  agreed: PlayerId[];
  clans: Clan[];
  owners: (PlayerId | null)[];
  withBidding: boolean;
  templesLocked: boolean;
  citiesLocked: boolean;
  bidding: BiddingView | null;
}

export interface BiddingView {
  chao: number[];
  contenders: PlayerId[];
  submitted: PlayerId[];
  yourBid: number | null;
  chooser: PlayerId | null;
  tieBreak: boolean;
  history: BidRound[];
}

export interface PlayerView {
  code: string;
  you: PlayerId;
  self: PlayerId;
  host: PlayerId;
  debug: boolean;
  options: RoomOptions;
  seats: Seat[];
  setup: SetupView | null;
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

export type OptionsRequest = Credentials & { options: Partial<Pick<RoomOptions, "clanPowers" | "map" | "bidding" | "clans" | "customMap">> };

export type PlaceTileRequest = Credentials & { tile: TileGroupId; anchor: Coord; rotation: number };

export type SetCityRequest = Credentials & { clan: Clan; coord: Coord | null };

export type BidRequest = Credentials & { amount: number };

export type ChooseClanRequest = Credentials & { clan: Clan };

export type ToggleTempleRequest = Credentials & { coord: Coord };

export type AgreeRequest = Credentials & { agreed: boolean };

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
  PlaceTile: "place-tile",
  SetCity: "set-city",
  ToggleTemple: "toggle-temple",
  Agree: "agree",
  Bid: "bid",
  ChooseClan: "choose-clan",
} as const;

export type RoomAction = (typeof RoomAction)[keyof typeof RoomAction];

export interface ErrorResponse {
  error: string;
}
