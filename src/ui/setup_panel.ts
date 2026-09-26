import "./setup_panel.css";
import type { PlayerId } from "../game_types.ts";
import { DIRECTIONS } from "../game/setup/hex.ts";
import { SetupStage } from "../game/setup/setup.ts";
import { element } from "./dom.ts";

const SVG = "http://www.w3.org/2000/svg";
const HEX_SIZE = 9;

export interface SetupCell {
  color: string;
  label: string;
}

export interface SetupTile {
  id: string;
  cells: SetupCell[];
}

export interface SetupSeat {
  id: PlayerId;
  name: string;
  clan: string;
  color: string;
}

export interface SetupPanelData {
  stage: SetupStage;
  prebuilt: boolean;
  seats: SetupSeat[];
  tiles: {
    yourTurn: boolean;
    message: string;
    hand: SetupTile[];
    selected: string | null;
    rotation: number;
    placed: number;
    total: number;
    hint: string | null;
    hands: { seat: SetupSeat; count: number; playing: boolean }[];
  } | null;
  cities: { rows: { seat: SetupSeat; location: string | null }[]; selected: PlayerId } | null;
  temples: { count: number; max: number } | null;
  agreement: { agreed: PlayerId[]; you: PlayerId; error: string | null } | null;
}

export interface SetupPanelHandlers {
  onSelectTile: (id: string) => void;
  onRotate: (delta: number) => void;
  onSelectClan: (clan: PlayerId) => void;
  onClearCity: (clan: PlayerId) => void;
  onAgree: (agreed: boolean) => void;
}

const STEPS: readonly [SetupStage, string][] = [
  [SetupStage.Tiles, "Territory tiles"],
  [SetupStage.Cities, "Starting Cities"],
  [SetupStage.Temples, "Temples"],
];

export class SetupPanel {
  root: HTMLElement;
  private steps: HTMLElement;
  private body: HTMLElement;
  private footer: HTMLElement;
  private handlers: SetupPanelHandlers;

  constructor(container: HTMLElement, handlers: SetupPanelHandlers) {
    this.handlers = handlers;
    this.root = element("footer", "setup-panel");
    this.steps = element("ol", "setup-panel__steps");
    this.body = element("div", "setup-panel__body");
    this.footer = element("div", "setup-panel__footer");
    this.root.append(this.steps, this.body, this.footer);
    container.appendChild(this.root);
  }

  update(data: SetupPanelData) {
    const current = STEPS.findIndex(([stage]) => stage === data.stage);
    const labels = data.prebuilt ? ["Prebuilt map", "Starting Cities", "Temples pre-placed"] : STEPS.map(([, label]) => label);
    this.steps.replaceChildren(
      ...labels.map((label, i) => {
        const state = i < current || (data.prebuilt && i !== current) ? "done" : i === current ? "current" : "todo";
        const step = element("li", `setup-panel__step setup-panel__step--${state}`);
        step.append(element("span", "setup-panel__step-number", state === "done" ? "✓" : String(i + 1)), element("span", "", label));
        return step;
      }),
    );
    this.body.replaceChildren(...(data.tiles ? this.tiles(data.tiles) : data.cities ? this.cities(data.cities) : data.temples ? this.temples(data.temples) : []));
    this.footer.replaceChildren(...(data.agreement ? this.agreement(data.agreement, data.seats) : []));
    this.footer.hidden = data.agreement === null;
  }

  dispose() {
    this.root.remove();
  }

  private tiles(tiles: NonNullable<SetupPanelData["tiles"]>): HTMLElement[] {
    const status = element("div", "setup-panel__status");
    status.append(element("strong", "", tiles.message), element("span", "setup-panel__hint", `${tiles.placed} / ${tiles.total} tiles placed`));

    const hand = element("div", "setup-panel__hand");
    hand.append(
      ...tiles.hand.map((tile) => {
        const button = element("button", `setup-tile${tile.id === tiles.selected ? " setup-tile--selected" : ""}`);
        button.title = tile.cells.map(({ label }) => label).join(", ");
        button.disabled = !tiles.yourTurn;
        button.append(flower(tile, tile.id === tiles.selected ? tiles.rotation : 0), element("span", "setup-tile__id", tile.id));
        button.addEventListener("click", () => this.handlers.onSelectTile(tile.id));
        return button;
      }),
    );
    if (tiles.hand.length === 0) {
      hand.append(element("span", "setup-panel__hint", "No tiles left in your hand."));
    }

    const controls = element("div", "setup-panel__controls");
    if (tiles.yourTurn) {
      const left = element("button", "player-button player-button--ghost", "⟲");
      left.title = "Rotate left (Shift+R)";
      left.addEventListener("click", () => this.handlers.onRotate(-1));
      const right = element("button", "player-button player-button--ghost", "⟳");
      right.title = "Rotate right (R)";
      right.addEventListener("click", () => this.handlers.onRotate(1));
      controls.append(left, right, element("span", "setup-panel__hint", tiles.hint ?? "Click the table to place the tile."));
    }

    const others = element("ul", "setup-panel__hands");
    others.append(
      ...tiles.hands.map(({ seat, count, playing }) => {
        const item = element("li", `setup-panel__seat${playing ? " setup-panel__seat--playing" : ""}`);
        item.style.setProperty("--seat-color", seat.color);
        item.append(element("span", "setup-panel__seat-name", seat.name), element("span", "setup-panel__hint", `${count} tile${count === 1 ? "" : "s"}`));
        return item;
      }),
    );
    const left = element("div", "setup-panel__column");
    left.append(status, controls, others);
    return [left, hand];
  }

  private cities(cities: NonNullable<SetupPanelData["cities"]>): HTMLElement[] {
    const intro = element("div", "setup-panel__status");
    intro.append(
      element("strong", "", "Agree on a starting City for every Clan"),
      element("span", "setup-panel__hint", "Pick a Clan, then click a Province. Anyone can move any City."),
    );
    const list = element("div", "setup-panel__clans");
    list.append(
      ...cities.rows.map(({ seat, location }) => {
        const row = element("label", `setup-clan${seat.id === cities.selected ? " setup-clan--selected" : ""}`);
        row.style.setProperty("--seat-color", seat.color);
        const radio = element("input", "");
        radio.type = "radio";
        radio.name = "setup-clan";
        radio.checked = seat.id === cities.selected;
        radio.addEventListener("change", () => this.handlers.onSelectClan(seat.id));
        const text = element("span", "setup-clan__text");
        text.append(element("strong", "", seat.clan), element("span", "setup-panel__hint", `${seat.name} · ${location ?? "not placed"}`));
        row.append(radio, text);
        if (location !== null) {
          const clear = element("button", "setup-clan__clear", "✕");
          clear.title = "Remove this City";
          clear.addEventListener("click", (event) => {
            event.preventDefault();
            this.handlers.onClearCity(seat.id);
          });
          row.append(clear);
        }
        return row;
      }),
    );
    return [intro, list];
  }

  private temples(temples: NonNullable<SetupPanelData["temples"]>): HTMLElement[] {
    const intro = element("div", "setup-panel__status");
    intro.append(
      element("strong", "", `${temples.count} / ${temples.max} Temples`),
      element("span", "setup-panel__hint", "Click a Province to add or remove a Temple."),
    );
    return [intro];
  }

  private agreement(agreement: NonNullable<SetupPanelData["agreement"]>, seats: SetupSeat[]): HTMLElement[] {
    const chips = element("ul", "setup-panel__agreed");
    chips.append(
      ...seats.map((seat) => {
        const agreed = agreement.agreed.includes(seat.id);
        const chip = element("li", `setup-agree${agreed ? " setup-agree--yes" : ""}`, seat.name);
        chip.style.setProperty("--seat-color", seat.color);
        chip.title = agreed ? "Agrees" : "Not yet";
        return chip;
      }),
    );
    const agreed = agreement.agreed.includes(agreement.you);
    const button = element("button", `player-button${agreed ? " player-button--ghost" : ""}`, agreed ? "Withdraw agreement" : "I agree");
    button.disabled = !agreed && agreement.error !== null;
    button.addEventListener("click", () => this.handlers.onAgree(!agreed));
    const note = element("span", "setup-panel__hint", agreement.error ?? "Any change clears everyone's agreement.");
    return [chips, note, button];
  }
}

function flower(tile: SetupTile, rotation: number): SVGSVGElement {
  const svg = document.createElementNS(SVG, "svg");
  const extent = HEX_SIZE * 3.2;
  svg.setAttribute("viewBox", `${-extent} ${-extent} ${extent * 2} ${extent * 2}`);
  svg.classList.add("setup-tile__flower");
  tile.cells.forEach((cell, i) => {
    const direction = i === 0 ? null : DIRECTIONS[(i - 1 + rotation) % 6];
    const x = direction === null ? 0 : 1.5 * direction.q * HEX_SIZE;
    const y = direction === null ? 0 : -Math.sqrt(3) * (direction.r + direction.q / 2) * HEX_SIZE;
    const hex = document.createElementNS(SVG, "polygon");
    hex.setAttribute(
      "points",
      Array.from({ length: 6 }, (_, k) => `${x + Math.cos((k * Math.PI) / 3) * HEX_SIZE * 0.96},${y + Math.sin((k * Math.PI) / 3) * HEX_SIZE * 0.96}`).join(" "),
    );
    hex.setAttribute("fill", cell.color);
    const title = document.createElementNS(SVG, "title");
    title.textContent = cell.label;
    hex.append(title);
    svg.append(hex);
  });
  return svg;
}
