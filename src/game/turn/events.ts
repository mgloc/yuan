import type { ActionKind, ActionLevel, ActionType, Coord, PlayerId } from "../../game_types.ts";

export type Piece = "Village" | "City" | "Army";

export type TurnEvent =
  | { type: "Passed"; player: PlayerId }
  | { type: "ColonisationCollision"; players: PlayerId[]; target: Coord }
  | { type: "Paid"; player: PlayerId; amount: number }
  | { type: "ActionResolved"; player: PlayerId; kind: ActionKind; level: ActionLevel; target: Coord }
  | { type: "ActionFailed"; player: PlayerId; action: ActionType; target: Coord; reason: string }
  | { type: "AttackLaunched"; player: PlayerId; target: Coord; armies: number; reserve: number }
  | { type: "AttackersClashed"; target: Coord; players: PlayerId[] }
  | { type: "AttackWon"; player: PlayerId; target: Coord; survivors: number }
  | { type: "AttackLost"; player: PlayerId; target: Coord; reason: string }
  | { type: "BonusAttack"; player: PlayerId; target: Coord; success: boolean }
  | { type: "ProvinceCaptured"; player: PlayerId; coord: Coord }
  | { type: "ProvinceFreed"; coord: Coord }
  | { type: "GroupDestroyed"; defender: PlayerId; coords: Coord[]; by: PlayerId | null }
  | { type: "VillagesPlaced"; player: PlayerId; coords: Coord[] }
  | { type: "ProvinceContested"; coord: Coord; players: PlayerId[] }
  | { type: "PoolExhausted"; player: PlayerId; piece: Piece; missing: number }
  | { type: "Urbanised"; player: PlayerId; coord: Coord }
  | { type: "TempleBuilt"; player: PlayerId; coord: Coord }
  | { type: "ChaoStolen"; from: PlayerId; to: PlayerId; amount: number }
  | { type: "ArmiesCreated"; player: PlayerId; coord: Coord; count: number }
  | { type: "Refunded"; player: PlayerId; amount: number }
  | { type: "Income"; player: PlayerId; amount: number }
  | { type: "ArmiesDisbanded"; coord: Coord; count: number }
  | { type: "Eruption"; coords: Coord[] }
  | { type: "Victory"; player: PlayerId };
