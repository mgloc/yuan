import "./button.css";

export function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

export function card(title: string): { root: HTMLElement; body: HTMLElement } {
  const root = element("section", "player-card");
  const body = element("div", "player-card__body");
  root.append(element("h3", "player-card__title", title), body);
  return { root, body };
}
