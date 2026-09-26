import { element } from "./dom.ts";

export interface GameSettingsValues {
  clanPowers: boolean;
}

export class GameSettings {
  button: HTMLButtonElement;
  panel: HTMLElement;
  private clanPowers: HTMLInputElement;

  constructor(onNewGame: (values: GameSettingsValues) => void) {
    this.button = element("button", "player-button player-button--ghost", "Game");
    this.panel = element("section", "game-settings");
    this.panel.hidden = true;

    this.clanPowers = element("input", "game-settings__checkbox");
    this.clanPowers.type = "checkbox";
    const label = element("label", "game-settings__option");
    const text = element("span", "");
    text.append(element("strong", "", "Clan rules"), element("span", "game-settings__hint", "Starting Chão modifiers and clan powers"));
    label.append(this.clanPowers, text);

    const start = element("button", "player-button", "Start new game");
    start.addEventListener("click", () => {
      this.panel.hidden = true;
      onNewGame({ clanPowers: this.clanPowers.checked });
    });
    const note = element("p", "game-settings__hint", "Changing the rules restarts the game.");
    this.panel.append(element("h4", "turn-log__heading", "Game settings"), label, note, start);

    this.button.addEventListener("click", () => (this.panel.hidden = !this.panel.hidden));
  }

  update(values: GameSettingsValues) {
    if (this.panel.hidden) {
      this.clanPowers.checked = values.clanPowers;
    }
  }
}
