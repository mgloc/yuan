import "./hotseat_switcher.css";
import { element } from "./dom.ts";

export interface HotseatSeat {
  id: number;
  label: string;
  color: string;
}

export class HotseatSwitcher {
  root: HTMLElement;
  private buttons = new Map<number, HTMLButtonElement>();

  constructor(container: HTMLElement, seats: HotseatSeat[], onSelect: (id: number) => void) {
    this.root = element("nav", "hotseat");
    this.root.append(element("span", "hotseat__label", "Debug · hotseat (P)"));
    for (const seat of seats) {
      const button = element("button", "hotseat__seat", seat.label);
      button.style.setProperty("--seat-color", seat.color);
      button.addEventListener("click", () => onSelect(seat.id));
      this.buttons.set(seat.id, button);
      this.root.append(button);
    }
    container.appendChild(this.root);
  }

  setActive(id: number) {
    this.buttons.forEach((button, seat) => button.classList.toggle("hotseat__seat--active", seat === id));
  }

  dispose() {
    this.root.remove();
  }
}
