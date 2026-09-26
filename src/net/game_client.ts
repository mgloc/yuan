import type { Plan, PlayerId } from "../game_types.ts";
import { Observable } from "../interaction/observable.ts";
import { RoomAction, type PlayerView, type Session } from "../protocol.ts";
import { eventsUrl, roomAction } from "./api.ts";

export interface GameClientHandlers {
  onGone: () => void;
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
    return this.view.get()?.host === this.session.player;
  }

  actAs(player: PlayerId) {
    const as = player === this.session.player ? undefined : player;
    if (as === this.as) {
      return;
    }
    this.as = as;
    this.connect();
  }

  setOptions(clanPowers: boolean) {
    this.send(RoomAction.Options, { options: { clanPowers } });
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
    source.onerror = () => {
      if (source.readyState === EventSource.CLOSED && this.source === source) {
        this.close();
        this.handlers.onGone();
      }
    };
    this.source = source;
  }

  private send(action: RoomAction, body: object = {}) {
    roomAction(this.session.code, action, { token: this.session.token, as: this.as, ...body }).catch((error: Error) =>
      this.handlers.onError(error.message),
    );
  }
}
