import "./log_panel.css";
import { readableOnDark } from "./color.ts";
import { element } from "./dom.ts";
import type { LogPart } from "./turn_text.ts";

const OPEN_KEY = "yuan:log-open";
const WIDE = "(min-width: 701px)";

export interface TurnLogEntry {
  turn: number;
  lines: LogPart[][];
}

export class LogPanel {
  root: HTMLElement;
  private handle: HTMLButtonElement;
  private badge: HTMLElement;
  private list: HTMLElement;
  private open = readOpen();

  constructor(container: HTMLElement) {
    this.root = element("aside", "log-panel");
    this.handle = element("button", "log-panel__handle");
    this.handle.setAttribute("aria-label", "Toggle the turn log (L)");
    this.handle.title = "Turn log (L)";
    this.badge = element("span", "log-panel__badge");
    this.handle.append(element("span", "log-panel__chevron"), element("span", "log-panel__label", "Log"), this.badge);
    this.handle.addEventListener("click", () => this.setOpen(!this.open));

    const body = element("div", "log-panel__body");
    this.list = element("ol", "log-panel__list");
    body.append(element("h3", "log-panel__title", "Turn log"), this.list);
    this.root.append(this.handle, body);
    container.appendChild(this.root);
    document.body.classList.add("has-log");
    window.addEventListener("keydown", this.onKeyDown);
    this.render();
  }

  setEntries(entries: TurnLogEntry[], colorOf: (player: number) => string, reveal: boolean) {
    this.list.replaceChildren(
      ...(entries.length === 0 ? [element("li", "log-panel__empty", "Nothing has happened yet.")] : []),
      ...entries.map((entry) => this.entry(entry, colorOf)).reverse(),
    );
    this.badge.textContent = entries.length === 0 ? "" : String(entries.length);
    if (reveal && matchMedia(WIDE).matches) {
      this.setOpen(true);
    }
  }

  dispose() {
    window.removeEventListener("keydown", this.onKeyDown);
    document.body.classList.remove("has-log", "log-open");
    this.root.remove();
  }

  private setOpen(open: boolean) {
    this.open = open;
    try {
      localStorage.setItem(OPEN_KEY, open ? "1" : "0");
    } catch {}
    this.render();
  }

  private render() {
    this.root.classList.toggle("log-panel--open", this.open);
    this.handle.setAttribute("aria-expanded", String(this.open));
    document.body.classList.toggle("log-open", this.open);
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "l" && !(event.target instanceof HTMLInputElement)) {
      this.setOpen(!this.open);
    }
  };

  private entry({ turn, lines }: TurnLogEntry, colorOf: (player: number) => string): HTMLElement {
    const entry = element("li", "log-panel__turn");
    const events = element("ul", "log-panel__events");
    events.append(
      ...lines.map((line) => {
        const item = element("li", "");
        item.append(
          ...line.map((part) => {
            if (typeof part === "string") {
              return part;
            }
            const name = element("span", "log-panel__clan", part.text);
            name.style.color = readableOnDark(colorOf(part.player));
            return name;
          }),
        );
        return item;
      }),
    );
    entry.append(element("h4", "log-panel__heading", `Turn ${turn}`), events);
    return entry;
  }
}

function readOpen(): boolean {
  const fallback = matchMedia(WIDE).matches;
  try {
    const stored = localStorage.getItem(OPEN_KEY);
    return stored === null ? fallback : stored === "1";
  } catch {
    return fallback;
  }
}
