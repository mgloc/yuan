import { element } from "./dom.ts";
import type { PlayerBoardData } from "./player_board_data.ts";

const TILE_LABELS: Record<string, string> = {
  RiceField: "Rice fields",
  Forest: "Forests",
  Mine: "Mines",
};

export class ResourcesCard {
  root: HTMLElement;
  private list: HTMLElement;

  constructor(container: HTMLElement) {
    this.root = element("aside", "resources-box");
    this.list = element("dl", "resource-list");
    this.root.append(this.list);
    container.appendChild(this.root);
  }

  dispose() {
    this.root.remove();
  }

  update(data: PlayerBoardData) {
    const temples = data.temples;
    this.list.replaceChildren(
      ...data.resources.flatMap((entry) =>
        row(entry.tile, TILE_LABELS[entry.tile] ?? entry.tile, String(entry.count), `−${entry.count}₵ ${entry.discounts}`),
      ),
      ...row("Temple", "Temples", `${temples.count} / ${temples.target}`, "to win this turn"),
      ...row("Chao", "Chão", `${data.chao}₵`, ""),
    );
  }
}

function row(swatch: string, label: string, value: string, hint: string): HTMLElement[] {
  const term = element("dt", "resource-list__label");
  term.append(element("span", `swatch swatch--${swatch}`), label);
  const definition = element("dd", "resource-list__value", value);
  const note = element("dd", "resource-list__hint", hint);
  return [term, definition, note];
}
