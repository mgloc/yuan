import type { RoomState } from "../room.ts";

export interface StoredRoom {
  state: RoomState;
  version: number;
}

export interface RoomStore {
  load(code: string): Promise<StoredRoom | null>;
  insert(state: RoomState, now: number): Promise<boolean>;
  save(state: RoomState, version: number, now: number): Promise<boolean>;
  delete(code: string): Promise<boolean>;
  count(): Promise<number>;
  deleteIdle(before: number, keep: readonly string[]): Promise<number>;
  close(): Promise<void>;
}
