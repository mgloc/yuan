import { card, element } from "./dom.ts";
import type { PlayerBoardData } from "./player_board_data.ts";

export class ClanCard {
  root: HTMLElement;
  private name: HTMLElement;
  private power: HTMLElement;
  private modifier: HTMLElement;

  constructor() {
    const { root, body } = card("Clan");
    this.root = root;
    this.name = element("div", "clan-name");
    this.power = element("p", "clan-power");
    this.modifier = element("p", "player-card__hint");
    body.append(this.name, this.power, this.modifier);
  }

  update(data: PlayerBoardData) {
    const clan = data.clan;
    this.root.style.setProperty("--clan-color", clan.color);
    this.name.replaceChildren(element("span", "clan-name__dot"), clan.name);
    this.power.textContent = clan.power ?? "Clan powers disabled";
    this.power.classList.toggle("player-card__hint", clan.power === null);
    this.modifier.hidden = clan.chaoModifier === null;
    this.modifier.textContent = `Starting Chão ${clan.chaoModifier === 0 ? "±0" : clan.chaoModifier}`;
  }
}
