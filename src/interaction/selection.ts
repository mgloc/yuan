import type { Coord } from "../game_types.ts";

type SelectionListener = (coord: Coord | null) => void;

export class Selection {
  private current: Coord | null = null;
  private listeners = new Set<SelectionListener>();

  get(): Coord | null {
    return this.current;
  }

  set(coord: Coord | null) {
    if (this.current?.col === coord?.col && this.current?.row === coord?.row) {
      return;
    }
    this.current = coord;
    this.listeners.forEach((listener) => listener(coord));
  }

  toggle(coord: Coord | null) {
    const same = this.current !== null && coord !== null && this.current.col === coord.col && this.current.row === coord.row;
    this.set(same ? null : coord);
  }

  onChange(listener: SelectionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
