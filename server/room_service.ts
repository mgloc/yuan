import { randomBytes, randomInt } from "node:crypto";
import type { Session } from "../src/protocol.ts";
import type { Notifier } from "./notifier.ts";
import { newRoomState, Room, RoomError } from "./room.ts";
import type { RoomStore } from "./store/store.ts";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 5;
const CODE_ATTEMPTS = 20;
const SAVE_ATTEMPTS = 5;
const CODE_PATTERN = /^[A-Z2-9]{5}$/;

export interface LoadedRoom {
  room: Room;
  version: number;
}

export class RoomService {
  private store: RoomStore;
  private notifier: Notifier;
  private now: () => number;

  constructor(store: RoomStore, notifier: Notifier, now: () => number = Date.now) {
    this.store = store;
    this.notifier = notifier;
    this.now = now;
  }

  async create(name: string, debug: boolean, maxRooms: number): Promise<Session> {
    if ((await this.store.count()) >= maxRooms) {
      throw new RoomError(503, "Too many games are running, try again later");
    }
    for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
      const room = this.wrap(newRoomState(newCode(), debug));
      const member = room.join(name);
      if (await this.store.insert(room.state, this.now())) {
        return { code: room.code, player: member.id, token: member.token };
      }
    }
    throw new RoomError(503, "Could not allocate a game code");
  }

  async load(code: string): Promise<LoadedRoom> {
    const normalized = code.toUpperCase();
    const stored = CODE_PATTERN.test(normalized) ? await this.store.load(normalized) : null;
    if (stored === null) {
      throw new RoomError(404, "No game with this code");
    }
    return { room: this.wrap(stored.state), version: stored.version };
  }

  async mutate<T>(code: string, change: (room: Room) => T): Promise<T> {
    for (let attempt = 0; attempt < SAVE_ATTEMPTS; attempt++) {
      const { room, version } = await this.load(code);
      const result = change(room);
      if (await this.store.save(room.state, version, this.now())) {
        this.notifier.publish(room.code);
        return result;
      }
    }
    throw new RoomError(503, "The game is busy, try again");
  }

  async sweep(idleMs: number): Promise<number> {
    return this.store.deleteIdle(this.now() - idleMs, this.notifier.activeCodes());
  }

  private wrap(state: Room["state"]): Room {
    return new Room(state, () => randomBytes(18).toString("base64url"));
  }
}

function newCode(): string {
  return Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
}
