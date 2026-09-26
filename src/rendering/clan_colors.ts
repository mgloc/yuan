import { Clan } from "../game_types.ts";

export const CLAN_COLORS: Record<Clan, number> = {
  [Clan.Mu]: 0x2b2b2b,
  [Clan.Suhey]: 0xc0392b,
  [Clan.Weyu]: 0x2e8b57,
  [Clan.Xiangi]: 0xe67e22,
};

export function clanCssColor(clan: Clan): string {
  return `#${CLAN_COLORS[clan].toString(16).padStart(6, "0")}`;
}

export const UNASSIGNED_CSS_COLOR = "#8a939c";

export function seatCssColor(clan: Clan | null): string {
  return clan === null ? UNASSIGNED_CSS_COLOR : clanCssColor(clan);
}
