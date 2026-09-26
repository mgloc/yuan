import "./player_board.css";
import { ClanPanel } from "./clan_panel.ts";
import { element } from "./dom.ts";
import { PlanCard, type PlanCardHandlers } from "./plan_card.ts";
import type { PlayerBoardData } from "./player_board_data.ts";
import { ResourcesCard } from "./resources_card.ts";
import { TargetCard, type TargetCardHandlers } from "./target_card.ts";

const OPEN_KEY = "yuan:board-open";

export type PlayerBoardHandlers = TargetCardHandlers & PlanCardHandlers;

export class PlayerBoard {
  root: HTMLElement;
  private handle: HTMLButtonElement;
  private summary: HTMLElement;
  private resources = new ResourcesCard();
  private clan: ClanPanel;
  private target: TargetCard;
  private plan: PlanCard;
  private open = readOpen();

  constructor(container: HTMLElement, side: HTMLElement, handlers: PlayerBoardHandlers) {
    this.clan = new ClanPanel(side);
    this.root = element("footer", "player-board");
    this.handle = element("button", "player-board__handle");
    this.handle.setAttribute("aria-label", "Toggle the plan board (B)");
    this.handle.title = "Plan board (B)";
    this.summary = element("span", "player-board__summary");
    this.handle.append(element("span", "player-board__chevron"), element("span", "player-board__label", "Plan"), this.summary);
    this.handle.addEventListener("click", () => this.setOpen(!this.open));

    const cards = element("div", "player-board__cards");
    this.target = new TargetCard(handlers);
    this.plan = new PlanCard(handlers);
    this.resources.root.classList.add("player-card--resources");
    this.target.root.classList.add("player-card--target");
    this.plan.root.classList.add("player-card--plan");
    cards.append(this.resources.root, this.target.root, this.plan.root);
    const drawer = element("div", "player-board__drawer");
    drawer.append(cards);
    this.root.append(this.handle, drawer);
    container.appendChild(this.root);
    window.addEventListener("keydown", this.onKeyDown);
    this.render();
  }

  update(data: PlayerBoardData) {
    this.root.style.setProperty("--clan-color", data.clan.color);
    this.summary.textContent = summaryText(data);
    this.resources.update(data);
    this.clan.update(data);
    this.target.update(data);
    this.plan.update(data);
  }

  dispose() {
    window.removeEventListener("keydown", this.onKeyDown);
    this.clan.dispose();
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
    this.root.classList.toggle("player-board--open", this.open);
    this.handle.setAttribute("aria-expanded", String(this.open));
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "b" && !(event.target instanceof HTMLInputElement)) {
      this.setOpen(!this.open);
    }
  };
}

function summaryText({ plan, chao, finished }: PlayerBoardData): string {
  if (finished) {
    return "Game over";
  }
  if (plan.submitted) {
    return "Submitted ✓";
  }
  return plan.passing ? `Passing · ${chao}₵` : `${plan.total}₵ / ${chao}₵`;
}

function readOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) !== "0";
  } catch {
    return true;
  }
}
