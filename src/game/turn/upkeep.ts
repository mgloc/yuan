import { MAX_ARMIES_PER_PROVINCE, VOLCANO_ERUPTION_TURNS } from "../../game_types.ts";
import { isAdjacentToVolcano } from "../tile/checks.ts";
import { allCoords, provinceAt } from "../tile/coords.ts";
import type { TurnContext } from "./context.ts";

export function upkeep(context: TurnContext) {
  const state = context.state;
  for (const coord of allCoords(state)) {
    const province = provinceAt(state, coord);
    if (province !== null && province.armies > MAX_ARMIES_PER_PROVINCE) {
      context.events.push({ type: "ArmiesDisbanded", coord, count: province.armies - MAX_ARMIES_PER_PROVINCE });
      province.armies = MAX_ARMIES_PER_PROVINCE;
    }
  }

  if (!VOLCANO_ERUPTION_TURNS.has(state.turn)) {
    return;
  }
  const erupted = allCoords(state).filter((coord) => provinceAt(state, coord)?.owner != null && isAdjacentToVolcano(state, coord));
  for (const coord of erupted) {
    Object.assign(provinceAt(state, coord)!, { owner: null, building: null, doubled: false, ramparts: 0, armies: 0 });
  }
  context.events.push({ type: "Eruption", coords: erupted });
}
