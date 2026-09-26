import {
  ActionKind,
  ActionType,
  Building,
  Clan,
  DEVELOPMENT_II_INCOME,
  TEMPLE_STEAL_AMOUNT,
  type Coord,
  type PlayerId,
} from "../../game_types.ts";
import { adjacentClans } from "../tile/checks.ts";
import { adjacentProvinces } from "../tile/adjacency.ts";
import { coordKey, provinceAt } from "../tile/coords.ts";
import { groupHasCity, groupOf } from "../tile/groups.ts";
import { isFree } from "../tile/ownership.ts";
import { canColonise } from "../tile/reach.ts";
import { activeActions, playerOf, type ActiveAction, type TurnContext } from "./context.ts";
import { reserve } from "./pools.ts";

const DEVELOPMENT_INCOME_LEVEL = 2;
const TEMPLE_LEVEL = 3;
const ANYWHERE_LEVEL = 3;

interface Claim {
  coord: Coord;
  players: Set<PlayerId>;
}

interface TempleBuild {
  player: PlayerId;
  coord: Coord;
}

export function resolveDevelopment(context: TurnContext) {
  const claims = new Map<string, Claim>();
  const targets = new Map<string, PlayerId>();
  const colonisations: ActiveAction[] = [];
  const temples: TempleBuild[] = [];

  const claim = (player: PlayerId, coords: Coord[]) =>
    coords.forEach((coord) => {
      const key = coordKey(coord);
      const entry = claims.get(key) ?? { coord, players: new Set() };
      entry.players.add(player);
      claims.set(key, entry);
    });

  for (const action of activeActions(context, ActionType.Development)) {
    const { order, level, target, province } = action;
    const player = order.player;
    if (province.owner === null) {
      if (level < ANYWHERE_LEVEL && !canColonise(context.state, player, target)) {
        fail(context, action, "not adjacent or connected to your Provinces");
        continue;
      }
      targets.set(coordKey(target), player);
      claim(player, [target, ...freeAround(context, [target])]);
      colonisations.push(action);
      resolved(context, action, ActionKind.Colonisation);
    } else if (province.owner === player) {
      if (level === TEMPLE_LEVEL) {
        if (province.temple) {
          fail(context, action, "already has a Temple");
          continue;
        }
        temples.push({ player, coord: target });
      } else {
        claim(player, freeAround(context, groupOf(context.state, target)));
      }
      resolved(context, action, ActionKind.Expansion);
    } else {
      fail(context, action, "enemy Province");
      continue;
    }
    if (level === DEVELOPMENT_INCOME_LEVEL) {
      order.income += DEVELOPMENT_II_INCOME;
    }
  }

  placeClaims(context, claims, targets);
  urbanise(context, colonisations);
  buildTemples(context, temples);
}

function freeAround(context: TurnContext, coords: Coord[]): Coord[] {
  const inside = new Set(coords.map(coordKey));
  const around = new Map<string, Coord>();
  for (const coord of coords) {
    for (const neighbor of adjacentProvinces(context.state, coord)) {
      const key = coordKey(neighbor);
      if (!inside.has(key) && isFree(context.state, neighbor)) {
        around.set(key, neighbor);
      }
    }
  }
  return [...around.values()];
}

function placeClaims(context: TurnContext, claims: Map<string, Claim>, targets: Map<string, PlayerId>) {
  const gains = new Map<PlayerId, Coord[]>();
  for (const [key, { coord, players }] of claims) {
    const winner = targets.get(key) ?? (players.size === 1 ? [...players][0] : suheyAmong(context, players));
    if (winner === null) {
      context.events.push({ type: "ProvinceContested", coord, players: [...players] });
      continue;
    }
    gains.set(winner, [...(gains.get(winner) ?? []), coord]);
  }

  for (const [player, coords] of gains) {
    const ordered = [...coords].sort((a, b) => Number(targets.has(coordKey(b))) - Number(targets.has(coordKey(a))));
    const available = Math.max(0, reserve(context.state, player).villages);
    const placed = ordered.slice(0, available);
    for (const coord of placed) {
      const province = provinceAt(context.state, coord)!;
      province.owner = player;
      province.building = Building.Village;
    }
    if (placed.length > 0) {
      context.events.push({ type: "VillagesPlaced", player, coords: placed });
    }
    if (placed.length < ordered.length) {
      context.events.push({ type: "PoolExhausted", player, piece: "Village", missing: ordered.length - placed.length });
    }
  }
}

function suheyAmong(context: TurnContext, players: Set<PlayerId>): PlayerId | null {
  if (!context.state.options.clanPowers) {
    return null;
  }
  return [...players].find((id) => playerOf(context, id).clan === Clan.Suhey) ?? null;
}

function urbanise(context: TurnContext, colonisations: ActiveAction[]) {
  for (const { order, target } of colonisations) {
    const province = provinceAt(context.state, target)!;
    if (province.owner !== order.player || province.building !== Building.Village) {
      continue;
    }
    if (groupHasCity(context.state, groupOf(context.state, target))) {
      continue;
    }
    if (reserve(context.state, order.player).cities < 1) {
      context.events.push({ type: "PoolExhausted", player: order.player, piece: "City", missing: 1 });
      continue;
    }
    province.building = Building.City;
    context.events.push({ type: "Urbanised", player: order.player, coord: target });
  }
}

function buildTemples(context: TurnContext, temples: TempleBuild[]) {
  const victims = new Map<PlayerId, Set<PlayerId>>();
  for (const temple of temples) {
    provinceAt(context.state, temple.coord)!.temple = true;
    context.events.push({ type: "TempleBuilt", player: temple.player, coord: temple.coord });
    victims.set(temple.player, adjacentClans(context.state, temple.coord));
    victims.get(temple.player)!.delete(temple.player);
  }

  const thieves = new Map<PlayerId, PlayerId[]>();
  for (const [thief, targets] of victims) {
    for (const victim of targets) {
      if (victims.get(victim)?.has(thief)) {
        continue;
      }
      thieves.set(victim, [...(thieves.get(victim) ?? []), thief]);
    }
  }

  for (const [victimId, stealing] of thieves) {
    const victim = playerOf(context, victimId);
    const amount = Math.min(TEMPLE_STEAL_AMOUNT, Math.floor(Math.max(0, victim.chao) / stealing.length));
    if (amount === 0) {
      continue;
    }
    for (const thief of stealing) {
      victim.chao -= amount;
      playerOf(context, thief).chao += amount;
      context.events.push({ type: "ChaoStolen", from: victimId, to: thief, amount });
    }
  }
}

function resolved(context: TurnContext, { order, level, target }: ActiveAction, kind: ActionKind) {
  context.events.push({ type: "ActionResolved", player: order.player, kind, level, target });
}

function fail(context: TurnContext, { order, target }: ActiveAction, reason: string) {
  context.events.push({ type: "ActionFailed", player: order.player, action: ActionType.Development, target, reason });
}
