import type { Coord, GameInfo, PlayerId } from "../game_types.ts";
import { tileAt } from "../game/tile/coords.ts";
import type { TurnEvent } from "../game/turn/events.ts";

const ROMAN = ["", "I", "II", "III"];

export type LogPart = string | { text: string; player: PlayerId };
type LogValue = LogPart | LogPart[] | number;

function t(strings: TemplateStringsArray, ...values: LogValue[]): LogPart[] {
  return strings.flatMap((text, i) => {
    const value = i < values.length ? values[i] : [];
    return [text, ...(Array.isArray(value) ? value : [typeof value === "number" ? String(value) : value])];
  }).filter((part) => part !== "");
}

export function eventText(game: GameInfo, event: TurnEvent): LogPart[] {
  const clan = (player: PlayerId): LogPart => ({ text: game.players.find(({ id }) => id === player)?.clan ?? `Player ${player}`, player });
  const clans = (players: PlayerId[]) => players.flatMap((player, i) => (i === 0 ? [clan(player)] : [" and ", clan(player)]));
  const place = (coord: Coord) => tileAt(game, coord)?.name ?? `${coord.col}, ${coord.row}`;
  const places = (coords: Coord[]) => coords.map(place).join(", ");
  switch (event.type) {
    case "Passed":
      return t`${clan(event.player)} passed`;
    case "ColonisationCollision":
      return t`${clans(event.players)} all colonised ${place(event.target)}: their actions are cancelled`;
    case "Paid":
      return t`${clan(event.player)} paid ${event.amount}₵`;
    case "ActionResolved":
      return t`${clan(event.player)}: ${event.kind} ${ROMAN[event.level]} on ${place(event.target)}`;
    case "ActionFailed":
      return t`${clan(event.player)}: ${event.action} on ${place(event.target)} failed (${event.reason})`;
    case "AttackLaunched":
      return t`${clan(event.player)} attacks ${place(event.target)} with ${event.armies + event.reserve} ${event.armies + event.reserve > 1 ? "Armies" : "Army"}${event.reserve > 0 ? " (1 from reserve)" : ""}`;
    case "AttackersClashed":
      return t`${clans(event.players)} clash over ${place(event.target)}`;
    case "AttackWon":
      return t`${clan(event.player)} takes ${place(event.target)} with ${event.survivors} ${event.survivors > 1 ? "Armies" : "Army"} left`;
    case "AttackLost":
      return t`${clan(event.player)} failed to take ${place(event.target)}: ${event.reason}`;
    case "BonusAttack":
      return t`${clan(event.player)} bonus attack on ${place(event.target)} ${event.success ? "succeeded" : "failed"}`;
    case "ProvinceCaptured":
      return t`${clan(event.player)} now controls ${place(event.coord)}`;
    case "ProvinceFreed":
      return t`${place(event.coord)} is now free`;
    case "GroupDestroyed":
      return t`${clan(event.defender)} lost ${places(event.coords)} (no City left)${event.by === null ? ": now free" : t` to ${clan(event.by)}`}`;
    case "VillagesPlaced":
      return t`${clan(event.player)} placed Villages on ${places(event.coords)}`;
    case "ProvinceContested":
      return t`${place(event.coord)} stays free, claimed by ${clans(event.players)}`;
    case "PoolExhausted":
      return t`${clan(event.player)} is out of ${event.piece} pieces (${event.missing} missing)`;
    case "Urbanised":
      return t`${place(event.coord)} became a City for ${clan(event.player)}`;
    case "TempleBuilt":
      return t`${clan(event.player)} built a Temple on ${place(event.coord)}`;
    case "ChaoStolen":
      return t`${clan(event.to)} stole ${event.amount}₵ from ${clan(event.from)}`;
    case "ArmiesCreated":
      return t`${clan(event.player)} gained ${event.count} ${event.count > 1 ? "Armies" : "Army"} on ${place(event.coord)}`;
    case "Refunded":
      return t`${clan(event.player)} was refunded ${event.amount}₵`;
    case "Income":
      return t`${clan(event.player)} earned ${event.amount}₵`;
    case "ArmiesDisbanded":
      return t`${event.count} ${event.count > 1 ? "Armies" : "Army"} disbanded on ${place(event.coord)}`;
    case "Eruption":
      return event.coords.length > 0 ? t`The Volcano erupted: ${places(event.coords)} are now free` : ["The Volcano erupted"];
    case "Victory":
      return t`${clan(event.player)} wins!`;
  }
}
