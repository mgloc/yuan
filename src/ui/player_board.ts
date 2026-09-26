import "./player_board.css";
import { ClanCard } from "./clan_card.ts";
import { element } from "./dom.ts";
import { PlanCard, type PlanCardHandlers } from "./plan_card.ts";
import type { PlayerBoardData } from "./player_board_data.ts";
import { ResourcesCard } from "./resources_card.ts";
import { TargetCard, type TargetCardHandlers } from "./target_card.ts";

export type PlayerBoardHandlers = TargetCardHandlers & PlanCardHandlers;

export class PlayerBoard {
  root: HTMLElement;
  private resources = new ResourcesCard();
  private clan = new ClanCard();
  private target: TargetCard;
  private plan: PlanCard;

  constructor(container: HTMLElement, handlers: PlayerBoardHandlers) {
    this.root = element("footer", "player-board");
    this.target = new TargetCard(handlers);
    this.plan = new PlanCard(handlers);
    this.root.append(this.resources.root, this.clan.root, this.target.root, this.plan.root);
    container.appendChild(this.root);
  }

  update(data: PlayerBoardData) {
    this.root.style.setProperty("--clan-color", data.clan.color);
    this.resources.update(data);
    this.clan.update(data);
    this.target.update(data);
    this.plan.update(data);
  }

  dispose() {
    this.root.remove();
  }
}
