import { element } from "./dom.ts";

export interface LandingHandlers {
  onCreate: (name: string, debug: boolean) => void;
  onJoin: (name: string, code: string) => void;
}

export class Landing {
  root: HTMLElement;
  private error: HTMLElement;
  private buttons: HTMLButtonElement[];

  constructor(container: HTMLElement, handlers: LandingHandlers, defaults: { name: string; code: string; error: string }) {
    this.root = element("main", "screen");
    const card = element("div", "screen__card");

    const name = element("input", "screen__input");
    name.placeholder = "Your name";
    name.maxLength = 24;
    name.value = defaults.name;
    const identity = element("section", "screen__section");
    identity.append(element("h2", "screen__heading", "Name"), name);

    const debug = element("input", "");
    debug.type = "checkbox";
    const debugLabel = element("label", "screen__option");
    const debugText = element("span", "");
    debugText.append(element("strong", "", "Debug mode"), element("span", "screen__hint", "Lets you play every seat, add players and restart"));
    debugLabel.append(debug, debugText);
    const create = element("button", "player-button", "Create game");
    create.addEventListener("click", () => handlers.onCreate(name.value, debug.checked));
    const createSection = element("section", "screen__section");
    createSection.append(element("h2", "screen__heading", "New game"), debugLabel, create);

    const code = element("input", "screen__input screen__input--code");
    code.placeholder = "Code";
    code.maxLength = 5;
    code.value = defaults.code;
    const join = element("button", "player-button player-button--ghost", "Join");
    const submitJoin = () => handlers.onJoin(name.value, code.value.trim().toUpperCase());
    join.addEventListener("click", submitJoin);
    code.addEventListener("keydown", (event) => event.key === "Enter" && submitJoin());
    const row = element("div", "screen__row");
    row.append(code, join);
    const joinSection = element("section", "screen__section");
    joinSection.append(element("h2", "screen__heading", "Join a game"), row);

    this.error = element("p", "screen__error", defaults.error);
    this.buttons = [create, join];
    card.append(
      element("h1", "screen__title", "Yuan"),
      element("p", "screen__subtitle", "Clans of the steppe, 13 turns to rule"),
      identity,
      createSection,
      joinSection,
      this.error,
    );
    this.root.append(card);
    container.appendChild(this.root);
    (defaults.code === "" ? name : code).focus();
  }

  setBusy(busy: boolean) {
    this.buttons.forEach((button) => (button.disabled = busy));
  }

  showError(message: string) {
    this.error.textContent = message;
  }

  dispose() {
    this.root.remove();
  }
}
