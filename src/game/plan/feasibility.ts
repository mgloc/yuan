import { ACTION_LEVELS, ActionKind, ActionType, type ActionLevel, type Coord, type GameInfo, type Plan, type PlayerId, type Province } from "../../game_types.ts";
import { provinceAt } from "../tile/coords.ts";
import { canColonise } from "../tile/reach.ts";
import { armySources } from "../turn/combat.ts";
import { reserve } from "../turn/pools.ts";
import { previewPlan } from "./preview.ts";

export type LevelBlockers = Record<ActionLevel, string | null>;
export type PlanBlockers = Record<ActionType, LevelBlockers>;

type Check = (level: ActionLevel) => string | null;

const NONE: Check = () => null;

export function planBlockers(game: GameInfo, player: PlayerId, plan: Plan): PlanBlockers {
  const target = plan.target;
  const province = target === null ? null : provinceAt(game, target);
  const preview = previewPlan(game, player, plan);
  const blockers = {} as PlanBlockers;
  for (const type of Object.values(ActionType)) {
    const check = target === null || province === null ? NONE : checkFor(game, player, target, province, type, preview[type].kind);
    blockers[type] = Object.fromEntries(ACTION_LEVELS.map((level) => [level, check(level)])) as LevelBlockers;
  }
  return blockers;
}

function checkFor(game: GameInfo, player: PlayerId, target: Coord, province: Province, type: ActionType, kind: ActionKind | null): Check {
  const citiesLeft = () => reserve(game, player).cities > 0;
  switch (kind) {
    case null:
      return () => impossible(type, province, player);
    case ActionKind.Colonisation: {
      const reachable = canColonise(game, player, target);
      return (level) => (level < 3 && !reachable ? "Not adjacent or connected to your Provinces" : null);
    }
    case ActionKind.Expansion:
      return (level) => (level === 3 && province.temple ? "Already has a Temple" : null);
    case ActionKind.Urbanisation:
      return (level) => (level >= 2 && !citiesLeft() ? "No City left in reserve" : null);
    case ActionKind.Reinforcement:
      return (level) => {
        if (province.owner !== player) {
          return null;
        }
        if (level === 1 && province.doubled) {
          return "City is already doubled";
        }
        return level < 3 && !province.doubled && !citiesLeft() ? "No City left in reserve" : null;
      };
    case ActionKind.Recruitment:
      return (level) => (level >= 2 && reserve(game, player).armies < 1 ? "No Army left in reserve" : null);
    case ActionKind.Attack: {
      const armed = armySources(game, player, target).length > 0;
      return () => (armed ? null : "No Army adjacent or connected");
    }
  }
}

function impossible(type: ActionType, province: Province, player: PlayerId): string {
  const enemy = province.owner !== null && province.owner !== player;
  switch (type) {
    case ActionType.Development:
      return "Can't develop an enemy Province";
    case ActionType.Fortification:
      return enemy ? "Not your Province (attack it first)" : "Not your Province";
    case ActionType.Militarisation:
      return province.owner === null ? "Nothing to attack or recruit on a free Province" : "Recruitment needs a City";
  }
}
