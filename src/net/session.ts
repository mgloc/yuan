import type { Session } from "../protocol.ts";

const SESSION_KEY = (code: string) => `yuan:session:${code}`;
const NAME_KEY = "yuan:name";

export function loadSession(code: string): Session | null {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY(code));
    return stored === null ? null : (JSON.parse(stored) as Session);
  } catch {
    return null;
  }
}

export function saveSession(session: Session) {
  try {
    sessionStorage.setItem(SESSION_KEY(session.code), JSON.stringify(session));
  } catch {}
}

export function forgetSession(code: string) {
  try {
    sessionStorage.removeItem(SESSION_KEY(code));
  } catch {}
}

export function loadName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {}
}
