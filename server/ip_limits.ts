import type { IncomingMessage } from "node:http";

export interface IpLimitOptions {
  creations: number;
  windowMs: number;
  streams: number;
}

export class IpLimits {
  private options: IpLimitOptions;
  private now: () => number;
  private windows = new Map<string, { count: number; resetAt: number }>();
  private open = new Map<string, number>();

  constructor(options: IpLimitOptions, now: () => number = Date.now) {
    this.options = options;
    this.now = now;
  }

  allowCreation(ip: string): boolean {
    const now = this.now();
    const window = this.windows.get(ip);
    if (window === undefined || window.resetAt <= now) {
      this.windows.set(ip, { count: 1, resetAt: now + this.options.windowMs });
      return true;
    }
    if (window.count >= this.options.creations) {
      return false;
    }
    window.count++;
    return true;
  }

  openStream(ip: string): (() => void) | null {
    const count = this.open.get(ip) ?? 0;
    if (count >= this.options.streams) {
      return null;
    }
    this.open.set(ip, count + 1);
    let released = false;
    return () => {
      if (released) {
        return;
      }
      released = true;
      const remaining = (this.open.get(ip) ?? 1) - 1;
      if (remaining === 0) {
        this.open.delete(ip);
      } else {
        this.open.set(ip, remaining);
      }
    };
  }

  prune() {
    const now = this.now();
    for (const [ip, { resetAt }] of this.windows) {
      if (resetAt <= now) {
        this.windows.delete(ip);
      }
    }
  }
}

export function clientIp(req: IncomingMessage, trustProxy: boolean): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (trustProxy && typeof forwarded === "string") {
    const last = forwarded.split(",").at(-1)?.trim();
    if (last) {
      return last;
    }
  }
  return req.socket.remoteAddress ?? "";
}
