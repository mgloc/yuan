import "./info_panel.css";
import { element } from "./dom.ts";

const OPEN_KEY = "yuan:info-open";

export interface PanelContent {
  title: string;
  rows: [label: string, value: string][];
  note?: string;
}

export class InfoPanel {
  root: HTMLElement;
  private header: HTMLButtonElement;
  private title: HTMLElement;
  private rows: HTMLElement;
  private note: HTMLElement;
  private open = readOpen();

  constructor(container: HTMLElement) {
    this.root = element("aside", "info-panel");
    this.root.hidden = true;
    this.header = element("button", "info-panel__header");
    this.title = element("h2", "info-panel__title");
    this.header.append(this.title, element("span", "info-panel__chevron"));
    this.header.addEventListener("click", () => this.setOpen(!this.open));
    this.rows = element("dl", "info-panel__rows");
    this.note = element("p", "info-panel__note");
    this.root.append(this.header, this.rows, this.note);
    container.appendChild(this.root);
    this.render();
  }

  show(content: PanelContent) {
    this.title.textContent = content.title;
    this.rows.replaceChildren(
      ...content.rows.flatMap(([label, value]) => [element("dt", "info-panel__label", label), element("dd", "info-panel__value", value)]),
    );
    this.note.textContent = content.note ?? "";
    this.note.hidden = content.note === undefined;
    this.root.hidden = false;
  }

  hide() {
    this.root.hidden = true;
  }

  dispose() {
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
    this.root.classList.toggle("info-panel--open", this.open);
    this.header.setAttribute("aria-expanded", String(this.open));
  }
}

function readOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) !== "0";
  } catch {
    return true;
  }
}
