import type { CustomMapSummary } from "../game/custom_map.ts";
import { MapMode } from "../protocol.ts";
import { element } from "./dom.ts";

const MAP_CHOICES: readonly { mode: MapMode; title: string; hint: string }[] = [
  { mode: MapMode.Prebuilt, title: "Prebuilt map", hint: "Start right away on a ready-made map" },
  { mode: MapMode.Custom, title: "Build it together", hint: "Place Territory tiles in turns, then agree on Cities and Temples" },
  { mode: MapMode.Imported, title: "Your map", hint: "Play a map exported from the map maker (.json)" },
];

export interface LobbySeat {
  name: string;
  color: string;
  host: boolean;
  you: boolean;
  placeholder: boolean;
}

export interface LobbyData {
  code: string;
  seats: LobbySeat[];
  maxPlayers: number;
  minPlayers: number;
  isHost: boolean;
  debug: boolean;
  clanPowers: boolean;
  bidding: boolean;
  map: MapMode;
  customMap: CustomMapSummary | null;
  clans: { clan: string; color: string; selected: boolean }[];
}

export interface LobbyHandlers {
  onClanPowers: (enabled: boolean) => void;
  onBidding: (enabled: boolean) => void;
  onToggleClan: (clan: string) => void;
  onMap: (mode: MapMode) => void;
  onLoadMap: (file: File) => void;
  onLaunch: () => void;
  onAddPlayer: () => void;
  onCopyLink: () => void;
  onExit: () => void;
}

export class Lobby {
  root: HTMLElement;
  private code: HTMLElement;
  private badges: HTMLElement;
  private players: HTMLElement;
  private clanPowers: HTMLInputElement;
  private clanLabel: HTMLElement;
  private bidding: HTMLInputElement;
  private biddingLabel: HTMLElement;
  private clanChips: HTMLElement;
  private clanHint: HTMLElement;
  private handlers: LobbyHandlers;
  private maps: { mode: MapMode; input: HTMLInputElement; label: HTMLElement }[];
  private addPlayer: HTMLButtonElement;
  private mapFile: HTMLElement;
  private loadMap: HTMLButtonElement;
  private mapSummary: HTMLElement;
  private launch: HTMLButtonElement;
  private hint: HTMLElement;
  private exit: HTMLButtonElement;

  constructor(container: HTMLElement, handlers: LobbyHandlers) {
    this.root = element("main", "screen");
    const card = element("div", "screen__card");

    this.code = element("strong", "");
    const copy = element("button", "player-button player-button--ghost", "Copy invite link");
    copy.addEventListener("click", () => {
      handlers.onCopyLink();
      copy.textContent = "Copied";
      setTimeout(() => (copy.textContent = "Copy invite link"), 1500);
    });
    const codeRow = element("div", "lobby__code");
    const codeBlock = element("div", "screen__section");
    codeBlock.append(element("h2", "screen__heading", "Game code"), this.code);
    codeRow.append(codeBlock, copy);

    this.badges = element("div", "screen__row");
    this.players = element("ul", "lobby__players");
    this.addPlayer = element("button", "player-button player-button--ghost", "Add player");
    this.addPlayer.addEventListener("click", handlers.onAddPlayer);
    const playersSection = element("section", "screen__section");
    playersSection.append(element("h2", "screen__heading", "Players"), this.players, this.addPlayer);

    this.clanPowers = element("input", "");
    this.clanPowers.type = "checkbox";
    this.clanPowers.addEventListener("change", () => handlers.onClanPowers(this.clanPowers.checked));
    this.clanLabel = element("label", "screen__option");
    const clanText = element("span", "");
    clanText.append(element("strong", "", "Clan rules"), element("span", "screen__hint", "Starting Chão modifiers and clan powers"));
    this.clanLabel.append(this.clanPowers, clanText);
    this.handlers = handlers;
    this.clanChips = element("div", "lobby__clans");
    this.clanHint = element("p", "screen__hint");
    this.bidding = element("input", "");
    this.bidding.type = "checkbox";
    this.bidding.addEventListener("change", () => handlers.onBidding(this.bidding.checked));
    this.biddingLabel = element("label", "screen__option");
    const biddingText = element("span", "");
    biddingText.append(
      element("strong", "", "Bidding"),
      element("span", "screen__hint", "Bid Chão to pick your capital, and so your Clan. Without it, Clans are drawn at random."),
    );
    this.biddingLabel.append(this.bidding, biddingText);
    this.maps = MAP_CHOICES.map(({ mode, title, hint }) => {
      const input = element("input", "");
      input.type = "radio";
      input.name = "lobby-map";
      input.addEventListener("change", () => input.checked && handlers.onMap(mode));
      const label = element("label", "screen__option");
      const text = element("span", "");
      text.append(element("strong", "", title), element("span", "screen__hint", hint));
      label.append(input, text);
      return { mode, input, label };
    });
    const fileInput = element("input", "");
    fileInput.type = "file";
    fileInput.accept = "application/json,.json";
    fileInput.hidden = true;
    fileInput.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      fileInput.value = "";
      if (file) {
        handlers.onLoadMap(file);
      }
    });
    this.loadMap = element("button", "player-button player-button--ghost", "Load .json map");
    this.loadMap.addEventListener("click", () => fileInput.click());
    this.mapSummary = element("p", "screen__hint");
    this.mapFile = element("div", "lobby__map-file");
    this.mapFile.append(this.mapSummary, this.loadMap, fileInput);
    const optionsSection = element("section", "screen__section");
    optionsSection.append(
      element("h2", "screen__heading", "Options"),
      this.clanLabel,
      this.biddingLabel,
      element("h2", "screen__heading", "Clans in play"),
      this.clanChips,
      this.clanHint,
      element("h2", "screen__heading", "Map"), ...this.maps.map(({ label }) => label), this.mapFile);

    this.launch = element("button", "player-button", "Launch game");
    this.launch.addEventListener("click", handlers.onLaunch);
    this.hint = element("p", "screen__hint");
    this.exit = element("button", "screen__link");
    this.exit.addEventListener("click", handlers.onExit);
    const launchSection = element("section", "screen__section");
    launchSection.append(this.launch, this.hint, this.exit);

    card.append(codeRow, this.badges, playersSection, optionsSection, launchSection);
    this.root.append(card);
    container.appendChild(this.root);
  }

  update(data: LobbyData) {
    this.code.textContent = data.code;
    this.badges.replaceChildren(...(data.debug ? [element("span", "lobby__badge lobby__badge--debug", "Debug mode")] : []));
    this.badges.hidden = !data.debug;

    const empty = Array.from({ length: data.maxPlayers - data.seats.length }, () => {
      const row = element("li", "lobby__player lobby__player--empty", "Waiting for a player…");
      row.style.setProperty("--seat-color", "#4a5058");
      return row;
    });
    this.players.replaceChildren(
      ...data.seats.map((seat) => {
        const row = element("li", "lobby__player");
        row.style.setProperty("--seat-color", seat.color);
        row.append(element("span", "lobby__name", seat.name));
        if (seat.host) {
          row.append(element("span", "lobby__badge", "Host"));
        }
        if (seat.placeholder) {
          row.append(element("span", "lobby__badge", "Placeholder"));
        }
        if (seat.you) {
          row.append(element("span", "lobby__badge", "You"));
        }
        return row;
      }),
      ...empty,
    );

    const full = data.seats.length >= data.maxPlayers;
    this.addPlayer.hidden = !(data.debug && data.isHost);
    this.addPlayer.disabled = full;

    for (const { mode, input, label } of this.maps) {
      input.checked = data.map === mode;
      input.disabled = !data.isHost;
      label.classList.toggle("screen__option--disabled", !data.isHost);
    }
    this.mapFile.hidden = data.map !== MapMode.Imported;
    this.loadMap.hidden = !data.isHost;
    this.loadMap.textContent = data.customMap === null ? "Load .json map" : "Load another map";
    this.mapSummary.textContent = data.customMap === null ? "No map loaded yet." : mapText(data.customMap, data.seats.length);
    this.mapSummary.classList.toggle("screen__error", data.map === MapMode.Imported && data.customMap === null);
    this.bidding.checked = data.bidding;
    this.bidding.disabled = !data.isHost;
    this.biddingLabel.classList.toggle("screen__option--disabled", !data.isHost);
    this.clanPowers.checked = data.clanPowers;
    this.clanPowers.disabled = !data.isHost;
    this.clanLabel.classList.toggle("screen__option--disabled", !data.isHost);

    const picked = data.clans.filter(({ selected }) => selected).length;
    const players = data.seats.length;
    this.clanChips.replaceChildren(
      ...data.clans.map(({ clan, color, selected }) => {
        const chip = element("button", `lobby__chip${selected ? " lobby__chip--selected" : ""}`, clan);
        chip.style.setProperty("--seat-color", color);
        chip.disabled = !data.isHost;
        chip.setAttribute("aria-pressed", String(selected));
        chip.addEventListener("click", () => this.handlers.onToggleClan(clan));
        return chip;
      }),
    );
    const clansReady = picked === 0 || picked === players;
    this.clanHint.textContent =
      picked === 0
        ? `None picked: the first ${players} Clans are used.`
        : picked === players
          ? "One Clan per player, ready."
          : `Pick ${players} Clans, one per player (${picked} picked).`;
    this.clanHint.classList.toggle("screen__error", !clansReady);
    const mapReady = data.map !== MapMode.Imported || data.customMap !== null;
    const enough = data.seats.length >= data.minPlayers && clansReady && mapReady;
    this.exit.textContent = data.isHost ? "Delete lobby" : "Leave lobby";
    this.exit.classList.toggle("screen__link--danger", data.isHost);
    this.launch.hidden = !data.isHost;
    this.launch.disabled = !enough;
    this.hint.textContent = !data.isHost
      ? "Waiting for the host to launch the game"
      : enough
        ? `${data.seats.length} players ready`
        : !mapReady
          ? "Load a map file to play your map."
          : `At least ${data.minPlayers} players are needed. Share the code to invite them.`;
  }

  dispose() {
    this.root.remove();
  }
}

function mapText(map: CustomMapSummary, players: number): string {
  const capitals = map.capitals.length >= players ? `${map.capitals.length} fixed Capitals` : "Cities agreed at setup";
  const temples = map.temples === null ? "Temples placed at setup" : `${map.temples} fixed Temples`;
  const made = map.players !== null && map.players !== players ? ` · made for ${map.players} players` : "";
  return `${map.name}: ${map.provinces} Provinces · ${capitals} · ${temples}${map.bidding ? " · bidding" : ""}${made}`;
}
