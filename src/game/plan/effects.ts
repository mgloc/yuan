import {
  ACTION_LEVELS,
  ActionKind,
  ActionType,
  Building,
  MAX_ARMIES_PER_PROVINCE,
  RESOURCE_TILE,
  templeTarget,
  type ActionLevel,
  type Coord,
  type GameInfo,
  type Plan,
  type PlayerId,
  type Province,
} from "../../game_types.ts";
import { adjacentClans } from "../tile/checks.ts";
import { adjacentProvinces } from "../tile/adjacency.ts";
import { coordKey, provinceAt, tileAt } from "../tile/coords.ts";
import { groupHasCity, groupOf } from "../tile/groups.ts";
import { isControlledBy, isEnemyOf, isFree } from "../tile/ownership.ts";
import { armySources, defenceOf, isIndestructible } from "../turn/combat.ts";
import { reserve } from "../turn/pools.ts";
import { controlledTemples } from "./economy.ts";
import { joinsCity, previewPlan } from "./preview.ts";

export interface ActionEffect {
  lines: string[];
  coords: Coord[];
}

export type LevelEffects = Record<ActionLevel, ActionEffect>;
export type PlanEffects = Record<ActionType, LevelEffects>;

const RULES: Record<ActionKind, Record<ActionLevel, string>> = {
  [ActionKind.Colonisation]: {
    1: "take a free Province adjacent or connected to yours, and its free neighbours",
    2: "as I, +2₵ at Income",
    3: "take a free Province anywhere, and its free neighbours",
  },
  [ActionKind.Expansion]: {
    1: "take every free Province around the targeted group",
    2: "as I, +2₵ at Income",
    3: "build a Temple, steal 2₵ from each adjacent Clan",
  },
  [ActionKind.Urbanisation]: {
    1: "no effect",
    2: "Village becomes a City",
    3: "Village becomes a Fortified City (defence 2), +1 Army",
  },
  [ActionKind.Reinforcement]: {
    1: "second City, doubles production",
    2: "Fortified City (defence 2) and second City",
    3: "Indestructible City (defence 1 around it), +1 Army",
  },
  [ActionKind.Recruitment]: {
    1: "no effect",
    2: "+1 Army",
    3: "+3 Armies",
  },
  [ActionKind.Attack]: {
    1: "attack with every Army adjacent or connected",
    2: "as I, +1 Army from reserve",
    3: "as II, on a win hit every adjacent enemy with strength 1",
  },
};

const TYPE_KINDS: Record<ActionType, ActionKind[]> = {
  [ActionType.Development]: [ActionKind.Colonisation, ActionKind.Expansion],
  [ActionType.Fortification]: [ActionKind.Urbanisation, ActionKind.Reinforcement],
  [ActionType.Militarisation]: [ActionKind.Recruitment, ActionKind.Attack],
};

const RECRUITS: Record<ActionLevel, number> = { 1: 0, 2: 1, 3: 3 };
const RESERVE_LEVEL = 2;
const BONUS_LEVEL = 3;
const BONUS_STRENGTH = 1;
const TEMPLE_STEAL = 2;

export function typeKinds(type: ActionType): readonly ActionKind[] {
  return TYPE_KINDS[type];
}

function rulesLines(type: ActionType, level: ActionLevel): string[] {
  return TYPE_KINDS[type].map((kind) => `${kind}: ${RULES[kind][level]}`);
}

export function planEffects(game: GameInfo, player: PlayerId, plan: Plan): PlanEffects {
  const preview = previewPlan(game, player, plan);
  const target = plan.target;
  const province = target === null ? null : provinceAt(game, target);
  const effects = {} as PlanEffects;
  for (const type of Object.values(ActionType)) {
    const { kind, conditional } = preview[type];
    effects[type] = Object.fromEntries(
      ACTION_LEVELS.map((level) => {
        if (target === null || province === null || kind === null) {
          return [level, { lines: rulesLines(type, level), coords: [] }];
        }
        const { lines, coords } = describe(game, player, target, province, kind, level);
        const all = conditional ? [...lines, "Only if the attack succeeds, refunded otherwise"] : lines;
        return [level, { lines: all.map(capitalise), coords }];
      }),
    ) as LevelEffects;
  }
  return effects;
}

function describe(game: GameInfo, player: PlayerId, target: Coord, province: Province, kind: ActionKind, level: ActionLevel): ActionEffect {
  const own = province.owner === player ? province : null;
  switch (kind) {
    case ActionKind.Colonisation:
      return colonisation(game, player, target, level);
    case ActionKind.Expansion:
      return level === 3 ? temple(game, player, target) : expansion(game, player, target, level);
    case ActionKind.Urbanisation:
      return urbanisation(game, player, own, level);
    case ActionKind.Reinforcement:
      return reinforcement(game, player, target, own, level);
    case ActionKind.Recruitment:
      return { lines: [level === 1 ? "No effect" : armiesText(game, player, own?.armies ?? 0, RECRUITS[level])], coords: [] };
    case ActionKind.Attack:
      return attack(game, player, target, province, level);
  }
}

function colonisation(game: GameInfo, player: PlayerId, target: Coord, level: ActionLevel): ActionEffect {
  const around = freeAround(game, [target]);
  const coords = [target, ...around];
  const taken = `${name(game, target)}${around.length > 0 ? ` and ${count(around.length, "free neighbour")}` : ""}`;
  const parts = [level === 3 ? `Anywhere on the map: take ${taken}` : `Take ${taken}`];
  const villages = Math.max(0, reserve(game, player).villages);
  if (villages < coords.length) {
    parts.push(`only ${count(villages, "Village")} left in reserve`);
  }
  if (!joinsCity(game, target, player, true)) {
    parts.push(`${name(game, target)} becomes a City (new group)`);
  }
  if (level === 2) {
    parts.push("+2₵ at Income");
  }
  return { lines: parts, coords };
}

function expansion(game: GameInfo, player: PlayerId, target: Coord, level: ActionLevel): ActionEffect {
  const around = freeAround(game, groupOf(game, target));
  const parts = [around.length > 0 ? `Take ${count(around.length, "free Province")} around this group` : "No free Province around this group"];
  const villages = Math.max(0, reserve(game, player).villages);
  if (villages < around.length) {
    parts.push(`only ${count(villages, "Village")} left in reserve`);
  }
  if (level === 2) {
    parts.push("+2₵ at Income");
  }
  return { lines: parts, coords: around };
}

function temple(game: GameInfo, player: PlayerId, target: Coord): ActionEffect {
  const victims = [...adjacentClans(game, target)].filter((id) => id !== player);
  const temples = `${controlledTemples(game, player) + 1}/${templeTarget(game.turn)} Temples`;
  const steal = victims.length > 0 ? `steal up to ${TEMPLE_STEAL}₵ from ${victims.map((id) => clanName(game, id)).join(", ")}` : "no adjacent Clan to steal from";
  const coords = adjacentProvinces(game, target).filter((coord) => {
    const owner = provinceAt(game, coord)?.owner ?? null;
    return owner !== null && victims.includes(owner);
  });
  return { lines: [`Build a Temple here (${temples})`, steal], coords };
}

function urbanisation(game: GameInfo, player: PlayerId, own: Province | null, level: ActionLevel): ActionEffect {
  if (level === 1) {
    return { lines: ["No effect on a Village"], coords: [] };
  }
  if (level === 2) {
    return { lines: ["Village becomes a City"], coords: [] };
  }
  return { lines: ["Village becomes a Fortified City (defence 2)", armiesText(game, player, own?.armies ?? 0, 1)], coords: [] };
}

function reinforcement(game: GameInfo, player: PlayerId, target: Coord, own: Province | null, level: ActionLevel): ActionEffect {
  const doubled = own?.doubled === true;
  const ramparts = own?.ramparts ?? 0;
  const produces = Object.values(ActionType).find((type) => RESOURCE_TILE[type] === tileAt(game, target)?.type);
  const doubling = doubled ? null : produces === undefined ? "second City (this terrain gives no discount)" : `second City: counts twice for ${produces} costs`;
  if (level === 1) {
    return { lines: [doubling ?? "Already doubled"], coords: [] };
  }
  if (level === 2) {
    const parts = [ramparts >= 1 ? null : "Fortified City (defence 2)", doubling].filter((part) => part !== null);
    return { lines: parts.length > 0 ? parts : ["No effect: already fortified and doubled"], coords: [] };
  }
  const shielded = adjacentProvinces(game, target).filter((coord) => isControlledBy(game, coord, player));
  const wall = ramparts === 2 ? "Already indestructible" : `Indestructible City: can't be destroyed, defence 1 on ${count(shielded.length, "adjacent Province")} of yours`;
  return { lines: [wall, armiesText(game, player, own?.armies ?? 0, 1)], coords: shielded };
}

function attack(game: GameInfo, player: PlayerId, target: Coord, province: Province, level: ActionLevel): ActionEffect {
  const sources = armySources(game, player, target);
  const armies = sources.reduce((sum, coord) => sum + provinceAt(game, coord)!.armies, 0);
  if (armies === 0) {
    return { lines: ["No Army of yours can reach it"], coords: [] };
  }
  const extra = level >= RESERVE_LEVEL && reserve(game, player).armies > 0 ? 1 : 0;
  const strength = armies + extra;
  const defence = defenceOf(game, target);
  const needed = province.armies + defence + 1;
  const odds = `${count(strength, "Army")}${extra > 0 ? " (1 from reserve)" : ""} vs ${count(province.armies, "Army")}${defence > 0 ? ` + defence ${defence}` : ""}`;
  const coords = [...sources];
  const parts = [odds];
  if (isIndestructible(game, target)) {
    parts.push("the City is indestructible, at best its Armies are killed");
  } else if (strength < needed) {
    parts.push(`fails, needs ${count(needed, "Army")}`);
  } else {
    parts.push(`wins with ${count(strength - province.armies, "Army")} moving in`);
    const rest = groupOf(game, target).filter((coord) => coordKey(coord) !== coordKey(target));
    if (province.building === Building.City && rest.length > 0 && !groupHasCity(game, rest)) {
      parts.push(`their group loses its last City: you also take ${count(rest.length, "Province")}`);
      coords.push(...rest);
    }
    if (level === BONUS_LEVEL) {
      const bonus = adjacentProvinces(game, target).filter((coord) => isEnemyOf(game, coord, player));
      const open = bonus.filter((coord) => provinceAt(game, coord)!.armies + defenceOf(game, coord) < BONUS_STRENGTH && !isIndestructible(game, coord));
      parts.push(bonus.length > 0 ? `then hits ${count(bonus.length, "adjacent enemy")}, ${open.length} undefended` : "no adjacent enemy for the bonus hits");
      coords.push(...open);
    }
  }
  parts.push(`all ${count(sources.length, "Province")} with reaching Armies are emptied`);
  parts.push("Before other Clans' moves");
  return { lines: parts, coords };
}

function armiesText(game: GameInfo, player: PlayerId, current: number, added: number): string {
  const gained = Math.min(added, Math.max(0, reserve(game, player).armies));
  const parts = [gained > 0 ? `+${count(gained, "Army")}` : "no Army left in reserve"];
  if (gained < added && gained > 0) {
    parts.push(`only ${gained} left in reserve`);
  }
  const excess = current + gained - MAX_ARMIES_PER_PROVINCE;
  if (excess > 0) {
    parts.push(`${excess} disbanded at end of turn (max ${MAX_ARMIES_PER_PROVINCE})`);
  }
  return parts.join(", ");
}

function freeAround(game: GameInfo, coords: Coord[]): Coord[] {
  const inside = new Set(coords.map(coordKey));
  const around = new Map<string, Coord>();
  for (const coord of coords) {
    for (const neighbor of adjacentProvinces(game, coord)) {
      if (!inside.has(coordKey(neighbor)) && isFree(game, neighbor)) {
        around.set(coordKey(neighbor), neighbor);
      }
    }
  }
  return [...around.values()];
}

function name(game: GameInfo, coord: Coord): string {
  const tile = tileAt(game, coord);
  return tile?.name ?? tile?.type ?? `${coord.col}, ${coord.row}`;
}

function clanName(game: GameInfo, player: PlayerId): string {
  return game.players.find(({ id }) => id === player)?.clan ?? `Player ${player + 1}`;
}

function count(amount: number, word: string): string {
  if (amount === 1) {
    return `1 ${word}`;
  }
  const plural = word.endsWith("y") ? `${word.slice(0, -1)}ies` : `${word}s`;
  return `${amount} ${plural}`;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
