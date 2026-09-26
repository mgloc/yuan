import { element } from "./dom.ts";

const TOAST_MS = 4000;

export class Toast {
  private root: HTMLElement;
  private timer = 0;

  constructor(container: HTMLElement) {
    this.root = element("div", "toast");
    this.root.hidden = true;
    this.root.setAttribute("role", "alert");
    container.appendChild(this.root);
  }

  show(message: string) {
    this.root.textContent = message;
    this.root.hidden = false;
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => (this.root.hidden = true), TOAST_MS);
  }
}
