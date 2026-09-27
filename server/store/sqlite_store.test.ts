import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { emptyPlan } from "../../src/game/plan/plan.ts";
import { LocalNotifier } from "../notifier.ts";
import { newRoomState } from "../room.ts";
import { RoomService } from "../room_service.ts";
import { SqliteRoomStore } from "./sqlite_store.ts";
import type { RoomStore } from "./store.ts";

const directories: string[] = [];

function databaseFile(): string {
  const directory = mkdtempSync(join(tmpdir(), "yuan-"));
  directories.push(directory);
  return join(directory, "nested", "yuan.sqlite");
}

afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true })));

describe("SqliteRoomStore", () => {
  it("round-trips a room and refuses duplicate codes", async () => {
    const store = new SqliteRoomStore(":memory:");
    const state = newRoomState("ABCDE", true);
    expect(await store.insert(state, 1)).toBe(true);
    expect(await store.insert(state, 2)).toBe(false);
    expect(await store.load("ABCDE")).toEqual({ state, version: 1 });
    expect(await store.load("ZZZZZ")).toBeNull();
  });

  it("rejects a save based on a stale version", async () => {
    const store = new SqliteRoomStore(":memory:");
    const state = newRoomState("ABCDE", false);
    await store.insert(state, 1);
    expect(await store.save({ ...state, debug: true }, 1, 2)).toBe(true);
    expect(await store.save({ ...state, debug: false }, 1, 3)).toBe(false);
    expect(await store.load("ABCDE")).toEqual({ state: { ...state, debug: true }, version: 2 });
  });

  it("deletes idle rooms except the kept ones", async () => {
    const store = new SqliteRoomStore(":memory:");
    for (const [code, time] of [["AAAAA", 1], ["BBBBB", 1], ["CCCCC", 10]] as const) {
      await store.insert(newRoomState(code, false), time);
    }
    expect(await store.deleteIdle(5, ["BBBBB"])).toBe(1);
    expect(await store.count()).toBe(2);
    expect(await store.load("AAAAA")).toBeNull();
  });

  it("keeps data and migrations across reopening the file", async () => {
    const path = databaseFile();
    const first = new SqliteRoomStore(path);
    await first.insert(newRoomState("ABCDE", false), 1);
    await first.close();
    const second = new SqliteRoomStore(path);
    expect((await second.load("ABCDE"))?.state.code).toBe("ABCDE");
    await second.close();
  });
});

describe("RoomService", () => {
  it("keeps games across a server restart", async () => {
    const path = databaseFile();
    const before = new RoomService(new SqliteRoomStore(path), new LocalNotifier());
    const host = await before.create("Host", false, 10);
    const guest = await before.mutate(host.code, (room) => room.join("Guest"));
    await before.mutate(host.code, (room) => room.start(host.token));
    for (const token of [host.token, guest.token]) {
      await before.mutate(host.code, (room) => room.agree(token, undefined, true));
    }

    const after = new RoomService(new SqliteRoomStore(path), new LocalNotifier());
    await after.mutate(host.code, (room) => room.submit(host.token, undefined, emptyPlan()));
    const { room } = await after.load(host.code);
    expect(room.view(0).match!.plan).toEqual(emptyPlan());
    expect(room.view(0).seats.map(({ name }) => name)).toEqual(["Host", "Guest"]);
  });

  it("retries a change when another request saved first", async () => {
    const store = new SqliteRoomStore(":memory:");
    let conflicts = 1;
    const racing: RoomStore = {
      load: (code) => store.load(code),
      insert: (state, now) => store.insert(state, now),
      count: () => store.count(),
      delete: (code) => store.delete(code),
      deleteIdle: (before, keep) => store.deleteIdle(before, keep),
      close: () => store.close(),
      save: async (state, version, now) => {
        if (conflicts-- > 0) {
          const current = await store.load(state.code);
          await store.save({ ...current!.state, members: [...current!.state.members, { ...current!.state.members[0], id: 1, name: "Racer", token: "racer" }] }, version, now);
        }
        return store.save(state, version, now);
      },
    };
    const notifier = new LocalNotifier();
    const service = new RoomService(racing, notifier);
    const host = await service.create("Host", false, 10);
    let notified = 0;
    notifier.subscribe(host.code, () => notified++);
    const guest = await service.mutate(host.code, (room) => room.join("Guest"));
    expect(guest.id).toBe(2);
    expect((await service.load(host.code)).room.view(0).seats.map(({ name }) => name)).toEqual(["Host", "Racer", "Guest"]);
    expect(notified).toBe(1);
  });

  it("does not save or notify when the change is refused", async () => {
    const notifier = new LocalNotifier();
    const service = new RoomService(new SqliteRoomStore(":memory:"), notifier);
    const host = await service.create("Host", false, 10);
    let notified = 0;
    notifier.subscribe(host.code, () => notified++);
    await expect(service.mutate(host.code, (room) => room.start(host.token))).rejects.toThrow("At least 2");
    expect((await service.load(host.code)).version).toBe(1);
    expect(notified).toBe(0);
    await expect(service.create("Other", false, 1)).rejects.toThrow("Too many games");
  });
});
