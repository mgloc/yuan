import { Clan } from "../game_types.ts";

export const CLAN_POWERS: Record<Clan, string> = {
  [Clan.Mu]: "Also wins with 3× the wheel target in Provinces (a Temple counts as 2). Wins ties.",
  [Clan.Suhey]: "Provinces left neutral by another Clan during Development are still gained.",
  [Clan.Weyu]: "Isolated attacking Armies may cross one Mountain and up to two Water cells.",
  [Clan.Xiangi]: "Crosses at most 2 Water cells. Between 2 Mountains with an Army: +2 defence.",
};
