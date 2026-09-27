import "./setup_panel.css";
import "./map_maker_panel.css";
import type { Clan } from "../game_types.ts";
import { element } from "./dom.ts";
import { flower, type SetupTile } from "./setup_panel.ts";

export const MakerMode = {
  Tiles: "tiles",
  Capitals: "capitals",
  Temples: "temples",
  Export: "export",
} as const;

export type MakerMode = (typeof MakerMode)[keyof typeof MakerMode];

const MODES: readonly [MakerMode, string][] = [
  [MakerMode.Tiles, "Tiles"],
  [MakerMode.Capitals, "Capitals"],
  [MakerMode.Temples, "Temples"],
  [MakerMode.Export, "Export"],
];

export interface MakerCapital {
  clan: Clan;
  color: string;
  location: string | null;
}

export interface MapMakerPanelData {
  mode: MakerMode;
  tiles: {
    hand: SetupTile[];
    placed: SetupTile[];
    selected: string | null;
    rotation: number;
    editing: string | null;
    moving: string | null;
    hint: string;
  };
  capitals: { rows: MakerCapital[]; selected: Clan };
  temples: { count: number; custom: boolean };
  export: { name: string; players: number; minPlayers: number; maxPlayers: number; bidding: boolean; json: string; warnings: string[] };
}

export interface MapMakerPanelHandlers {
  onMode: (mode: MakerMode) => void;
  onSelectTile: (id: string) => void;
  onEditTile: (id: string) => void;
  onMoveTile: (id: string) => void;
  onRemoveTile: (id: string) => void;
  onCloseEdit: () => void;
  onUndo: () => void;
  onClear: () => void;
  onRotate: (delta: number) => void;
  onSelectClan: (clan: Clan) => void;
  onClearCapital: (clan: Clan) => void;
  onResetTemples: () => void;
  onName: (name: string) => void;
  onPlayers: (players: number) => void;
  onBidding: (bidding: boolean) => void;
  onCopy: () => void;
  onDownload: () => void;
  onImport: (file: File) => void;
}

export class MapMakerPanel {
  root: HTMLElement;
  private tabs: HTMLElement;
  private body: HTMLElement;
  private handlers: MapMakerPanelHandlers;
  private mode: MakerMode | null = null;

  constructor(container: HTMLElement, handlers: MapMakerPanelHandlers) {
    this.handlers = handlers;
    this.root = element("footer", "setup-panel maker-panel");
    this.tabs = element("div", "maker-panel__tabs");
    this.body = element("div", "setup-panel__body");
    this.root.append(this.tabs, this.body);
    container.appendChild(this.root);
  }

  update(data: MapMakerPanelData) {
    this.tabs.replaceChildren(
      ...MODES.map(([mode, label]) => {
        const tab = element("button", `maker-panel__tab${mode === data.mode ? " maker-panel__tab--active" : ""}`, label);
        tab.addEventListener("click", () => this.handlers.onMode(mode));
        return tab;
      }),
    );
    const focused = document.activeElement;
    const keepExport = this.mode === MakerMode.Export && data.mode === MakerMode.Export && focused instanceof HTMLInputElement && this.body.contains(focused);
    this.mode = data.mode;
    if (keepExport) {
      this.body.querySelector<HTMLTextAreaElement>(".maker-panel__json")!.value = data.export.json;
      this.body.querySelector(".maker-panel__warnings")?.replaceWith(this.warnings(data.export.warnings));
      return;
    }
    const sections: Record<MakerMode, () => HTMLElement[]> = {
      [MakerMode.Tiles]: () => this.tilesSection(data.tiles),
      [MakerMode.Capitals]: () => this.capitalsSection(data.capitals),
      [MakerMode.Temples]: () => this.templesSection(data.temples),
      [MakerMode.Export]: () => this.exportSection(data.export),
    };
    this.body.replaceChildren(...sections[data.mode]());
  }

  dispose() {
    this.root.remove();
  }

  private tilesSection(tiles: MapMakerPanelData["tiles"]): HTMLElement[] {
    const rotate = this.rotateButtons(tiles.selected !== null || tiles.editing !== null || tiles.moving !== null);
    if (tiles.moving !== null || tiles.editing !== null) {
      return [this.editSection(tiles), rotate];
    }
    const status = element("div", "setup-panel__status");
    status.append(
      element("strong", "", `${tiles.placed.length} tile${tiles.placed.length === 1 ? "" : "s"} placed`),
      element("span", "setup-panel__hint", tiles.hint),
    );
    const undo = element("button", "player-button player-button--ghost", "Undo");
    undo.title = "Undo (Ctrl+Z)";
    undo.disabled = tiles.placed.length === 0;
    undo.addEventListener("click", () => this.handlers.onUndo());
    const clear = element("button", "player-button player-button--ghost", "Clear map");
    clear.disabled = tiles.placed.length === 0;
    clear.addEventListener("click", () => this.handlers.onClear());
    const controls = element("div", "setup-panel__controls");
    controls.append(undo, clear);

    const placed = element("div", "maker-panel__placed");
    placed.append(
      ...tiles.placed.map((tile) => {
        const chip = element("button", "maker-panel__chip", tile.id);
        chip.title = `Edit tile ${tile.id}`;
        chip.addEventListener("click", () => this.handlers.onEditTile(tile.id));
        return chip;
      }),
    );
    const column = element("div", "setup-panel__column");
    column.append(status, controls, placed);

    const hand = element("div", "setup-panel__hand");
    hand.append(
      ...tiles.hand.map((tile) => {
        const selected = tile.id === tiles.selected;
        const button = element("button", `setup-tile${selected ? " setup-tile--selected" : ""}`);
        button.title = tile.cells.map(({ label }) => label).join(", ");
        button.append(flower(tile, selected ? tiles.rotation : 0), element("span", "setup-tile__id", tile.id));
        button.addEventListener("click", () => this.handlers.onSelectTile(tile.id));
        return button;
      }),
    );
    if (tiles.hand.length === 0) {
      hand.append(element("span", "setup-panel__hint", "Every tile is on the map."));
    }

    return [column, hand, rotate];
  }

  private editSection(tiles: MapMakerPanelData["tiles"]): HTMLElement {
    const id = (tiles.moving ?? tiles.editing)!;
    const status = element("div", "setup-panel__status");
    status.append(element("strong", "", tiles.moving !== null ? `Moving tile ${id}` : `Tile ${id}`), element("span", "setup-panel__hint", tiles.hint));
    const controls = element("div", "setup-panel__controls");
    if (tiles.moving === null) {
      const move = element("button", "player-button", "Move");
      move.addEventListener("click", () => this.handlers.onMoveTile(id));
      const remove = element("button", "player-button player-button--ghost maker-panel__danger", "Remove");
      remove.title = "Remove (Delete)";
      remove.addEventListener("click", () => this.handlers.onRemoveTile(id));
      const done = element("button", "player-button player-button--ghost", "Done");
      done.title = "Done (Escape)";
      done.addEventListener("click", () => this.handlers.onCloseEdit());
      controls.append(move, remove, done);
    } else {
      const cancel = element("button", "player-button player-button--ghost", "Cancel move");
      cancel.title = "Cancel (Escape)";
      cancel.addEventListener("click", () => this.handlers.onCloseEdit());
      controls.append(cancel);
    }
    const column = element("div", "setup-panel__column");
    column.append(status, controls);
    return column;
  }

  private rotateButtons(visible: boolean): HTMLElement {
    const rotate = element("div", "setup-panel__rotate");
    if (visible) {
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
    return rotate;
  }

  private capitalsSection(capitals: MapMakerPanelData["capitals"]): HTMLElement[] {
    const intro = element("div", "setup-panel__status");
    intro.append(
      element("strong", "", "Starting Cities (optional)"),
      element("span", "setup-panel__hint", "Pick a Clan, then click a Province. Leave them empty to let players agree on Cities."),
    );
    const list = element("div", "setup-panel__clans");
    list.append(
      ...capitals.rows.map(({ clan, color, location }) => {
        const row = element("label", `setup-clan${clan === capitals.selected ? " setup-clan--selected" : ""}`);
        row.style.setProperty("--seat-color", color);
        const radio = element("input", "");
        radio.type = "radio";
        radio.name = "maker-clan";
        radio.checked = clan === capitals.selected;
        radio.addEventListener("change", () => this.handlers.onSelectClan(clan));
        const text = element("span", "setup-clan__text");
        text.append(element("strong", "", clan), element("span", "setup-panel__hint", location ?? "not placed"));
        row.append(radio, text);
        if (location !== null) {
          const clear = element("button", "setup-clan__clear", "✕");
          clear.title = "Remove this City";
          clear.addEventListener("click", (event) => {
            event.preventDefault();
            this.handlers.onClearCapital(clan);
          });
          row.append(clear);
        }
        return row;
      }),
    );
    return [intro, list];
  }

  private templesSection(temples: MapMakerPanelData["temples"]): HTMLElement[] {
    const intro = element("div", "setup-panel__status");
    intro.append(
      element("strong", "", temples.custom ? `${temples.count} fixed Temple${temples.count === 1 ? "" : "s"}` : "No fixed Temples"),
      element(
        "span",
        "setup-panel__hint",
        temples.custom
          ? "Click a Hills Province to add or remove a Temple."
          : "Players will place the Temples on Hills when the game starts. Click a Hills Province to fix them on this map instead.",
      ),
    );
    const reset = element("button", "player-button player-button--ghost", "Let players place them");
    reset.disabled = !temples.custom;
    reset.addEventListener("click", () => this.handlers.onResetTemples());
    intro.append(reset);
    return [intro];
  }

  private exportSection(data: MapMakerPanelData["export"]): HTMLElement[] {
    const name = element("input", "screen__input");
    name.value = data.name;
    name.placeholder = "Map name";
    name.addEventListener("input", () => this.handlers.onName(name.value));
    const players = element("input", "screen__input maker-panel__players");
    players.type = "number";
    players.min = String(data.minPlayers);
    players.max = String(data.maxPlayers);
    players.value = String(data.players);
    players.addEventListener("change", () => this.handlers.onPlayers(Number(players.value)));
    const bidding = element("input", "");
    bidding.type = "checkbox";
    bidding.checked = data.bidding;
    bidding.addEventListener("change", () => this.handlers.onBidding(bidding.checked));
    const biddingLabel = element("label", "maker-panel__check");
    biddingLabel.append(bidding, element("span", "", "Bidding for Clans"));
    const fields = element("div", "maker-panel__fields");
    const field = (label: string, input: HTMLElement) => {
      const wrapper = element("label", "maker-panel__field");
      wrapper.append(element("span", "setup-panel__hint", label), input);
      return wrapper;
    };
    fields.append(field("Name", name), field("Players", players), biddingLabel);

    const copy = element("button", "player-button", "Copy JSON");
    copy.addEventListener("click", () => this.handlers.onCopy());
    const download = element("button", "player-button player-button--ghost", "Export .json");
    download.addEventListener("click", () => this.handlers.onDownload());
    const file = element("input", "");
    file.type = "file";
    file.accept = "application/json,.json";
    file.hidden = true;
    file.addEventListener("change", () => file.files?.[0] && this.handlers.onImport(file.files[0]));
    const load = element("button", "player-button player-button--ghost", "Load JSON");
    load.addEventListener("click", () => file.click());
    const actions = element("div", "setup-panel__controls");
    actions.append(copy, download, load, file);

    const column = element("div", "setup-panel__column");
    column.append(fields, this.warnings(data.warnings), actions);
    const json = element("textarea", "maker-panel__json");
    json.readOnly = true;
    json.value = data.json;
    json.spellcheck = false;
    return [column, json];
  }

  private warnings(warnings: string[]): HTMLElement {
    const list = element("ul", "maker-panel__warnings");
    list.append(...warnings.map((warning) => element("li", "", warning)));
    return list;
  }
}
