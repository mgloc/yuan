import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import type { Session } from "../src/protocol.ts";
import { createApi, type ApiLimits } from "./api.ts";
import { clientIp, IpLimits } from "./ip_limits.ts";
import { SqliteRoomStore } from "./store/sqlite_store.ts";

function request(remoteAddress: string, forwarded?: string): IncomingMessage {
  return { headers: forwarded === undefined ? {} : { "x-forwarded-for": forwarded }, socket: { remoteAddress } } as unknown as IncomingMessage;
}

describe("IpLimits", () => {
  it("caps creations per window and resets afterwards", () => {
    let now = 0;
    const limits = new IpLimits({ creations: 2, windowMs: 1000, streams: 1 }, () => now);
    expect(limits.allowCreation("a")).toBe(true);
    expect(limits.allowCreation("a")).toBe(true);
    expect(limits.allowCreation("a")).toBe(false);
    expect(limits.allowCreation("b")).toBe(true);
    now = 1000;
    expect(limits.allowCreation("a")).toBe(true);
  });

  it("caps open streams and frees a slot once released", () => {
    const limits = new IpLimits({ creations: 1, windowMs: 1000, streams: 2 });
    const first = limits.openStream("a")!;
    expect(limits.openStream("a")).not.toBeNull();
    expect(limits.openStream("a")).toBeNull();
    first();
    first();
    expect(limits.openStream("a")).not.toBeNull();
    expect(limits.openStream("a")).toBeNull();
  });
});

describe("clientIp", () => {
  it("ignores forwarded headers unless the proxy is trusted", () => {
    expect(clientIp(request("10.0.0.1", "1.2.3.4"), false)).toBe("10.0.0.1");
    expect(clientIp(request("10.0.0.1", "6.6.6.6, 1.2.3.4"), true)).toBe("1.2.3.4");
    expect(clientIp(request("10.0.0.1"), true)).toBe("10.0.0.1");
  });
});

describe("per-IP limits on the API", () => {
  let server: Server | undefined;

  afterEach(() => {
    server?.closeAllConnections();
    server?.close();
  });

  async function start(limits: Partial<ApiLimits>) {
    const api = createApi({ store: new SqliteRoomStore(":memory:"), limits, trustProxy: true });
    server = createServer((req, res) => api(req, res, () => res.writeHead(404).end()));
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }

  const create = (base: string, ip: string) =>
    fetch(`${base}/api/games`, { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": ip }, body: "{}" });

  it("refuses new games from an IP over its budget", async () => {
    const base = await start({ creationsPerIp: 2 });
    expect((await create(base, "1.1.1.1")).status).toBe(201);
    expect((await create(base, "1.1.1.1")).status).toBe(201);
    expect((await create(base, "1.1.1.1")).status).toBe(429);
    expect((await create(base, "2.2.2.2")).status).toBe(201);
  });

  it("refuses streams from an IP holding too many", async () => {
    const base = await start({ streamsPerIp: 2 });
    const sessions = (await Promise.all([1, 2, 3].map(() => create(base, "1.1.1.1").then((r) => r.json())))) as Session[];
    const controller = new AbortController();
    const open = (session: Session, ip: string, signal?: AbortSignal) =>
      fetch(`${base}/api/games/${session.code}/events?token=${session.token}`, { headers: { "X-Forwarded-For": ip }, signal });
    expect((await open(sessions[0], "1.1.1.1", controller.signal)).status).toBe(200);
    expect((await open(sessions[1], "1.1.1.1", controller.signal)).status).toBe(200);
    expect((await open(sessions[2], "1.1.1.1")).status).toBe(429);
    const other = new AbortController();
    expect((await open(sessions[2], "2.2.2.2", other.signal)).status).toBe(200);
    controller.abort();
    other.abort();
  });
});
