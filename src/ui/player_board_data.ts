import {
  ACTION_LEVELS,
  ActionType,
  Building,
  CLAN_CHAO_MODIFIER,
  PASS_INCOME,
  RESOURCE_TILE,
  templeTarget,
  type ActionKind,
  type ActionLevel,
  type Coord,
  type GameInfo,
  type Plan,
  type Player,
  type TileType,
} from "../game_types.ts";
import { actionCost, controlledTemples, resources } from "../game/plan/economy.ts";
import { isPassing, planCost } from "../game/plan/plan.ts";
import { planBlockers, type LevelBlockers } from "../game/plan/feasibility.ts";
import { previewPlan } from "../game/plan/preview.ts";
import { provinceAt, tileAt } from "../game/tile/coords.ts";
import { planErrors } from "../game/turn/validation.ts";
import { CLAN_POWERS } from "./clan_text.ts";

const RAMPART_LABELS = ["", "fortified", "indestructible"] as const;

export interface ResourceEntry {
  tile: TileType;
  count: number;
  discounts: ActionType;
}

export interface PlanRow {
  type: ActionType;
  level: ActionLevel | null;
  costs: Record<ActionLevel, number>;
  kind: ActionKind | null;
  conditional: boolean;
  blockers: LevelBlockers;
}

export interface PlayerBoardData {
  clan: { name: string; color: string; power: string | null; chaoModifier: number | null };
  resources: ResourceEntry[];
  temples: { count: number; target: number };
  chao: number;
  target: { title: string; details: string } | null;
  canTarget: boolean;
  locked: boolean;
  finished: boolean;
  plan: {
    submitted: boolean;
    errors: string[];
    rows: PlanRow[];
    total: number;
    affordable: boolean;
    passing: boolean;
    passIncome: number;
    missingTarget: boolean;
  };
}

export function playerBoardData(
  game: GameInfo,
  player: Player,
  plan: Plan,
  selection: Coord | null,
  color: string,
  submitted: boolean,
): PlayerBoardData {
  const counts = resources(game, player.id);
  const preview = previewPlan(game, player.id, plan);
  const blockers = planBlockers(game, player.id, plan);
  const total = planCost(plan, counts);
  const passing = isPassing(plan);

  return {
    clan: {
      name: player.clan,
      color,
      power: game.options.clanPowers ? CLAN_POWERS[player.clan] : null,
      chaoModifier: game.options.clanPowers && !game.options.bidding ? CLAN_CHAO_MODIFIER[player.clan] : null,
    },
    resources: Object.values(ActionType).map((type) => ({ tile: RESOURCE_TILE[type], count: counts[type], discounts: type })),
    temples: { count: controlledTemples(game, player.id), target: templeTarget(game.turn) },
    chao: player.chao,
    target: plan.target === null ? null : targetInfo(game, player, plan.target),
    canTarget: !submitted && !game.finished && canTarget(game, plan, selection),
    locked: submitted || game.finished,
    finished: game.finished,
    plan: {
      submitted,
      errors: game.finished ? ["The game is over"] : planErrors(game, player, plan),
      rows: Object.values(ActionType).map((type) => ({
        type,
        level: plan.actions[type],
        costs: Object.fromEntries(ACTION_LEVELS.map((level) => [level, actionCost(level, counts[type])])) as Record<ActionLevel, number>,
        kind: preview[type].kind,
        conditional: preview[type].conditional,
        blockers: blockers[type],
      })),
      total,
      affordable: total <= player.chao,
      passing,
      passIncome: PASS_INCOME,
      missingTarget: !passing && plan.target === null,
    },
  };
}

function canTarget(game: GameInfo, plan: Plan, selection: Coord | null): boolean {
  if (selection === null || provinceAt(game, selection) === null) {
    return false;
  }
  return plan.target?.col !== selection.col || plan.target?.row !== selection.row;
}

function targetInfo(game: GameInfo, player: Player, coord: Coord): PlayerBoardData["target"] {
  const tile = tileAt(game, coord);
  const province = provinceAt(game, coord);
  if (tile === null || province === null) {
    return null;
  }
  const owner = game.players.find(({ id }) => id === province.owner);
  const status = owner === undefined ? "Free" : owner.id === player.id ? "Yours" : `Enemy · ${owner.clan}`;
  const building = [
    province.building === Building.City && province.doubled ? "Doubled City" : province.building,
    RAMPART_LABELS[province.ramparts],
  ]
    .filter(Boolean)
    .join(", ");
  const extras = [
    building,
    province.armies > 0 ? `${province.armies} ${province.armies > 1 ? "Armies" : "Army"}` : "",
    province.temple ? "Temple" : "",
  ].filter(Boolean);
  return { title: tile.name ?? tile.type, details: [tile.type, status, ...extras].join(" · ") };
}
