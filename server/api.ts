import type { IncomingMessage, ServerResponse } from "node:http";
import type { PlayerId } from "../src/game_types.ts";
import { RoomAction, type Credentials, type ErrorResponse } from "../src/protocol.ts";
import { LocalNotifier, type Notifier } from "./notifier.ts";
import { parsePlan, RoomError, type Room } from "./room.ts";
import { RoomService } from "./room_service.ts";
import type { RoomStore } from "./store/store.ts";

const MAX_BODY_BYTES = 16 * 1024;
const KEEP_ALIVE_MS = 25_000;
const SWEEP_MS = 10 * 60_000;

export interface ApiLimits {
  maxRooms: number;
  maxStreamsPerRoom: number;
  roomIdleMs: number;
}

export interface ApiOptions {
  store: RoomStore;
  notifier?: Notifier;
  limits?: Partial<ApiLimits>;
}

const DEFAULT_LIMITS: ApiLimits = {
  maxRooms: 500,
  maxStreamsPerRoom: 24,
  roomIdleMs: 6 * 60 * 60_000,
};

const ROOM_ACTIONS = new Set<string>(Object.values(RoomAction));

type Next = () => void;

export function createApi({ store, notifier = new LocalNotifier(), limits = {} }: ApiOptions) {
  const { maxRooms, maxStreamsPerRoom, roomIdleMs } = { ...DEFAULT_LIMITS, ...limits };
  const rooms = new RoomService(store, notifier);
  const sweep = () => rooms.sweep(roomIdleMs).catch((error: unknown) => console.error(error));
  setInterval(sweep, SWEEP_MS).unref();

  const create = async (req: IncomingMessage, res: ServerResponse) => {
    const body = await readBody(req);
    await sweep();
    send(res, 201, await rooms.create(nameOf(body), body.debug === true, maxRooms));
  };

  const act = async (req: IncomingMessage, res: ServerResponse, code: string, action: string) => {
    const body = await readBody(req);
    if (action === "join") {
      const name = nameOf(body);
      const member = await rooms.mutate(code, (room) => room.join(name));
      return send(res, 201, { code: code.toUpperCase(), player: member.id, token: member.token });
    }
    if (!ROOM_ACTIONS.has(action)) {
      throw new RoomError(404, "Unknown action");
    }
    const { token, as } = credentials(body);
    const change = actionFor(action as RoomAction, body, token, as);
    await rooms.mutate(code, change);
    send(res, 200, {});
  };

  const stream = async (req: IncomingMessage, res: ServerResponse, code: string, token: string, as: PlayerId | undefined) => {
    const loaded = await rooms.load(code);
    const player = loaded.room.actor(token, as);
    if (notifier.listeners(loaded.room.code) >= maxStreamsPerRoom) {
      throw new RoomError(429, "Too many connections to this game");
    }
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    let version = 0;
    const push = ({ room, version: next }: { room: Room; version: number }) => {
      if (next <= version || res.writableEnded) {
        return;
      }
      version = next;
      res.write(`data: ${JSON.stringify(room.view(player))}\n\n`);
    };
    push(loaded);
    const refresh = () =>
      rooms.load(code).then(push, (error: unknown) => {
        if (error instanceof RoomError && error.status === 404) {
          res.end();
        }
      });
    const unsubscribe = notifier.subscribe(loaded.room.code, refresh);
    const keepAlive = setInterval(() => res.write(": keep-alive\n\n"), KEEP_ALIVE_MS);
    req.on("close", () => {
      unsubscribe();
      clearInterval(keepAlive);
    });
  };

  const route = async (req: IncomingMessage, res: ServerResponse, path: string[], query: URLSearchParams) => {
    if (path.length === 0) {
      requireMethod(req, "POST");
      return create(req, res);
    }
    if (path.length !== 2) {
      throw new RoomError(404, "Not found");
    }
    const [code, action] = path;
    if (action === "events") {
      requireMethod(req, "GET");
      return stream(req, res, code, query.get("token") ?? "", seatParam(query.get("as")));
    }
    requireMethod(req, "POST");
    return act(req, res, code, action);
  };

  return (req: IncomingMessage, res: ServerResponse, next: Next) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments[0] !== "api") {
      return next();
    }
    const handled = segments[1] === "games" ? route(req, res, segments.slice(2), url.searchParams) : Promise.reject(new RoomError(404, "Not found"));
    handled.catch((error: unknown) => {
      if (!(error instanceof RoomError)) {
        console.error(error);
      }
      if (!res.headersSent) {
        const status = error instanceof RoomError ? error.status : 500;
        send(res, status, { error: error instanceof RoomError ? error.message : "Server error" } satisfies ErrorResponse);
      }
    });
  };
}

function actionFor(action: RoomAction, body: Record<string, unknown>, token: string, as: PlayerId | undefined): (room: Room) => void {
  switch (action) {
    case RoomAction.Options: {
      const options = optionsOf(body);
      return (room) => room.setOptions(token, options);
    }
    case RoomAction.Start:
      return (room) => room.start(token);
    case RoomAction.Plan: {
      const plan = parsePlan(body.plan);
      if (plan === null) {
        throw new RoomError(400, "Invalid plan");
      }
      return (room) => room.submit(token, as, plan);
    }
    case RoomAction.Edit:
      return (room) => room.edit(token, as);
    case RoomAction.AddPlayer:
      return (room) => room.addPlayer(token);
    case RoomAction.Restart:
      return (room) => room.restart(token);
    case RoomAction.Lobby:
      return (room) => room.backToLobby(token);
  }
}

function requireMethod(req: IncomingMessage, method: string) {
  if (req.method !== method) {
    throw new RoomError(405, "Method not allowed");
  }
}

function seatParam(value: string | null): PlayerId | undefined {
  if (value === null) {
    return undefined;
  }
  const seat = Number(value);
  if (value.trim() === "" || !Number.isInteger(seat)) {
    throw new RoomError(400, "Invalid seat");
  }
  return seat;
}

function nameOf(body: Record<string, unknown>): string {
  if (body.name !== undefined && typeof body.name !== "string") {
    throw new RoomError(400, "The name must be text");
  }
  return body.name ?? "";
}

function optionsOf(body: Record<string, unknown>): { clanPowers?: boolean } {
  const options = body.options;
  if (typeof options !== "object" || options === null || typeof (options as Record<string, unknown>).clanPowers !== "boolean") {
    throw new RoomError(400, "Invalid options");
  }
  return { clanPowers: (options as { clanPowers: boolean }).clanPowers };
}

function credentials(body: Record<string, unknown>): Credentials {
  if (typeof body.token !== "string" || body.token === "") {
    throw new RoomError(401, "Missing token");
  }
  if (body.as !== undefined && body.as !== null && !Number.isInteger(body.as)) {
    throw new RoomError(400, "Invalid seat");
  }
  return { token: body.token, as: typeof body.as === "number" ? body.as : undefined };
}

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const type = req.headers["content-type"]?.split(";")[0].trim().toLowerCase();
  if (type !== "application/json") {
    throw new RoomError(415, "Expected a JSON body");
  }
  const declared = Number(req.headers["content-length"] ?? 0);
  if (declared > MAX_BODY_BYTES) {
    throw new RoomError(413, "Request too large");
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw new RoomError(413, "Request too large");
    }
    chunks.push(chunk);
  }
  let body: unknown;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new RoomError(400, "Invalid JSON");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new RoomError(400, "Expected a JSON object");
  }
  return body as Record<string, unknown>;
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}
