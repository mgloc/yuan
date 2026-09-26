import * as THREE from "three";
import { isLand, type Coord, type PlayerId } from "./game_types.ts";
import { MAX_TEMPLES, placementError, SetupStage, setupBoard, tileCells, type SetupState } from "./game/setup/setup.ts";
import { tileGroup, type TileGroupId } from "./game/setup/tile_groups.ts";
import { coordKey } from "./game/tile/coords.ts";
import { DebugController } from "./interaction/debug_controller.ts";
import { Observable } from "./interaction/observable.ts";
import type { GameClient } from "./net/game_client.ts";
import type { PlayerView, SetupView } from "./protocol.ts";
import { CLAN_COLORS, clanCssColor } from "./rendering/clan_colors.ts";
import { Highlight } from "./rendering/highlight.ts";
import { TILE_RADIUS } from "./rendering/hex_layout.ts";
import { TilePicker } from "./rendering/picking.ts";
import { ProceduralPieceFactory } from "./rendering/pieces/procedural_factory.ts";
import { PlanePicker } from "./rendering/plane_picker.ts";
import { TileGhostView } from "./rendering/views/tile_ghost_view.ts";
import { TileGridView } from "./rendering/views/tile_grid_view.ts";
import { TILE_BOTTOM_Z, TILE_COLORS } from "./rendering/views/tile_view.ts";
import { Stage } from "./stage.ts";
import { element } from "./ui/dom.ts";
import { SetupPanel, type SetupPanelData, type SetupSeat, type SetupTile } from "./ui/setup_panel.ts";
import { TurnBar } from "./ui/turn_bar.ts";

const HEX_AREA = 1.5 * Math.sqrt(3) * TILE_RADIUS * TILE_RADIUS;
const AREA_MARGIN = 1.15;
const BOARD_HEIGHT = 1;

export class SetupScreen {
  private view: Observable<PlayerView>;
  private client: GameClient;
  private stage: Stage;
  private factory = new ProceduralPieceFactory();
  private grid: TileGridView | null = null;
  private gridKey = "";
  private tableKey = "";
  private ghost = new TileGhostView();
  private panel: SetupPanel;
  private bar: TurnBar;
  private tilePicker: TilePicker;
  private planePicker: PlanePicker;
  private side: HTMLElement;
  private disposers: (() => void)[] = [];
  private selectedTile: TileGroupId | null = null;
  private rotation = 0;
  private hovered: Coord | null = null;
  private selectedClan: PlayerId;
  private onExit: () => void;

  constructor(container: HTMLElement, client: GameClient, initial: PlayerView, onExit: () => void) {
    this.view = new Observable(initial);
    this.client = client;
    this.onExit = onExit;
    this.selectedClan = initial.you;
    this.stage = new Stage(container);
    this.stage.onFrame((dt) => this.grid?.update(dt));

    this.side = element("div", "hud-side");
    container.appendChild(this.side);
    this.bar = new TurnBar(container, () => this.onExit());
    this.panel = new SetupPanel(container, {
      onSelectTile: (id) => {
        this.selectedTile = id;
        this.render();
      },
      onRotate: (delta) => this.rotate(delta),
      onSelectClan: (clan) => {
        this.selectedClan = clan;
        this.render();
      },
      onClearCity: (clan) => client.setCity(clan, null),
      onAgree: (agreed) => client.agree(agreed),
    });
    this.stage.setHud(this.bar.root, this.panel.root);

    this.tilePicker = new TilePicker(this.stage.renderer, this.stage.board);
    this.planePicker = new PlanePicker(this.stage.renderer, () => this.grid?.root ?? null);
    this.disposers.push(
      this.tilePicker.onPick((coord) => coord !== null && this.pickProvince(coord)),
      this.planePicker.onHover((coord) => {
        this.hovered = coord;
        this.renderGhost();
      }),
      this.planePicker.onClick((coord) => coord !== null && this.placeAt(coord)),
    );
    window.addEventListener("keydown", this.onKeyDown);

    if (initial.debug && client.isHost) {
      const cssColor = (player: PlayerId) => clanCssColor(this.seat(player).clan);
      const debug = new DebugController(this.side, this.view, initial.self, cssColor, {
        actAs: (player) => client.actAs(player),
        restart: () => client.restart(),
        toLobby: () => client.toLobby(),
      });
      this.disposers.push(() => debug.dispose());
    }
    this.render();
  }

  update(view: PlayerView) {
    this.view.set(view);
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
    this.side.remove();
    this.stage.dispose();
  }

  private get setup(): SetupView {
    return this.view.get().setup!;
  }

  private seat(player: PlayerId) {
    return this.view.get().seats.find(({ id }) => id === player)!;
  }

  private get yourTurn(): boolean {
    return this.setup.stage === SetupStage.Tiles && this.setup.turn === this.view.get().you;
  }

  private render() {
    if (this.view.get().setup === null) {
      return;
    }
    this.syncBoard();
    this.syncSelection();
    this.renderGhost();
    this.renderHighlights();
    this.panel.update(this.panelData());
    this.bar.update(this.barData());
  }

  private syncBoard() {
    const setup = this.setup;
    const gridKey = `${setup.stage === SetupStage.Tiles}:${setup.placed}:${setup.tiles.length}x${setup.tiles[0]?.length ?? 0}`;
    if (gridKey !== this.gridKey) {
      this.gridKey = gridKey;
      this.ghost.root.removeFromParent();
      this.grid?.dispose(this.stage.board);
      this.grid = new TileGridView(this.stage.board, setup.tiles, this.factory, this.stage.renderer.sun.position, setup.origin);
      const tableKey = setup.origin === null ? "board" : "tiles";
      if (tableKey !== this.tableKey) {
        this.tableKey = tableKey;
        this.stage.setTable(setup.origin === null ? new THREE.Box3().setFromObject(this.grid.root) : expectedArea(setup.total));
      }
      this.stage.setFootprint(this.grid.tileCenters());
      this.grid.root.add(this.ghost.root);
    }
    const clanColor = (player: PlayerId) => CLAN_COLORS[this.seat(player).clan];
    this.grid!.updateProvinces(setup.stage === SetupStage.Tiles ? [] : setupBoard(setup as SetupState).provinces, clanColor);
  }

  private syncSelection() {
    const hand = this.setup.hands[this.view.get().you] ?? [];
    if (this.selectedTile === null || !hand.includes(this.selectedTile)) {
      this.selectedTile = hand[0] ?? null;
    }
    if (!this.view.get().seats.some(({ id }) => id === this.selectedClan)) {
      this.selectedClan = this.view.get().you;
    }
  }

  private anchor(): Coord | null {
    const setup = this.setup;
    if (this.hovered === null) {
      return null;
    }
    return setup.placed === 0 && setup.origin !== null ? setup.origin : this.hovered;
  }

  private renderGhost() {
    const group = this.selectedTile === null ? undefined : tileGroup(this.selectedTile);
    const anchor = this.anchor();
    if (!this.yourTurn || group === undefined || anchor === null) {
      this.ghost.hide();
      return;
    }
    const cells = tileCells(anchor, this.rotation).map((coord, i) => ({ coord, tile: group.cells[i] }));
    this.ghost.show(cells, placementError(this.setup as SetupState, anchor, this.rotation) === null);
  }

  private renderHighlights() {
    const city = this.setup.stage === SetupStage.Cities ? this.setup.cities[this.selectedClan] : null;
    this.grid?.setHighlights(new Map(city ? [[coordKey(city), Highlight.Selected]] : []));
  }

  private rotate(delta: number) {
    this.rotation = (((this.rotation + delta) % 6) + 6) % 6;
    this.render();
  }

  private placeAt(coord: Coord) {
    this.hovered = coord;
    const anchor = this.anchor();
    if (!this.yourTurn || this.selectedTile === null || anchor === null) {
      return;
    }
    if (placementError(this.setup as SetupState, anchor, this.rotation) !== null) {
      return;
    }
    this.client.placeTile(this.selectedTile, anchor, this.rotation);
  }

  private pickProvince(coord: Coord) {
    const setup = this.setup;
    const tile = setup.tiles[coord.row]?.[coord.col];
    if (tile === null || tile === undefined || !isLand(tile)) {
      return;
    }
    if (setup.stage === SetupStage.Cities) {
      const current = setup.cities[this.selectedClan];
      this.client.setCity(this.selectedClan, current !== null && coordKey(current) === coordKey(coord) ? null : coord);
    } else if (setup.stage === SetupStage.Temples) {
      this.client.toggleTemple(coord);
    }
  }

  private panelData(): SetupPanelData {
    const view = this.view.get();
    const setup = this.setup;
    const seats: SetupSeat[] = view.seats
      .filter(({ left }) => !left)
      .map(({ id, name, clan }) => ({ id, name, clan, color: clanCssColor(clan) }));
    const allSeats: SetupSeat[] = view.seats.map(({ id, name, clan }) => ({ id, name, clan, color: clanCssColor(clan) }));
    const placeName = (coord: Coord | null) => (coord === null ? null : setup.tiles[coord.row]?.[coord.col]?.name ?? "somewhere");
    const turnSeat = setup.turn === null ? null : this.seat(setup.turn);
    const anchor = this.anchor();
    const hint = anchor === null ? null : placementError(setup as SetupState, anchor, this.rotation);
    return {
      stage: setup.stage,
      prebuilt: setup.templesLocked,
      seats,
      tiles:
        setup.stage !== SetupStage.Tiles
          ? null
          : {
              yourTurn: this.yourTurn,
              message: this.yourTurn ? "Your turn: place a tile" : `${turnSeat?.name ?? "Someone"} is placing a tile`,
              hand: (setup.hands[view.you] ?? []).map(tileData),
              selected: this.selectedTile,
              rotation: this.rotation,
              placed: setup.placed,
              total: setup.total,
              hint: setup.placed === 0 ? "The first tile goes at the centre: click anywhere on the table." : hint,
              hands: allSeats.map((seat) => ({ seat, count: setup.hands[seat.id]?.length ?? 0, playing: seat.id === setup.turn })),
            },
      cities:
        setup.stage !== SetupStage.Cities
          ? null
          : { rows: allSeats.map((seat) => ({ seat, location: placeName(setup.cities[seat.id]) })), selected: this.selectedClan },
      temples: setup.stage !== SetupStage.Temples ? null : { count: setup.temples.length, max: MAX_TEMPLES },
      agreement:
        setup.stage === SetupStage.Tiles
          ? null
          : {
              agreed: setup.agreed,
              you: view.you,
              error: setup.stage === SetupStage.Cities && setup.cities.some((city) => city === null) ? "Every Clan needs a starting City" : null,
            },
    };
  }

  private barData() {
    const view = this.view.get();
    const setup = this.setup;
    const hints: Record<SetupStage, string> = {
      [SetupStage.Tiles]: "Step 1 of 3 · Territory tiles",
      [SetupStage.Cities]: "Step 2 of 3 · Starting Cities",
      [SetupStage.Temples]: "Step 3 of 3 · Temples",
    };
    const waiting = view.seats.filter(({ id, left }) => !left && !setup.agreed.includes(id));
    const status =
      setup.stage === SetupStage.Tiles
        ? this.yourTurn
          ? "Your turn"
          : `${setup.turn === null ? "Someone" : this.seat(setup.turn).name} is placing a tile`
        : waiting.length === 0
          ? "Everyone agrees"
          : `Waiting for ${waiting.map(({ name }) => name).join(", ")}`;
    return {
      title: "Map setup",
      hint: setup.templesLocked ? "Prebuilt map · Starting Cities" : hints[setup.stage],
      seats: view.seats.map((seat) => ({
        label: seat.name,
        clan: seat.clan,
        color: clanCssColor(seat.clan),
        submitted: setup.stage !== SetupStage.Tiles && setup.agreed.includes(seat.id),
        you: seat.id === view.you,
        left: seat.left,
      })),
      status,
      exitLabel: view.host === view.self ? "End game" : "Leave",
    };
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if ((event.key === "r" || event.key === "R") && !(event.target instanceof HTMLInputElement)) {
      this.rotate(event.shiftKey ? -1 : 1);
    }
  };
}

function tileData(id: TileGroupId): SetupTile {
  const group = tileGroup(id)!;
  return {
    id,
    cells: group.cells.map((tile) => ({
      color: `#${TILE_COLORS[tile.type].toString(16).padStart(6, "0")}`,
      label: tile.name ? `${tile.name} (${tile.type})` : tile.type,
    })),
  };
}

function expectedArea(tiles: number): THREE.Box3 {
  const radius = Math.sqrt((tiles * 7 * HEX_AREA) / Math.PI) * AREA_MARGIN;
  return new THREE.Box3(new THREE.Vector3(-radius, -radius, TILE_BOTTOM_Z), new THREE.Vector3(radius, radius, BOARD_HEIGHT));
}
