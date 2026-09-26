import "./clan_panel.css";
import { element } from "./dom.ts";
import type { PlayerBoardData } from "./player_board_data.ts";

const OPEN_KEY = "yuan:clan-open";

export class ClanPanel {
  root: HTMLElement;
  private header: HTMLButtonElement;
  private name: HTMLElement;
  private power: HTMLElement;
  private modifier: HTMLElement;
  private open = readOpen();

  constructor(container: HTMLElement) {
    this.root = element("aside", "clan-panel");
    this.header = element("button", "clan-panel__header");
    this.header.title = "Clan power";
    this.name = element("span", "clan-panel__name");
    this.header.append(element("span", "clan-panel__dot"), this.name, element("span", "clan-panel__chevron"));
    this.header.addEventListener("click", () => this.setOpen(!this.open));
    const body = element("div", "clan-panel__body");
    this.power = element("p", "clan-panel__power");
    this.modifier = element("p", "clan-panel__hint");
    body.append(this.power, this.modifier);
    this.root.append(this.header, body);
    container.appendChild(this.root);
    this.render();
  }

  update({ clan }: PlayerBoardData) {
    this.root.style.setProperty("--clan-color", clan.color);
    this.name.textContent = clan.name;
    this.power.textContent = clan.power ?? "Clan powers disabled";
    this.power.classList.toggle("clan-panel__hint", clan.power === null);
    this.modifier.hidden = clan.chaoModifier === null;
    this.modifier.textContent = `Starting Chão ${clan.chaoModifier === 0 ? "±0" : clan.chaoModifier}`;
  }

  dispose() {
    this.root.remove();
  }

  private setOpen(open: boolean) {
    this.open = open;
    try {
      localStorage.setItem(OPEN_KEY, open ? "1" : "0");
    } catch {}
    this.render();
  }

  private render() {
    this.root.classList.toggle("clan-panel--open", this.open);
    this.header.setAttribute("aria-expanded", String(this.open));
  }
}

function readOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) === "1";
  } catch {
    return false;
  }
}
