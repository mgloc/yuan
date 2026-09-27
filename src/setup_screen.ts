import * as THREE from "three";
import { Building, Clan, isLand, type Coord, type Grid, type PlayerId, type Province } from "./game_types.ts";
import { MAX_TEMPLES, placementError, SetupStage, tileCells, type SetupState } from "./game/setup/setup.ts";
import { freeProvince } from "./game/board_layout.ts";
import { tileGroup, type TileGroupId } from "./game/setup/tile_groups.ts";
import { coordKey } from "./game/tile/coords.ts";
import { DebugController } from "./interaction/debug_controller.ts";
import { Observable } from "./interaction/observable.ts";
import type { GameClient } from "./net/game_client.ts";
import type { PlayerView, SetupView } from "./protocol.ts";
import { CLAN_COLORS, clanCssColor, seatCssColor } from "./rendering/clan_colors.ts";
import { Highlight } from "./rendering/highlight.ts";
import { TILE_RADIUS } from "./rendering/hex_layout.ts";
import { TilePicker } from "./rendering/picking.ts";
import { ProceduralPieceFactory } from "./rendering/pieces/procedural_factory.ts";
import { PlanePicker } from "./rendering/plane_picker.ts";
import { TileGhostView } from "./rendering/views/tile_ghost_view.ts";
import { TileGridView } from "./rendering/views/tile_grid_view.ts";
import { TILE_BOTTOM_Z, TILE_HINT_COLORS } from "./rendering/views/tile_view.ts";
import { Stage } from "./stage.ts";
import { element } from "./ui/dom.ts";
import { SetupPanel, type SetupBidding, type SetupCapital, type SetupPanelData, type SetupSeat, type SetupTile } from "./ui/setup_panel.ts";
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
  private pending: Coord | null = null;
  private selectedClan: Clan;
  private onExit: () => void;

  constructor(container: HTMLElement, client: GameClient, initial: PlayerView, onExit: () => void) {
    this.view = new Observable(initial);
    this.client = client;
    this.onExit = onExit;
    this.selectedClan = initial.setup?.clans[0] ?? Clan.Suhey;
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
      onConfirmTile: () => this.confirmTile(),
      onCancelTile: () => this.cancelTile(),
      onSelectClan: (clan) => {
        this.selectedClan = clan;
        this.render();
      },
      onClearCity: (clan) => client.setCity(clan, null),
      onAgree: (agreed) => client.agree(agreed),
      onBid: (amount) => client.bid(amount),
      onChooseClan: (clan) => client.chooseClan(clan),
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
      this.planePicker.onRightClick(() => this.rotate(1)),
    );
    window.addEventListener("keydown", this.onKeyDown);

    if (initial.debug && client.isHost) {
      const cssColor = (player: PlayerId) => seatCssColor(this.seat(player).clan);
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
      this.pending = null;
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
    this.grid!.updateProvinces(setup.stage === SetupStage.Tiles ? [] : capitalBoard(setup), (capital) => CLAN_COLORS[setup.clans[capital]]);
  }

  private syncSelection() {
    const hand = this.setup.hands[this.view.get().you] ?? [];
    if (this.selectedTile === null || !hand.includes(this.selectedTile)) {
      this.selectedTile = hand[0] ?? null;
    }
    if (!this.setup.clans.includes(this.selectedClan)) {
      this.selectedClan = this.setup.clans[0];
    }
  }

  private anchor(): Coord | null {
    const setup = this.setup;
    const point = this.pending ?? this.hovered;
    if (point === null) {
      return null;
    }
    return setup.placed === 0 && setup.origin !== null ? setup.origin : point;
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
    const city = this.setup.stage === SetupStage.Cities ? this.setup.cities[this.setup.clans.indexOf(this.selectedClan)] : null;
    this.grid?.setHighlights(new Map(city ? [[coordKey(city), Highlight.Selected]] : []));
  }

  private rotate(delta: number) {
    this.rotation = (((this.rotation + delta) % 6) + 6) % 6;
    this.render();
  }

  private placeAt(coord: Coord) {
    if (!this.yourTurn || this.selectedTile === null) {
      return;
    }
    this.pending = null;
    this.hovered = coord;
    const anchor = this.anchor();
    if (anchor === null || placementError(this.setup as SetupState, anchor, this.rotation) !== null) {
      this.render();
      return;
    }
    this.pending = anchor;
    this.render();
  }

  private confirmTile() {
    const anchor = this.pending;
    if (!this.yourTurn || this.selectedTile === null || anchor === null) {
      return;
    }
    if (placementError(this.setup as SetupState, anchor, this.rotation) !== null) {
      return;
    }
    this.pending = null;
    this.client.placeTile(this.selectedTile, anchor, this.rotation);
    this.render();
  }

  private cancelTile() {
    this.pending = null;
    this.render();
  }

  private pickProvince(coord: Coord) {
    const setup = this.setup;
    const tile = setup.tiles[coord.row]?.[coord.col];
    if (tile === null || tile === undefined || !isLand(tile)) {
      return;
    }
    if (setup.stage === SetupStage.Cities) {
      const current = setup.cities[setup.clans.indexOf(this.selectedClan)];
      this.client.setCity(this.selectedClan, current !== null && coordKey(current) === coordKey(coord) ? null : coord);
    } else if (setup.stage === SetupStage.Temples) {
      this.client.toggleTemple(coord);
    }
  }

  private panelData(): SetupPanelData {
    const view = this.view.get();
    const setup = this.setup;
    const seats: SetupSeat[] = view.seats.filter(({ left }) => !left).map(({ id, name, clan }) => ({ id, name, color: seatCssColor(clan) }));
    const allSeats: SetupSeat[] = view.seats.map(({ id, name, clan }) => ({ id, name, color: seatCssColor(clan) }));
    const placeName = (coord: Coord | null) => (coord === null ? null : setup.tiles[coord.row]?.[coord.col]?.name ?? "somewhere");
    const capitals: SetupCapital[] = setup.clans.map((clan, i) => ({
      clan,
      color: clanCssColor(clan),
      location: placeName(setup.cities[i]),
      owner: setup.owners[i] === null ? null : this.seat(setup.owners[i]!).name,
    }));
    const turnSeat = setup.turn === null ? null : this.seat(setup.turn);
    const anchor = this.anchor();
    const hint = anchor === null ? null : placementError(setup as SetupState, anchor, this.rotation);
    const pendingError = this.pending === null ? null : placementError(setup as SetupState, this.pending, this.rotation);
    return {
      stage: setup.stage,
      prefilled: [
        ...(setup.templesLocked ? [SetupStage.Tiles, SetupStage.Temples] : []),
        ...(setup.citiesLocked ? [SetupStage.Cities] : []),
      ],
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
              hint:
                this.pending !== null
                  ? (pendingError ?? "Confirm to place it, or click elsewhere to move it.")
                  : setup.placed === 0
                    ? "The first tile goes at the centre: click anywhere on the table."
                    : (hint ?? "Left click the table to place, right click to rotate."),
              pending: this.pending !== null,
              canConfirm: this.pending !== null && pendingError === null,
              hands: allSeats.map((seat) => ({ seat, count: setup.hands[seat.id]?.length ?? 0, playing: seat.id === setup.turn })),
            },
      cities:
        setup.stage !== SetupStage.Cities
          ? null
          : { rows: capitals, selected: this.selectedClan },
      clans: setup.stage !== SetupStage.Clans ? null : { capitals, bidding: this.biddingData() },
      temples: setup.stage !== SetupStage.Temples ? null : { count: setup.temples.length, max: MAX_TEMPLES },
      agreement:
        setup.stage === SetupStage.Tiles || setup.stage === SetupStage.Clans
          ? null
          : {
              agreed: setup.agreed,
              you: view.you,
              error: setup.stage === SetupStage.Cities && setup.cities.some((city) => city === null) ? "Every Clan needs a starting City" : null,
            },
    };
  }

  private biddingData(): SetupBidding | null {
    const view = this.view.get();
    const bidding = this.setup.bidding;
    if (bidding === null) {
      return null;
    }
    const name = (player: PlayerId) => this.seat(player).name;
    const names = (players: PlayerId[]) => players.map(name).join(", ");
    const waiting = bidding.contenders.filter((id) => !bidding.submitted.includes(id));
    const status =
      bidding.chooser !== null
        ? bidding.chooser === view.you
          ? "Pick the capital you want to play."
          : `${name(bidding.chooser)} won the bid and is choosing a capital.`
        : bidding.tieBreak
          ? `Tie between ${names(bidding.contenders)}: they bid again${waiting.length > 0 ? `, waiting for ${names(waiting)}` : ""}.`
          : `Hidden bids, revealed together. Waiting for ${names(waiting)}.`;
    const rounds = bidding.history.map((round, i) => {
      const bids = round.bids.map(({ player, amount }) => `${name(player)} ${amount}₵`).join(", ");
      const result =
        round.winner === null
          ? "tie, re-bid"
          : `${name(round.winner)} wins${round.random ? " (drawn at random)" : ""}${round.clan ? ` and takes ${round.clan}` : ""}`;
      return `Round ${i + 1}: ${bids} → ${result}`;
    });
    return {
      chao: bidding.chao[view.you],
      canBid: bidding.chooser === null && bidding.contenders.includes(view.you) && bidding.yourBid === null,
      yourBid: bidding.yourBid,
      status,
      choosing: bidding.chooser === view.you,
      rounds,
    };
  }

  private barData() {
    const view = this.view.get();
    const setup = this.setup;
    const hints: Record<SetupStage, string> = {
      [SetupStage.Tiles]: "Step 1 of 4 · Territory tiles",
      [SetupStage.Cities]: "Step 2 of 4 · Starting Cities",
      [SetupStage.Temples]: "Step 3 of 4 · Temples",
      [SetupStage.Clans]: "Step 4 of 4 · Bidding for Clans",
    };
    const waiting = view.seats.filter(({ id, left }) => !left && !setup.agreed.includes(id));
    const bidding = setup.bidding;
    const status =
      setup.stage === SetupStage.Clans
        ? bidding?.chooser != null
          ? `${this.seat(bidding.chooser).name} is choosing a capital`
          : "Bidding"
        : setup.stage === SetupStage.Tiles
        ? this.yourTurn
          ? "Your turn"
          : `${setup.turn === null ? "Someone" : this.seat(setup.turn).name} is placing a tile`
        : waiting.length === 0
          ? "Everyone agrees"
          : `Waiting for ${waiting.map(({ name }) => name).join(", ")}`;
    return {
      title: "Map setup",
      hint: setup.templesLocked ? `Prebuilt map · ${setup.stage === SetupStage.Clans ? "Bidding for Clans" : "Starting Cities"}` : hints[setup.stage],
      seats: view.seats.map((seat) => ({
        label: seat.name,
        clan: seat.clan ?? "No Clan yet",
        color: seatCssColor(seat.clan),
        submitted:
          setup.stage === SetupStage.Clans
            ? seat.clan !== null || (bidding?.submitted.includes(seat.id) ?? false)
            : setup.stage !== SetupStage.Tiles && setup.agreed.includes(seat.id),
        you: seat.id === view.you,
        left: seat.left,
      })),
      status,
      exitLabel: view.host === view.self ? "End game" : "Leave",
    };
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (event.target instanceof HTMLInputElement) {
      return;
    }
    if (event.key === "r" || event.key === "R") {
      this.rotate(event.shiftKey ? -1 : 1);
    } else if (event.key === "Enter" && this.pending !== null) {
      this.confirmTile();
    } else if (event.key === "Escape" && this.pending !== null) {
      this.cancelTile();
    }
  };
}

export function tileData(id: TileGroupId): SetupTile {
  const group = tileGroup(id)!;
  return {
    id,
    cells: group.cells.map((tile) => ({
      color: `#${TILE_HINT_COLORS[tile.type].toString(16).padStart(6, "0")}`,
      label: tile.name ? `${tile.name} (${tile.type})` : tile.type,
    })),
  };
}

export function expectedArea(tiles: number): THREE.Box3 {
  const radius = Math.sqrt((tiles * 7 * HEX_AREA) / Math.PI) * AREA_MARGIN;
  return new THREE.Box3(new THREE.Vector3(-radius, -radius, TILE_BOTTOM_Z), new THREE.Vector3(radius, radius, BOARD_HEIGHT));
}

function capitalBoard(setup: SetupView): Grid<Province> {
  const temples = new Set(setup.temples.map(coordKey));
  const provinces = setup.tiles.map((line, row) =>
    line.map((tile, col) => (tile !== null && isLand(tile) ? freeProvince({ temple: temples.has(coordKey({ col, row })) }) : null)),
  );
  setup.cities.forEach((city, capital) => {
    const province = city === null ? null : provinces[city.row]?.[city.col];
    if (province) {
      province.owner = capital;
      province.building = Building.City;
    }
  });
  return provinces;
}
