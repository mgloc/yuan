import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { STARTING_CITIES } from "../src/game/default_map.ts";
import { emptyPlan } from "../src/game/plan/plan.ts";
import type { PlayerView, Session } from "../src/protocol.ts";
import { createApi } from "./api.ts";
import { staticFiles } from "./static.ts";
import { SqliteRoomStore } from "./store/sqlite_store.ts";

let server: Server;
let base: string;

beforeAll(async () => {
  const api = createApi({ store: new SqliteRoomStore(":memory:"), limits: { maxRooms: 50, maxStreamsPerRoom: 3, creationsPerIp: 1000 } });
  const serveStatic = staticFiles("/nonexistent");
  server = createServer((req, res) => api(req, res, () => serveStatic(req.url ?? "/", res)));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.closeAllConnections();
  server.close();
});

async function call(path: string, body?: unknown, init: RequestInit = {}) {
  const response = await fetch(`${base}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    ...init,
  });
  const text = await response.text();
  return { status: response.status, body: text === "" ? null : JSON.parse(text) };
}

async function firstView(session: Session, as?: number): Promise<{ status: number; view: PlayerView | null }> {
  const query = new URLSearchParams({ token: session.token, ...(as === undefined ? {} : { as: String(as) }) });
  const controller = new AbortController();
  const response = await fetch(`${base}/api/games/${session.code}/events?${query}`, { signal: controller.signal });
  if (response.headers.get("content-type") !== "text/event-stream") {
    return { status: response.status, view: null };
  }
  const reader = response.body!.getReader();
  let text = "";
  while (!text.includes("\n\n")) {
    text += new TextDecoder().decode((await reader.read()).value);
  }
  controller.abort();
  return { status: response.status, view: JSON.parse(text.slice(text.indexOf("data: ") + 6, text.indexOf("\n\n"))) };
}

async function game(debug = false) {
  const host = (await call("/api/games", { name: "Host", debug })).body as Session;
  const guest = (await call(`/api/games/${host.code}/join`, { name: "Guest" })).body as Session;
  return { host, guest, code: host.code };
}

describe("malformed requests", () => {
  it("rejects wrong methods, paths and actions without crashing", async () => {
    const { host } = await game();
    expect((await call("/api/games")).status).toBe(405);
    expect((await call("/api/nothing")).status).toBe(404);
    expect((await call(`/api/games/${host.code}/plan/extra`, {})).status).toBe(404);
    expect((await call(`/api/games/${host.code}/hack`, { token: host.token })).status).toBe(404);
    expect((await call(`/api/games/${host.code}/start`)).status).toBe(405);
    expect((await call("/api/games/NOPE0/join", { name: "x" })).status).toBe(404);
    expect((await call("/api/games/..%2F..%2Fetc/join", { name: "x" })).status).toBe(404);
  });

  it("rejects bodies that are not a small JSON object", async () => {
    expect((await call("/api/games", "{not json")).status).toBe(400);
    expect((await call("/api/games", [1, 2])).status).toBe(400);
    expect((await call("/api/games", "null")).status).toBe(400);
    expect((await call("/api/games", { name: { evil: true } })).status).toBe(400);
    expect((await call("/api/games", { name: "x".repeat(20_000) })).status).toBe(413);
    const form = await call("/api/games", "name=x", { headers: { "Content-Type": "application/x-www-form-urlencoded" } });
    expect(form.status).toBe(415);
  });

  it("never exposes internal errors", async () => {
    const response = await call("/api/games");
    expect(response.body.error).toBe("Method not allowed");
  });

  it("survives malformed static URLs", async () => {
    const response = await fetch(`${base}/%E0%A4%A`);
    expect(response.status).toBe(400);
    expect((await fetch(`${base}/`)).status).toBe(404);
  });
});

describe("authorisation", () => {
  it("requires a valid token for every action and for the event stream", async () => {
    const { code } = await game();
    expect((await call(`/api/games/${code}/start`, {})).status).toBe(401);
    expect((await call(`/api/games/${code}/start`, { token: 42 })).status).toBe(401);
    expect((await call(`/api/games/${code}/start`, { token: "forged" })).status).toBe(403);
    expect((await firstView({ code, player: 0, token: "forged" })).status).toBe(403);
  });

  it("keeps host-only actions for the host", async () => {
    const { guest, code } = await game();
    expect((await call(`/api/games/${code}/start`, { token: guest.token })).status).toBe(403);
    expect((await call(`/api/games/${code}/options`, { token: guest.token, options: { clanPowers: false } })).status).toBe(403);
    expect((await call(`/api/games/${code}/add-player`, { token: guest.token })).status).toBe(403);
    expect((await call(`/api/games/${code}/restart`, { token: guest.token })).status).toBe(403);
  });

  it("does not let anyone play another seat outside debug mode", async () => {
    const { host, guest, code } = await game();
    await call(`/api/games/${code}/start`, { token: host.token });
    expect((await call(`/api/games/${code}/plan`, { token: host.token, as: 1, plan: emptyPlan() })).status).toBe(403);
    expect((await call(`/api/games/${code}/plan`, { token: guest.token, as: 0, plan: emptyPlan() })).status).toBe(403);
    expect((await firstView(host, 1)).status).toBe(403);
    expect((await firstView(host, Number.NaN)).status).toBe(400);
  });

  it("limits the debug host to placeholder seats", async () => {
    const { host, guest, code } = await game(true);
    await call(`/api/games/${code}/add-player`, { token: host.token });
    await call(`/api/games/${code}/start`, { token: host.token });
    expect((await call(`/api/games/${code}/plan`, { token: host.token, as: 2, plan: emptyPlan() })).status).toBe(200);
    expect((await call(`/api/games/${code}/plan`, { token: host.token, as: 1, plan: emptyPlan() })).status).toBe(403);
    expect((await firstView(host, 1)).status).toBe(403);
    expect((await call(`/api/games/${code}/plan`, { token: guest.token, as: 2, plan: emptyPlan() })).status).toBe(403);
  });
});

describe("game rules on the server", () => {
  it("rejects malformed and impossible plans", async () => {
    const { host, code } = await game();
    const submit = (plan: unknown) => call(`/api/games/${code}/plan`, { token: host.token, plan });
    expect((await submit(emptyPlan())).status).toBe(409);
    await call(`/api/games/${code}/start`, { token: host.token });
    const actions = (Development: unknown) => ({ Development, Fortification: null, Militarisation: null });
    expect((await submit(null)).status).toBe(400);
    expect((await submit({ target: { col: "0", row: 0 }, actions: actions(1) })).status).toBe(400);
    expect((await submit({ target: { col: 0.5, row: 0 }, actions: actions(1) })).status).toBe(400);
    expect((await submit({ target: STARTING_CITIES[0], actions: actions(4) })).status).toBe(400);
    expect((await submit({ target: STARTING_CITIES[0], actions: actions("1") })).status).toBe(400);
    expect((await submit({ target: { col: 99, row: -3 }, actions: actions(1) })).status).toBe(422);
    expect((await submit({ target: STARTING_CITIES[1], actions: actions(1) })).status).toBe(422);
    expect((await submit({ target: { col: 4, row: 3 }, actions: actions(1) })).status).toBe(422);
    expect((await submit({ target: STARTING_CITIES[0], actions: { ...actions(3), Fortification: 3 } })).status).toBe(422);
    expect((await submit({ target: STARTING_CITIES[0], actions: actions(1) })).status).toBe(200);
    expect((await submit({ target: STARTING_CITIES[0], actions: actions(1) })).status).toBe(409);
  });

  it("refuses late joins, a fifth player and option changes after launch", async () => {
    const { host, code } = await game();
    await call(`/api/games/${code}/join`, { name: "Third" });
    await call(`/api/games/${code}/join`, { name: "Fourth" });
    expect((await call(`/api/games/${code}/join`, { name: "Fifth" })).status).toBe(409);
    await call(`/api/games/${code}/start`, { token: host.token });
    expect((await call(`/api/games/${code}/options`, { token: host.token, options: { clanPowers: false } })).status).toBe(409);
    expect((await call(`/api/games/${code}/start`, { token: host.token })).status).toBe(409);
  });

  it("streams only the viewer's own Chão and plan", async () => {
    const { host, guest, code } = await game();
    await call(`/api/games/${code}/start`, { token: host.token });
    const plan = { target: STARTING_CITIES[1], actions: { Development: 1, Fortification: null, Militarisation: null } };
    await call(`/api/games/${code}/plan`, { token: guest.token, plan });
    const { view } = await firstView(host);
    expect(view!.match!.plan).toBeNull();
    expect(view!.seats[1].submitted).toBe(true);
    const text = JSON.stringify(view);
    expect(text).not.toContain(guest.token);
    expect(text).not.toContain('"players"');
    expect(text).not.toContain('"Development":1');
  });

  it("caps live streams per game", async () => {
    const { host, code } = await game();
    const controller = new AbortController();
    const url = `${base}/api/games/${code}/events?token=${host.token}`;
    await Promise.all([1, 2, 3].map(() => fetch(url, { signal: controller.signal })));
    expect((await fetch(url)).status).toBe(429);
    controller.abort();
  });
});

describe("closing and leaving", () => {
  it("lets only the host delete the game and tells connected players", async () => {
    const { host, guest, code } = await game();
    expect((await call(`/api/games/${code}/delete`, { token: guest.token })).status).toBe(403);

    const controller = new AbortController();
    const response = await fetch(`${base}/api/games/${code}/events?token=${guest.token}`, { signal: controller.signal });
    const reader = response.body!.getReader();
    let text = "";
    while (!text.includes("\n\n")) {
      text += new TextDecoder().decode((await reader.read()).value);
    }

    expect((await call(`/api/games/${code}/delete`, { token: host.token })).status).toBe(200);
    while (!text.includes("event: closed")) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      text += new TextDecoder().decode(value);
    }
    expect(text).toContain("event: closed");
    controller.abort();
    expect((await call(`/api/games/${code}/join`, { name: "Late" })).status).toBe(404);
  });

  it("drops the stream of a player who left", async () => {
    const { host, guest, code } = await game();
    await call(`/api/games/${code}/leave`, { token: guest.token });
    expect((await firstView(guest)).status).toBe(403);
    expect((await call(`/api/games/${code}/leave`, { token: host.token })).status).toBe(409);
  });
});
