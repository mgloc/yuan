import type { Clan, Coord, Plan, PlayerId } from "../game_types.ts";
import type { TileGroupId } from "../game/setup/tile_groups.ts";
import { Observable } from "../interaction/observable.ts";
import { RoomAction, type PlayerView, type RoomOptions, type Session } from "../protocol.ts";
import { eventsUrl, roomAction } from "./api.ts";

export type GoneReason = "closed" | "unavailable";

export interface GameClientHandlers {
  onGone: (reason: GoneReason) => void;
  onError: (message: string) => void;
}

export class GameClient {
  view = new Observable<PlayerView | null>(null);
  session: Session;
  private as: PlayerId | undefined;
  private source: EventSource | null = null;
  private handlers: GameClientHandlers;

  constructor(session: Session, handlers: GameClientHandlers) {
    this.session = session;
    this.handlers = handlers;
    window.addEventListener("beforeunload", this.onUnload);
    this.connect();
  }

  get isHost(): boolean {
    const view = this.view.get();
    return view !== null && view.host === view.self;
  }

  actAs(player: PlayerId) {
    const as = player === this.view.get()?.self ? undefined : player;
    if (as === this.as) {
      return;
    }
    this.as = as;
    this.connect();
  }

  setOptions(options: Partial<Pick<RoomOptions, "clanPowers" | "map" | "bidding" | "clans">>) {
    this.send(RoomAction.Options, { options });
  }

  placeTile(tile: TileGroupId, anchor: Coord, rotation: number) {
    this.send(RoomAction.PlaceTile, { tile, anchor, rotation });
  }

  setCity(clan: Clan, coord: Coord | null) {
    this.send(RoomAction.SetCity, { clan, coord });
  }

  toggleTemple(coord: Coord) {
    this.send(RoomAction.ToggleTemple, { coord });
  }

  agree(agreed: boolean) {
    this.send(RoomAction.Agree, { agreed });
  }

  bid(amount: number) {
    this.send(RoomAction.Bid, { amount });
  }

  chooseClan(clan: Clan) {
    this.send(RoomAction.ChooseClan, { clan });
  }

  start() {
    this.send(RoomAction.Start);
  }

  submit(plan: Plan) {
    this.send(RoomAction.Plan, { plan });
  }

  edit() {
    this.send(RoomAction.Edit);
  }

  addPlayer() {
    this.send(RoomAction.AddPlayer);
  }

  restart() {
    this.send(RoomAction.Restart);
  }

  toLobby() {
    this.as = undefined;
    this.connect();
    this.send(RoomAction.Lobby);
  }

  async leave() {
    await this.finish(RoomAction.Leave);
  }

  async deleteGame() {
    await this.finish(RoomAction.Delete);
  }

  close() {
    window.removeEventListener("beforeunload", this.onUnload);
    this.disconnect();
  }

  private onUnload = () => this.disconnect();

  private disconnect() {
    this.source?.close();
    this.source = null;
  }

  private connect() {
    this.disconnect();
    const source = new EventSource(eventsUrl(this.session, this.as));
    source.onmessage = (event) => this.view.set(JSON.parse(event.data) as PlayerView);
    source.addEventListener("closed", () => {
      if (this.source === source) {
        this.close();
        this.handlers.onGone("closed");
      }
    });
    source.onerror = () => {
      if (source.readyState === EventSource.CLOSED && this.source === source) {
        this.close();
        this.handlers.onGone("unavailable");
      }
    };
    this.source = source;
  }

  private async finish(action: RoomAction) {
    this.disconnect();
    try {
      await roomAction(this.session.code, action, { token: this.session.token });
    } catch (error) {
      this.connect();
      throw error;
    }
  }

  private send(action: RoomAction, body: object = {}) {
    roomAction(this.session.code, action, { token: this.session.token, as: this.as, ...body }).catch((error: Error) =>
      this.handlers.onError(error.message),
    );
  }
}
