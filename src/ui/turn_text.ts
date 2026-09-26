import type { Coord, GameState, PlayerId } from "../game_types.ts";
import { tileAt } from "../game/tile/coords.ts";
import type { TurnEvent } from "../game/turn/events.ts";

const ROMAN = ["", "I", "II", "III"];

export function eventText(game: GameState, event: TurnEvent): string {
  const clan = (player: PlayerId) => game.players.find(({ id }) => id === player)?.clan ?? `Player ${player}`;
  const place = (coord: Coord) => tileAt(game, coord)?.name ?? `${coord.col}, ${coord.row}`;
  const places = (coords: Coord[]) => coords.map(place).join(", ");
  switch (event.type) {
    case "Passed":
      return `${clan(event.player)} passed`;
    case "ColonisationCollision":
      return `${event.players.map(clan).join(" and ")} all colonised ${place(event.target)}: their actions are cancelled`;
    case "Paid":
      return `${clan(event.player)} paid ${event.amount}₵`;
    case "ActionResolved":
      return `${clan(event.player)}: ${event.kind} ${ROMAN[event.level]} on ${place(event.target)}`;
    case "ActionFailed":
      return `${clan(event.player)}: ${event.action} on ${place(event.target)} failed (${event.reason})`;
    case "AttackPending":
      return `${clan(event.player)} attacks ${place(event.target)}: combat is not implemented yet, the attack fails`;
    case "VillagesPlaced":
      return `${clan(event.player)} placed Villages on ${places(event.coords)}`;
    case "ProvinceContested":
      return `${place(event.coord)} stays free, claimed by ${event.players.map(clan).join(" and ")}`;
    case "PoolExhausted":
      return `${clan(event.player)} is out of ${event.piece} pieces (${event.missing} missing)`;
    case "Urbanised":
      return `${place(event.coord)} became a City for ${clan(event.player)}`;
    case "TempleBuilt":
      return `${clan(event.player)} built a Temple on ${place(event.coord)}`;
    case "ChaoStolen":
      return `${clan(event.to)} stole ${event.amount}₵ from ${clan(event.from)}`;
    case "ArmiesCreated":
      return `${clan(event.player)} gained ${event.count} ${event.count > 1 ? "Armies" : "Army"} on ${place(event.coord)}`;
    case "Refunded":
      return `${clan(event.player)} was refunded ${event.amount}₵`;
    case "Income":
      return `${clan(event.player)} earned ${event.amount}₵`;
    case "ArmiesDisbanded":
      return `${event.count} ${event.count > 1 ? "Armies" : "Army"} disbanded on ${place(event.coord)}`;
    case "Eruption":
      return event.coords.length > 0 ? `The Volcano erupted: ${places(event.coords)} are now free` : "The Volcano erupted";
    case "Victory":
      return `${clan(event.player)} wins!`;
  }
}
