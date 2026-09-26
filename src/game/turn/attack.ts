import { ActionType, Building, type Coord, type GameState, type PlayerId } from "../../game_types.ts";
import { adjacentProvinces } from "../tile/adjacency.ts";
import { coordKey, provinceAt } from "../tile/coords.ts";
import { groupHasCity, groupOf } from "../tile/groups.ts";
import { ownedProvinces } from "../tile/ownership.ts";
import { armySources, clash, defenceOf, isIndestructible } from "./combat.ts";
import { activeActions, type ActiveAction, type TurnContext } from "./context.ts";
import { reserve } from "./pools.ts";

const RESERVE_LEVEL = 2;
const BONUS_LEVEL = 3;
const BONUS_STRENGTH = 1;

interface Attack {
  action: ActiveAction;
  player: PlayerId;
  strength: number;
}

interface Capture {
  coord: Coord;
  defender: PlayerId;
  players: Set<PlayerId>;
}

interface Victory {
  attack: Attack;
  survivors: number;
}

export function resolveAttacks(context: TurnContext) {
  const attacks = launchAttacks(context);
  const victories = fight(context, attacks);
  const captures = new Map<string, Capture>();
  const capture = (coord: Coord, player: PlayerId) => {
    const key = coordKey(coord);
    const defender = provinceAt(context.state, coord)!.owner!;
    const entry = captures.get(key) ?? { coord, defender, players: new Set() };
    entry.players.add(player);
    captures.set(key, entry);
  };

  victories.forEach(({ attack }) => capture(attack.action.target, attack.player));
  for (const { attack } of victories.filter(({ attack }) => attack.action.level === BONUS_LEVEL)) {
    for (const coord of bonusTargets(context, attack)) {
      const success = BONUS_STRENGTH > provinceAt(context.state, coord)!.armies + defenceOf(context.state, coord) && !isIndestructible(context.state, coord);
      context.events.push({ type: "BonusAttack", player: attack.player, target: coord, success });
      if (success) {
        capture(coord, attack.player);
      }
    }
  }

  const before = structuredClone(context.state);
  applyCaptures(context, captures, victories);
  destroyIsolatedGroups(context, before, captures);
  urbanise(context, victories);

  for (const { attack } of victories) {
    attack.action.order.attackSucceeded = provinceAt(context.state, attack.action.target)?.owner === attack.player;
  }
}

function launchAttacks(context: TurnContext): Attack[] {
  const state = context.state;
  const attacks: (Attack & { sources: Coord[] })[] = [];
  for (const action of activeActions(context, ActionType.Militarisation)) {
    const { order, target, province, level } = action;
    if (province.owner === order.player) {
      continue;
    }
    if (province.owner === null) {
      context.events.push({ type: "ActionFailed", player: order.player, action: ActionType.Militarisation, target, reason: "free Province" });
      continue;
    }
    const sources = armySources(state, order.player, target);
    const armies = sources.reduce((sum, coord) => sum + provinceAt(state, coord)!.armies, 0);
    if (armies === 0) {
      context.events.push({ type: "ActionFailed", player: order.player, action: ActionType.Militarisation, target, reason: "no Army adjacent or connected" });
      continue;
    }
    const extra = level >= RESERVE_LEVEL && reserve(state, order.player).armies > 0 ? 1 : 0;
    attacks.push({ action, player: order.player, strength: armies + extra, sources });
    context.events.push({ type: "AttackLaunched", player: order.player, target, armies, reserve: extra });
  }
  attacks.forEach(({ sources }) => sources.forEach((coord) => (provinceAt(state, coord)!.armies = 0)));
  return attacks;
}

function fight(context: TurnContext, attacks: Attack[]): Victory[] {
  const byTarget = new Map<string, Attack[]>();
  attacks.forEach((attack) => {
    const key = coordKey(attack.action.target);
    byTarget.set(key, [...(byTarget.get(key) ?? []), attack]);
  });

  const victories: Victory[] = [];
  for (const rivals of byTarget.values()) {
    const target = rivals[0].action.target;
    const remaining = clash(rivals.map(({ strength }) => strength));
    if (rivals.length > 1) {
      context.events.push({ type: "AttackersClashed", target, players: rivals.map(({ player }) => player) });
    }
    rivals.forEach((attack, i) => {
      if (remaining[i] === 0) {
        context.events.push({ type: "AttackLost", player: attack.player, target, reason: "wiped out by rival attackers" });
      }
    });
    const index = remaining.findIndex((strength) => strength > 0);
    if (index === -1) {
      continue;
    }

    const attack = rivals[index];
    const province = provinceAt(context.state, target)!;
    const defence = defenceOf(context.state, target);
    const survivors = remaining[index] - province.armies;
    province.armies = Math.max(0, province.armies - remaining[index]);
    const loss = survivors <= 0 ? "the defending Armies held" : isIndestructible(context.state, target) ? "the City is indestructible" : survivors <= defence ? "the fortifications held" : null;
    if (loss !== null) {
      context.events.push({ type: "AttackLost", player: attack.player, target, reason: loss });
      continue;
    }
    victories.push({ attack, survivors });
    context.events.push({ type: "AttackWon", player: attack.player, target, survivors });
  }
  return victories;
}

function bonusTargets(context: TurnContext, attack: Attack): Coord[] {
  return adjacentProvinces(context.state, attack.action.target).filter((coord) => {
    const owner = provinceAt(context.state, coord)?.owner ?? null;
    return owner !== null && owner !== attack.player;
  });
}

function applyCaptures(context: TurnContext, captures: Map<string, Capture>, victories: Victory[]) {
  const survivors = new Map(victories.map(({ attack, survivors }) => [coordKey(attack.action.target), survivors]));
  for (const [key, { coord, players }] of captures) {
    const province = provinceAt(context.state, coord)!;
    Object.assign(province, { owner: null, building: null, doubled: false, ramparts: 0, armies: 0 });
    const player = players.size === 1 ? [...players][0] : null;
    if (player === null || !settle(context, player, coord)) {
      context.events.push({ type: "ProvinceFreed", coord });
      continue;
    }
    province.armies = survivors.get(key) ?? 0;
    context.events.push({ type: "ProvinceCaptured", player, coord });
  }
}

function destroyIsolatedGroups(context: TurnContext, before: GameState, captures: Map<string, Capture>) {
  const state = context.state;
  const captured = new Set(captures.keys());
  const defenders = new Set([...captures.values()].map(({ defender }) => defender));
  const attackers = new Set([...captures.values()].flatMap(({ players }) => [...players]));
  const simulations = new Map([...attackers].map((attacker) => [attacker, simulate(before, captures, attacker)]));

  for (const defender of defenders) {
    const visited = new Set<string>();
    for (const coord of ownedProvinces(state, defender)) {
      if (visited.has(coordKey(coord)) || captured.has(coordKey(coord))) {
        continue;
      }
      const group = groupOf(state, coord).filter((member) => !captured.has(coordKey(member)));
      group.forEach((member) => visited.add(coordKey(member)));
      if (groupHasCity(state, group) || !groupHasCity(before, groupOf(before, coord))) {
        continue;
      }

      const shares = new Map<PlayerId | null, Coord[]>();
      for (const member of group) {
        const causes = [...simulations].filter(([, board]) => !groupHasCity(board, groupOf(board, member))).map(([attacker]) => attacker);
        const taker = causes.length === 1 ? causes[0] : null;
        shares.set(taker, [...(shares.get(taker) ?? []), member]);
      }
      for (const [taker, coords] of shares) {
        for (const member of coords) {
          Object.assign(provinceAt(state, member)!, { owner: null, building: null, doubled: false, ramparts: 0, armies: 0 });
          if (taker !== null) {
            settle(context, taker, member);
          }
        }
        context.events.push({ type: "GroupDestroyed", defender, coords, by: taker });
      }
    }
  }
}

function simulate(before: GameState, captures: Map<string, Capture>, attacker: PlayerId): GameState {
  const board = structuredClone(before);
  for (const { coord, players } of captures.values()) {
    if (players.has(attacker)) {
      Object.assign(provinceAt(board, coord)!, { owner: attacker, building: Building.Village });
    }
  }
  return board;
}

function settle(context: TurnContext, player: PlayerId, coord: Coord): boolean {
  if (reserve(context.state, player).villages < 1) {
    context.events.push({ type: "PoolExhausted", player, piece: "Village", missing: 1 });
    return false;
  }
  Object.assign(provinceAt(context.state, coord)!, { owner: player, building: Building.Village });
  return true;
}

function urbanise(context: TurnContext, victories: Victory[]) {
  for (const { attack } of victories) {
    const coord = attack.action.target;
    const province = provinceAt(context.state, coord)!;
    if (province.owner !== attack.player || province.building !== Building.Village) {
      continue;
    }
    if (groupHasCity(context.state, groupOf(context.state, coord))) {
      continue;
    }
    if (reserve(context.state, attack.player).cities < 1) {
      context.events.push({ type: "PoolExhausted", player: attack.player, piece: "City", missing: 1 });
      continue;
    }
    province.building = Building.City;
    context.events.push({ type: "Urbanised", player: attack.player, coord });
  }
}
