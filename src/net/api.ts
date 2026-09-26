import type { CreateRequest, ErrorResponse, JoinRequest, RoomAction, Session } from "../protocol.ts";

const BASE = "/api/games";

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as T | ErrorResponse;
  if (!response.ok) {
    throw new Error((data as ErrorResponse).error ?? `Request failed (${response.status})`);
  }
  return data as T;
}

export function createRoom(request: CreateRequest): Promise<Session> {
  return post("", request);
}

export function joinRoom(code: string, request: JoinRequest): Promise<Session> {
  return post(`/${encodeURIComponent(code)}/join`, request);
}

export function roomAction(code: string, action: RoomAction, body: object): Promise<unknown> {
  return post(`/${encodeURIComponent(code)}/${action}`, body);
}

export function eventsUrl(session: Session, as: number | undefined): string {
  const query = new URLSearchParams({ token: session.token });
  if (as !== undefined) {
    query.set("as", String(as));
  }
  return `${BASE}/${encodeURIComponent(session.code)}/events?${query}`;
}
