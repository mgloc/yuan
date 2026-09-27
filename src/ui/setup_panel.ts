import "./setup_panel.css";
import type { Clan, PlayerId } from "../game_types.ts";
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
  color: string;
}

export interface SetupCapital {
  clan: Clan;
  color: string;
  location: string | null;
  owner: string | null;
}

export interface SetupBidding {
  chao: number;
  canBid: boolean;
  yourBid: number | null;
  status: string;
  choosing: boolean;
  rounds: string[];
}

export interface SetupPanelData {
  stage: SetupStage;
  prefilled: SetupStage[];
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
    pending: boolean;
    canConfirm: boolean;
    hands: { seat: SetupSeat; count: number; playing: boolean }[];
  } | null;
  cities: { rows: SetupCapital[]; selected: Clan } | null;
  clans: { capitals: SetupCapital[]; bidding: SetupBidding | null } | null;
  temples: { count: number; max: number } | null;
  agreement: { agreed: PlayerId[]; you: PlayerId; error: string | null } | null;
}

export interface SetupPanelHandlers {
  onSelectTile: (id: string) => void;
  onRotate: (delta: number) => void;
  onConfirmTile: () => void;
  onCancelTile: () => void;
  onSelectClan: (clan: Clan) => void;
  onClearCity: (clan: Clan) => void;
  onBid: (amount: number) => void;
  onChooseClan: (clan: Clan) => void;
  onAgree: (agreed: boolean) => void;
}

const STEPS: readonly [SetupStage, string][] = [
  [SetupStage.Tiles, "Territory tiles"],
  [SetupStage.Cities, "Starting Cities"],
  [SetupStage.Temples, "Temples"],
  [SetupStage.Clans, "Clans"],
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
    const prefilledLabels: Partial<Record<SetupStage, string>> = {
      [SetupStage.Tiles]: "Prebuilt map",
      [SetupStage.Cities]: "Capitals pre-placed",
      [SetupStage.Temples]: "Temples pre-placed",
    };
    this.steps.replaceChildren(
      ...STEPS.map(([stage, defaultLabel], i) => {
        const prefilled = data.prefilled.includes(stage);
        const label = prefilled ? (prefilledLabels[stage] ?? defaultLabel) : defaultLabel;
        const state = i < current || prefilled ? "done" : i === current ? "current" : "todo";
        const step = element("li", `setup-panel__step setup-panel__step--${state}`);
        step.append(element("span", "setup-panel__step-number", state === "done" ? "✓" : String(i + 1)), element("span", "", label));
        return step;
      }),
    );
    this.body.replaceChildren(
      ...(data.tiles
        ? this.tiles(data.tiles)
        : data.cities
          ? this.cities(data.cities)
          : data.temples
            ? this.temples(data.temples)
            : data.clans
              ? this.clans(data.clans)
              : []),
    );
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
    const rotate = element("div", "setup-panel__rotate");
    if (tiles.yourTurn) {
      if (tiles.pending) {
        const confirm = element("button", "player-button", "Confirm placement");
        confirm.title = "Confirm (Enter)";
        confirm.disabled = !tiles.canConfirm;
        confirm.addEventListener("click", () => this.handlers.onConfirmTile());
        const cancel = element("button", "player-button player-button--ghost", "Cancel");
        cancel.title = "Cancel (Escape)";
        cancel.addEventListener("click", () => this.handlers.onCancelTile());
        controls.append(confirm, cancel);
      }
      controls.append(element("span", "setup-panel__hint", tiles.hint ?? ""));
      const left = element("button", "setup-rotate setup-rotate--left", "⟲");
      left.title = "Rotate left (Shift+R)";
      left.setAttribute("aria-label", "Rotate left");
      left.addEventListener("click", () => this.handlers.onRotate(-1));
      const right = element("button", "setup-rotate setup-rotate--right", "⟳");
      right.title = "Rotate right (R or right click)";
      right.setAttribute("aria-label", "Rotate right");
      right.addEventListener("click", () => this.handlers.onRotate(1));
      rotate.append(left, right);
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
    return [left, hand, rotate];
  }

  private cities(cities: NonNullable<SetupPanelData["cities"]>): HTMLElement[] {
    const intro = element("div", "setup-panel__status");
    intro.append(
      element("strong", "", "Agree on a starting City for every Clan"),
      element("span", "setup-panel__hint", "Nobody knows yet which Clan they will play. Pick a Clan, then click a Province."),
    );
    const list = element("div", "setup-panel__clans");
    list.append(
      ...cities.rows.map(({ clan, color, location }) => {
        const row = element("label", `setup-clan${clan === cities.selected ? " setup-clan--selected" : ""}`);
        row.style.setProperty("--seat-color", color);
        const radio = element("input", "");
        radio.type = "radio";
        radio.name = "setup-clan";
        radio.checked = clan === cities.selected;
        radio.addEventListener("change", () => this.handlers.onSelectClan(clan));
        const text = element("span", "setup-clan__text");
        text.append(element("strong", "", clan), element("span", "setup-panel__hint", location ?? "not placed"));
        row.append(radio, text);
        if (location !== null) {
          const clear = element("button", "setup-clan__clear", "✕");
          clear.title = "Remove this City";
          clear.addEventListener("click", (event) => {
            event.preventDefault();
            this.handlers.onClearCity(clan);
          });
          row.append(clear);
        }
        return row;
      }),
    );
    return [intro, list];
  }

  private clans(clans: NonNullable<SetupPanelData["clans"]>): HTMLElement[] {
    const bidding = clans.bidding;
    const intro = element("div", "setup-panel__status");
    intro.append(
      element("strong", "", bidding?.choosing ? "You won the bid: choose your capital" : "Bid for a capital, and with it a Clan"),
      element("span", "setup-panel__hint", bidding?.status ?? "Drawing Clans…"),
    );
    const capitals = element("div", "setup-panel__clans");
    capitals.append(
      ...clans.capitals.map(({ clan, color, location, owner }) => {
        const card = element("div", `setup-clan${owner === null ? "" : " setup-clan--taken"}`);
        card.style.setProperty("--seat-color", color);
        const text = element("span", "setup-clan__text");
        text.append(element("strong", "", clan), element("span", "setup-panel__hint", `${location ?? "?"} · ${owner ?? "available"}`));
        card.append(text);
        if (bidding?.choosing && owner === null) {
          const take = element("button", "player-button", "Take");
          take.addEventListener("click", () => this.handlers.onChooseClan(clan));
          card.append(take);
        }
        return card;
      }),
    );
    const column = element("div", "setup-panel__column");
    column.append(intro);
    if (bidding !== null) {
      const form = element("form", "setup-bid");
      const input = element("input", "screen__input setup-bid__input");
      input.type = "number";
      input.min = "0";
      input.max = String(bidding.chao);
      input.step = "1";
      input.value = String(bidding.yourBid ?? 0);
      input.disabled = !bidding.canBid;
      const submit = element("button", "player-button", bidding.yourBid === null ? "Place bid" : "Bid placed");
      submit.disabled = !bidding.canBid;
      form.append(element("span", "", `Your Chão: ${bidding.chao}`), input, submit);
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        this.handlers.onBid(Number(input.value));
      });
      column.append(form);
      if (bidding.rounds.length > 0) {
        const rounds = element("ol", "setup-panel__rounds");
        rounds.append(...bidding.rounds.map((text) => element("li", "", text)));
        column.append(rounds);
      }
    }
    return [column, capitals];
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
