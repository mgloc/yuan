import { MapMode } from "../protocol.ts";
import { element } from "./dom.ts";

const MAP_CHOICES: readonly { mode: MapMode; title: string; hint: string }[] = [
  { mode: MapMode.Prebuilt, title: "Prebuilt map", hint: "Start right away on a ready-made map" },
  { mode: MapMode.Custom, title: "Build it together", hint: "Place Territory tiles in turns, then agree on Cities and Temples" },
];

export interface LobbySeat {
  name: string;
  clan: string;
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
  map: MapMode;
}

export interface LobbyHandlers {
  onClanPowers: (enabled: boolean) => void;
  onMap: (mode: MapMode) => void;
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
  private maps: { mode: MapMode; input: HTMLInputElement; label: HTMLElement }[];
  private addPlayer: HTMLButtonElement;
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
    const optionsSection = element("section", "screen__section");
    optionsSection.append(element("h2", "screen__heading", "Options"), this.clanLabel, element("h2", "screen__heading", "Map"), ...this.maps.map(({ label }) => label));

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
        row.append(element("span", "lobby__name", seat.name), element("span", "lobby__clan", seat.clan));
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
    this.clanPowers.checked = data.clanPowers;
    this.clanPowers.disabled = !data.isHost;
    this.clanLabel.classList.toggle("screen__option--disabled", !data.isHost);

    const enough = data.seats.length >= data.minPlayers;
    this.exit.textContent = data.isHost ? "Delete lobby" : "Leave lobby";
    this.exit.classList.toggle("screen__link--danger", data.isHost);
    this.launch.hidden = !data.isHost;
    this.launch.disabled = !enough;
    this.hint.textContent = !data.isHost
      ? "Waiting for the host to launch the game"
      : enough
        ? `${data.seats.length} players ready`
        : `At least ${data.minPlayers} players are needed. Share the code to invite them.`;
  }

  dispose() {
    this.root.remove();
  }
}
