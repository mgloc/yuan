import "./info_panel.css";

export interface PanelContent {
  title: string;
  rows: [label: string, value: string][];
}

export class InfoPanel {
  root: HTMLElement;
  private title: HTMLElement;
  private rows: HTMLElement;

  constructor(container: HTMLElement) {
    this.root = document.createElement("aside");
    this.root.className = "info-panel";
    this.root.hidden = true;

    this.title = document.createElement("h2");
    this.title.className = "info-panel__title";

    this.rows = document.createElement("dl");
    this.rows.className = "info-panel__rows";

    this.root.append(this.title, this.rows);
    container.appendChild(this.root);
  }

  show(content: PanelContent) {
    this.title.textContent = content.title;
    this.rows.replaceChildren(
      ...content.rows.flatMap(([label, value]) => {
        const term = document.createElement("dt");
        term.className = "info-panel__label";
        term.textContent = label;
        const definition = document.createElement("dd");
        definition.className = "info-panel__value";
        definition.textContent = value;
        return [term, definition];
      }),
    );
    this.root.hidden = false;
  }

  hide() {
    this.root.hidden = true;
  }

  dispose() {
    this.root.remove();
  }
}
