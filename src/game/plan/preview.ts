import { ActionKind, ActionType, Building, type Board, type Coord, type Plan, type PlayerId } from "../../game_types.ts";
import { adjacentProvinces } from "../tile/adjacency.ts";
import { provinceAt } from "../tile/coords.ts";
import { groupHasCity, groupOf } from "../tile/groups.ts";
import { isControlledBy, isFree } from "../tile/ownership.ts";

export interface ActionPreview {
  kind: ActionKind | null;
  conditional: boolean;
}

export type PlanPreview = Record<ActionType, ActionPreview>;

interface TargetState {
  owner: PlayerId | null;
  building: Building | null;
}

export function previewPlan(board: Board, player: PlayerId, plan: Plan): PlanPreview {
  const preview = {} as PlanPreview;
  const province = plan.target === null ? null : provinceAt(board, plan.target);
  if (plan.target === null || province === null) {
    Object.values(ActionType).forEach((type) => (preview[type] = { kind: null, conditional: false }));
    return preview;
  }

  const target = plan.target;
  const state: TargetState = { owner: province.owner, building: province.building };
  const levels = plan.actions;

  const development = developmentKind(state, player);
  preview[ActionType.Development] = { kind: development, conditional: false };
  if (levels[ActionType.Development] !== null && development === ActionKind.Colonisation) {
    capture(board, target, player, state, true);
  }

  const attacking = levels[ActionType.Militarisation] !== null && isEnemy(state, player);
  const fortification = fortificationKind(state, player);
  if (fortification === null && attacking) {
    const captured = { ...state };
    capture(board, target, player, captured, false);
    preview[ActionType.Fortification] = { kind: fortificationKind(captured, player), conditional: true };
  } else {
    preview[ActionType.Fortification] = { kind: fortification, conditional: false };
    const level = levels[ActionType.Fortification];
    if (fortification === ActionKind.Urbanisation && level !== null && level >= 2) {
      state.building = Building.City;
    }
  }

  preview[ActionType.Militarisation] = { kind: militarisationKind(state, player), conditional: false };
  return preview;
}

function developmentKind(state: TargetState, player: PlayerId): ActionKind | null {
  if (state.owner === null) {
    return ActionKind.Colonisation;
  }
  return state.owner === player ? ActionKind.Expansion : null;
}

function fortificationKind(state: TargetState, player: PlayerId): ActionKind | null {
  if (state.owner !== player) {
    return null;
  }
  return state.building === Building.Village ? ActionKind.Urbanisation : ActionKind.Reinforcement;
}

function militarisationKind(state: TargetState, player: PlayerId): ActionKind | null {
  if (isEnemy(state, player)) {
    return ActionKind.Attack;
  }
  return state.owner === player && state.building === Building.City ? ActionKind.Recruitment : null;
}

function isEnemy(state: TargetState, player: PlayerId): boolean {
  return state.owner !== null && state.owner !== player;
}

function capture(board: Board, target: Coord, player: PlayerId, state: TargetState, settlesAround: boolean) {
  state.owner = player;
  state.building = joinsCity(board, target, player, settlesAround) ? Building.Village : Building.City;
}

function joinsCity(board: Board, target: Coord, player: PlayerId, settlesAround: boolean): boolean {
  const around = settlesAround ? adjacentProvinces(board, target).filter((coord) => isFree(board, coord)) : [];
  const settled = [target, ...around];
  return settled.some((coord) =>
    adjacentProvinces(board, coord).some(
      (neighbor) => isControlledBy(board, neighbor, player) && groupHasCity(board, groupOf(board, neighbor)),
    ),
  );
}
