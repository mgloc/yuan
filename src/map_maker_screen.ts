import { Building, Clan, type Coord, type Grid, type Province, type Tile } from "./game_types.ts";
import { freeProvince } from "./game/board_layout.ts";
import {
  draftCapitals,
  draftGrid,
  draftPlacementError,
  draftTemples,
  emptyDraft,
  exportMap,
  hasCoord,
  importMap,
  isHillsAt,
  isLandAt,
  MAX_MAP_PLAYERS,
  MIN_MAP_PLAYERS,
  type MapDraft,
  type PlacedTile,
} from "./game/map_maker.ts";
import { CLAN_ORDER, ROTATIONS, tileCells, WORK_CENTER } from "./game/setup/setup.ts";
import { TILE_GROUPS, tileGroup, type TileGroupId } from "./game/setup/tile_groups.ts";
import { coordKey } from "./game/tile/coords.ts";
import { CLAN_COLORS, clanCssColor } from "./rendering/clan_colors.ts";
import { Highlight } from "./rendering/highlight.ts";
import { TilePicker } from "./rendering/picking.ts";
import { ProceduralPieceFactory } from "./rendering/pieces/procedural_factory.ts";
import { PlanePicker } from "./rendering/plane_picker.ts";
import { TileGhostView } from "./rendering/views/tile_ghost_view.ts";
import { TileGridView } from "./rendering/views/tile_grid_view.ts";
import { expectedArea, tileData } from "./setup_screen.ts";
import { Stage } from "./stage.ts";
import { MakerMode, MapMakerPanel, type MapMakerPanelData } from "./ui/map_maker_panel.ts";
import type { Toast } from "./ui/toast.ts";
import { TurnBar } from "./ui/turn_bar.ts";

const DRAFT_KEY = "yuan:map-draft";

export class MapMakerScreen {
  private stage: Stage;
  private factory = new ProceduralPieceFactory();
  private grid: TileGridView | null = null;
  private gridKey = "";
  private ghost = new TileGhostView();
  private panel: MapMakerPanel;
  private bar: TurnBar;
  private tilePicker: TilePicker;
  private planePicker: PlanePicker;
  private disposers: (() => void)[] = [];
  private draft: MapDraft = loadDraft();
  private mode: MakerMode = MakerMode.Tiles;
  private selectedTile: TileGroupId | null = null;
  private selectedClan: Clan = CLAN_ORDER[0];
  private rotation = 0;
  private hovered: Coord | null = null;
  private editing: TileGroupId | null = null;
  private moving: TileGroupId | null = null;
  private toast: Toast;

  constructor(container: HTMLElement, toast: Toast, onExit: () => void) {
    this.toast = toast;
    this.stage = new Stage(container);
    this.stage.onFrame((dt) => this.grid?.update(dt));
    this.bar = new TurnBar(container, onExit);
    this.panel = new MapMakerPanel(container, {
      onMode: (mode) => {
        this.mode = mode;
        this.render();
      },
      onSelectTile: (id) => {
        this.selectedTile = id;
        this.render();
      },
      onEditTile: (id) => {
        this.moving = null;
        this.editing = id;
        this.render();
      },
      onMoveTile: (id) => this.startMove(id),
      onRemoveTile: (id) => {
        this.editing = null;
        this.change({ ...this.draft, tiles: this.draft.tiles.filter((tile) => tile.id !== id) });
      },
      onCloseEdit: () => this.closeEdit(),
      onUndo: () => this.undo(),
      onClear: () => confirm("Remove every tile from the map?") && this.change({ ...this.draft, tiles: [], capitals: {}, temples: null }),
      onRotate: (delta) => this.rotate(delta),
      onSelectClan: (clan) => {
        this.selectedClan = clan;
        this.render();
      },
      onClearCapital: (clan) => {
        const capitals = { ...this.draft.capitals };
        delete capitals[clan];
        this.change({ ...this.draft, capitals });
      },
      onResetTemples: () => this.change({ ...this.draft, temples: null }),
      onName: (name) => this.change({ ...this.draft, name }),
      onPlayers: (players) =>
        Number.isInteger(players) && this.change({ ...this.draft, players: Math.min(MAX_MAP_PLAYERS, Math.max(MIN_MAP_PLAYERS, players)) }),
      onBidding: (bidding) => this.change({ ...this.draft, bidding }),
      onCopy: () => this.copy(),
      onDownload: () => this.download(),
      onImport: (file) => this.import(file),
    });
    this.stage.setHud(this.bar.root, this.panel.root);
    this.stage.setTable(expectedArea(TILE_GROUPS.length));

    this.tilePicker = new TilePicker(this.stage.renderer, this.stage.board);
    this.planePicker = new PlanePicker(this.stage.renderer, () => this.grid?.root ?? null);
    this.disposers.push(
      this.tilePicker.onPick((coord) => coord !== null && this.pickProvince(coord)),
      this.planePicker.onHover((coord) => {
        this.hovered = coord;
        this.renderGhost();
        if (this.mode === MakerMode.Tiles) {
          this.renderPanel();
        }
      }),
      this.planePicker.onClick((coord) => coord !== null && this.placeAt(coord)),
      this.planePicker.onRightClick(() => this.rotate(1)),
    );
    window.addEventListener("keydown", this.onKeyDown);
    this.render();
  }

  dispose() {
    window.removeEventListener("keydown", this.onKeyDown);
    this.disposers.forEach((dispose) => dispose());
    this.tilePicker.dispose();
    this.planePicker.dispose();
    this.ghost.dispose();
    this.grid?.dispose(this.stage.board);
    this.panel.dispose();
    this.bar.dispose();
    this.stage.dispose();
  }

  private change(draft: MapDraft) {
    this.draft = draft;
    saveDraft(draft);
    this.render();
  }

  private get hand(): TileGroupId[] {
    const used = new Set(this.draft.tiles.map(({ id }) => id));
    return TILE_GROUPS.map(({ id }) => id).filter((id) => !used.has(id));
  }

  private render() {
    const hand = this.hand;
    if (this.selectedTile === null || !hand.includes(this.selectedTile)) {
      this.selectedTile = hand[0] ?? null;
    }
    if (this.editing !== null && !this.draft.tiles.some(({ id }) => id === this.editing)) {
      this.editing = null;
    }
    const tiles = draftGrid(this.shown());
    this.syncBoard(tiles);
    this.renderGhost();
    this.renderHighlights();
    this.renderPanel();
    this.bar.update({
      title: "Map maker",
      hint: `${this.draft.tiles.length} / ${TILE_GROUPS.length} tiles · ${draftCapitals(this.draft, tiles).length} Capitals · ${draftTemples(this.draft, tiles).length} Temples`,
      seats: [],
      status: "Saved in this browser",
      exitLabel: "Exit",
    });
  }

  private shown(): MapDraft {
    return this.moving === null ? this.draft : { ...this.draft, tiles: this.draft.tiles.filter(({ id }) => id !== this.moving) };
  }

  private placed(id: TileGroupId | null): PlacedTile | undefined {
    return this.draft.tiles.find((tile) => tile.id === id);
  }

  private placedAt(coord: Coord): TileGroupId | null {
    const key = coordKey(coord);
    return this.draft.tiles.find(({ anchor, rotation }) => tileCells(anchor, rotation).some((cell) => coordKey(cell) === key))?.id ?? null;
  }

  private syncBoard(tiles: Grid<Tile>) {
    const key = this.shown().tiles.map(({ id, anchor, rotation }) => `${id}@${coordKey(anchor)}/${rotation}`).join(";");
    if (key !== this.gridKey || this.grid === null) {
      this.gridKey = key;
      this.ghost.root.removeFromParent();
      this.grid?.dispose(this.stage.board);
      this.grid = new TileGridView(this.stage.board, tiles, this.factory, this.stage.renderer.sun.position, WORK_CENTER);
      this.stage.setFootprint(this.grid.tileCenters());
      this.grid.root.add(this.ghost.root);
    }
    this.grid.updateProvinces(this.provinces(tiles), (index) => CLAN_COLORS[CLAN_ORDER[index]]);
  }

  private provinces(tiles: Grid<Tile>): Grid<Province> {
    const temples = draftTemples(this.shown(), tiles);
    const provinces = tiles.map((line, row) =>
      line.map((_, col) => (isLandAt(tiles, { col, row }) ? freeProvince({ temple: hasCoord(temples, { col, row }) }) : null)),
    );
    for (const { clan, coord } of draftCapitals(this.shown(), tiles)) {
      Object.assign(provinces[coord.row][coord.col]!, { owner: CLAN_ORDER.indexOf(clan), building: Building.City });
    }
    return provinces;
  }

  private anchor(): Coord | null {
    if (this.hovered === null) {
      return null;
    }
    return this.shown().tiles.length === 0 ? WORK_CENTER : this.hovered;
  }

  private renderGhost() {
    const id = this.moving ?? (this.editing === null ? this.selectedTile : null);
    const group = id === null ? undefined : tileGroup(id);
    const anchor = this.anchor();
    const overPlaced = this.moving === null && anchor !== null && this.placedAt(anchor) !== null;
    if (this.mode !== MakerMode.Tiles || group === undefined || anchor === null || overPlaced) {
      this.ghost.hide();
      return;
    }
    const cells = tileCells(anchor, this.rotation).map((coord, i) => ({ coord, tile: group.cells[i] }));
    this.ghost.show(cells, draftPlacementError(this.shown(), anchor, this.rotation) === null);
  }

  private renderHighlights() {
    const capital = this.mode === MakerMode.Capitals ? this.draft.capitals[this.selectedClan] : undefined;
    const editing = this.mode === MakerMode.Tiles && this.moving === null ? this.placed(this.editing) : undefined;
    const cells = editing !== undefined ? tileCells(editing.anchor, editing.rotation) : capital !== undefined ? [capital] : [];
    const highlights = new Map<string, Highlight>(cells.map((cell) => [coordKey(cell), Highlight.Selected]));
    if (this.mode === MakerMode.Temples) {
      const tiles = draftGrid(this.draft);
      tiles.forEach((line, row) => line.forEach((_, col) => isHillsAt(tiles, { col, row }) && highlights.set(coordKey({ col, row }), Highlight.Adjacent)));
    }
    this.grid?.setHighlights(highlights);
  }

  private renderPanel() {
    this.panel.update(this.panelData());
  }

  private panelData(): MapMakerPanelData {
    const tiles = draftGrid(this.draft);
    const anchor = this.anchor();
    const error = anchor === null ? null : draftPlacementError(this.shown(), anchor, this.rotation);
    const placeName = (coord: Coord | undefined) => (coord === undefined || !isLandAt(tiles, coord) ? null : (tiles[coord.row][coord.col]?.name ?? "somewhere"));
    const exported = exportMap(this.draft);
    return {
      mode: this.mode,
      tiles: {
        hand: this.hand.map(tileData),
        placed: this.draft.tiles.map(({ id }) => tileData(id)),
        selected: this.selectedTile,
        rotation: this.rotation,
        editing: this.editing,
        moving: this.moving,
        hint:
          this.moving !== null
            ? (error ?? "Click to drop the tile here, right click to rotate.")
            : this.editing !== null
              ? "Move it, rotate it in place, or remove it."
              : this.selectedTile === null
                ? "Every tile is placed. Click a placed tile to move or remove it."
                : this.draft.tiles.length === 0
                  ? "The first tile goes at the centre: click anywhere on the table."
                  : (error ?? "Left click to place, right click to rotate. Click a placed tile to edit it."),
      },
      capitals: {
        rows: CLAN_ORDER.map((clan) => ({ clan, color: clanCssColor(clan), location: placeName(this.draft.capitals[clan]) })),
        selected: this.selectedClan,
      },
      temples: { count: draftTemples(this.draft, tiles).length, custom: this.draft.temples !== null },
      export: {
        name: this.draft.name,
        players: this.draft.players,
        minPlayers: MIN_MAP_PLAYERS,
        maxPlayers: MAX_MAP_PLAYERS,
        bidding: this.draft.bidding,
        json: JSON.stringify(exported, null, 2),
        warnings: this.warnings(exported.capitals.length),
      },
    };
  }

  private warnings(capitals: number): string[] {
    const warnings: string[] = [];
    if (this.draft.tiles.length === 0) {
      warnings.push("The map has no tiles yet.");
    }
    if (capitals > 0 && capitals < this.draft.players) {
      warnings.push(`Only ${capitals} Capitals for ${this.draft.players} players: they will be ignored and players will agree on Cities.`);
    }
    if (capitals > this.draft.players) {
      warnings.push(`${capitals} Capitals for ${this.draft.players} players: only the first ${this.draft.players} in Clan order are used.`);
    }
    return warnings;
  }

  private rotate(delta: number) {
    const next = (((this.rotation + delta) % ROTATIONS) + ROTATIONS) % ROTATIONS;
    const editing = this.moving === null ? this.placed(this.editing) : undefined;
    if (editing === undefined) {
      this.rotation = next;
      this.render();
      return;
    }
    const turned = (((editing.rotation + delta) % ROTATIONS) + ROTATIONS) % ROTATIONS;
    const others = { ...this.draft, tiles: this.draft.tiles.filter(({ id }) => id !== editing.id) };
    if (draftPlacementError(others, editing.anchor, turned) !== null) {
      this.toast.show("The tile can't turn here, move it instead");
      return;
    }
    this.relocate(editing, editing.anchor, turned);
  }

  private startMove(id: TileGroupId) {
    const tile = this.placed(id);
    if (tile === undefined) {
      return;
    }
    this.editing = null;
    this.moving = id;
    this.rotation = tile.rotation;
    this.render();
  }

  private closeEdit() {
    this.editing = null;
    this.moving = null;
    this.render();
  }

  private relocate(tile: PlacedTile, anchor: Coord, rotation: number) {
    const from = tileCells(tile.anchor, tile.rotation);
    const to = tileCells(anchor, rotation);
    const carry = (coord: Coord): Coord => {
      const index = from.findIndex((cell) => coordKey(cell) === coordKey(coord));
      return index === -1 ? coord : to[index];
    };
    const capitals = Object.fromEntries(Object.entries(this.draft.capitals).map(([clan, coord]) => [clan, carry(coord)])) as MapDraft["capitals"];
    const temples = this.draft.temples === null ? null : this.draft.temples.map(carry);
    const tiles = this.draft.tiles.map((other) => (other.id === tile.id ? { ...other, anchor, rotation } : other));
    this.change({ ...this.draft, tiles, capitals, temples });
  }

  private placeAt(coord: Coord) {
    if (this.mode !== MakerMode.Tiles) {
      return;
    }
    this.hovered = coord;
    const anchor = this.anchor();
    if (this.moving !== null) {
      const tile = this.placed(this.moving);
      if (tile === undefined || anchor === null || draftPlacementError(this.shown(), anchor, this.rotation) !== null) {
        return;
      }
      this.moving = null;
      this.editing = tile.id;
      this.relocate(tile, anchor, this.rotation);
      return;
    }
    const clicked = this.placedAt(coord);
    if (clicked !== null) {
      this.editing = this.editing === clicked ? null : clicked;
      this.render();
      return;
    }
    if (this.editing !== null) {
      this.editing = null;
      this.render();
      return;
    }
    if (this.selectedTile === null || anchor === null || draftPlacementError(this.draft, anchor, this.rotation) !== null) {
      return;
    }
    this.change({ ...this.draft, tiles: [...this.draft.tiles, { id: this.selectedTile, anchor, rotation: this.rotation }] });
  }

  private undo() {
    if (this.draft.tiles.length > 0) {
      this.change({ ...this.draft, tiles: this.draft.tiles.slice(0, -1) });
    }
  }

  private pickProvince(coord: Coord) {
    const tiles = draftGrid(this.draft);
    if (!isLandAt(tiles, coord)) {
      return;
    }
    if (this.mode === MakerMode.Capitals) {
      const capitals = Object.fromEntries(
        Object.entries(this.draft.capitals).filter(([clan, other]) => clan === this.selectedClan || coordKey(other) !== coordKey(coord)),
      ) as MapDraft["capitals"];
      const current = capitals[this.selectedClan];
      if (current !== undefined && coordKey(current) === coordKey(coord)) {
        delete capitals[this.selectedClan];
      } else {
        capitals[this.selectedClan] = coord;
      }
      this.change({ ...this.draft, capitals });
    } else if (this.mode === MakerMode.Temples) {
      if (!isHillsAt(tiles, coord)) {
        this.toast.show("Temples can only stand on Hills");
        return;
      }
      const temples = draftTemples(this.draft, tiles);
      const next = hasCoord(temples, coord) ? temples.filter((other) => coordKey(other) !== coordKey(coord)) : [...temples, coord];
      this.change({ ...this.draft, temples: next.length === 0 ? null : next });
    }
  }

  private json(): string {
    return JSON.stringify(exportMap(this.draft), null, 2);
  }

  private copy() {
    navigator.clipboard?.writeText(this.json()).then(
      () => this.toast.show("Map JSON copied"),
      () => this.toast.show("Could not copy, select the JSON and copy it by hand"),
    );
  }

  private download() {
    const url = URL.createObjectURL(new Blob([this.json()], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(this.draft.name.trim() || "map").replace(/[^\w-]+/g, "_").toLowerCase()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  private async import(file: File) {
    try {
      const draft = importMap(JSON.parse(await file.text()));
      if (draft === null) {
        this.toast.show("This JSON was not exported by the map maker");
        return;
      }
      this.change(draft);
      this.toast.show(`Loaded ${draft.name}`);
    } catch {
      this.toast.show("Could not read this file");
    }
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key === "z") {
      event.preventDefault();
      this.undo();
    } else if (event.key === "r" || event.key === "R") {
      this.rotate(event.shiftKey ? -1 : 1);
    } else if (event.key === "Escape" && (this.editing !== null || this.moving !== null)) {
      this.closeEdit();
    } else if ((event.key === "Delete" || event.key === "Backspace") && this.editing !== null) {
      const id = this.editing;
      this.editing = null;
      this.change({ ...this.draft, tiles: this.draft.tiles.filter((tile) => tile.id !== id) });
    }
  };
}

function loadDraft(): MapDraft {
  try {
    const stored = localStorage.getItem(DRAFT_KEY);
    return (stored === null ? null : importMap(JSON.parse(stored))) ?? emptyDraft();
  } catch {
    return emptyDraft();
  }
}

function saveDraft(draft: MapDraft) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(exportMap(draft)));
  } catch {}
}
