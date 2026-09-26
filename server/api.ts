import { randomBytes, randomInt } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { PlayerId } from "../src/game_types.ts";
import { RoomAction, type Credentials, type ErrorResponse, type Session } from "../src/protocol.ts";
import { parsePlan, Room, RoomError } from "./room.ts";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 5;
const MAX_BODY_BYTES = 64 * 1024;
const KEEP_ALIVE_MS = 25_000;

type Next = () => void;

export function createApi() {
  const rooms = new Map<string, Room>();

  const newCode = (): string => {
    for (;;) {
      const code = Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
      if (!rooms.has(code)) {
        return code;
      }
    }
  };

  const roomOf = (code: string): Room => {
    const room = rooms.get(code.toUpperCase());
    if (room === undefined) {
      throw new RoomError(404, "No game with this code");
    }
    return room;
  };

  const routes = async (req: IncomingMessage, res: ServerResponse, path: string[], query: URLSearchParams) => {
    if (req.method === "POST" && path.length === 0) {
      const body = await readBody(req);
      const room = new Room(newCode(), body.debug === true, () => randomBytes(18).toString("base64url"));
      rooms.set(room.code, room);
      const member = room.join(String(body.name ?? ""));
      return send(res, 201, { code: room.code, player: member.id, token: member.token } satisfies Session);
    }

    const [code, action] = path;
    const room = roomOf(code);

    if (req.method === "GET" && action === "events") {
      return stream(req, res, room, query.get("token") ?? "", seatParam(query.get("as")));
    }
    if (req.method !== "POST") {
      throw new RoomError(405, "Method not allowed");
    }

    const body = await readBody(req);
    if (action === "join") {
      const member = room.join(String(body.name ?? ""));
      return send(res, 201, { code: room.code, player: member.id, token: member.token } satisfies Session);
    }

    const { token, as } = credentials(body);
    switch (action) {
      case RoomAction.Options:
        room.setOptions(token, (body.options ?? {}) as Record<string, unknown>);
        break;
      case RoomAction.Start:
        room.start(token);
        break;
      case RoomAction.Plan: {
        const plan = parsePlan(body.plan);
        if (plan === null) {
          throw new RoomError(400, "Invalid plan");
        }
        room.submit(token, as, plan);
        break;
      }
      case RoomAction.Edit:
        room.edit(token, as);
        break;
      case RoomAction.AddPlayer:
        room.addPlayer(token);
        break;
      case RoomAction.Restart:
        room.restart(token);
        break;
      case RoomAction.Lobby:
        room.backToLobby(token);
        break;
      default:
        throw new RoomError(404, "Unknown action");
    }
    send(res, 200, {});
  };

  return (req: IncomingMessage, res: ServerResponse, next: Next) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments[0] !== "api" || segments[1] !== "games") {
      return next();
    }
    routes(req, res, segments.slice(2), url.searchParams).catch((error: unknown) => {
      const status = error instanceof RoomError ? error.status : 500;
      const message = error instanceof Error ? error.message : "Server error";
      if (!res.headersSent) {
        send(res, status, { error: message } satisfies ErrorResponse);
      }
    });
  };
}

function stream(req: IncomingMessage, res: ServerResponse, room: Room, token: string, as: PlayerId | undefined) {
  const player = room.actor(token, as);
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  const push = () => res.write(`data: ${JSON.stringify(room.view(player))}\n\n`);
  push();
  const unsubscribe = room.onChange(push);
  const keepAlive = setInterval(() => res.write(": keep-alive\n\n"), KEEP_ALIVE_MS);
  req.on("close", () => {
    unsubscribe();
    clearInterval(keepAlive);
  });
}

function seatParam(value: string | null): PlayerId | undefined {
  const seat = Number(value);
  return value !== null && Number.isInteger(seat) ? seat : undefined;
}

function credentials(body: Record<string, unknown>): Credentials {
  if (typeof body.token !== "string") {
    throw new RoomError(401, "Missing token");
  }
  return { token: body.token, as: Number.isInteger(body.as) ? (body.as as number) : undefined };
}

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw new RoomError(413, "Request too large");
    }
    chunks.push(chunk);
  }
  if (chunks.length === 0) {
    return {};
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    return typeof body === "object" && body !== null ? body : {};
  } catch {
    throw new RoomError(400, "Invalid JSON");
  }
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}
