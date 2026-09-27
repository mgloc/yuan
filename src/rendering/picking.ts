import * as THREE from "three";
import type { Coord } from "../game_types.ts";
import type { Renderer } from "./renderer.ts";

const CLICK_MAX_DISTANCE_PX = 5;
const LEFT_BUTTON = 0;

type PickListener = (coord: Coord | null) => void;

export class TilePicker {
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private downPosition: { x: number; y: number } | null = null;
  private listeners = new Set<PickListener>();
  private doubleListeners = new Set<PickListener>();
  private renderer: Renderer;
  private target: THREE.Object3D;

  constructor(renderer: Renderer, target: THREE.Object3D) {
    this.renderer = renderer;
    this.target = target;
    const canvas = renderer.renderer.domElement;
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("dblclick", this.onDoubleClick);
  }

  onDoublePick(listener: PickListener): () => void {
    this.doubleListeners.add(listener);
    return () => this.doubleListeners.delete(listener);
  }

  onPick(listener: PickListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose() {
    const canvas = this.renderer.renderer.domElement;
    canvas.removeEventListener("pointerdown", this.onPointerDown);
    canvas.removeEventListener("pointerup", this.onPointerUp);
    canvas.removeEventListener("dblclick", this.onDoubleClick);
    this.listeners.clear();
    this.doubleListeners.clear();
  }

  private onPointerDown = (event: PointerEvent) => {
    this.downPosition = { x: event.clientX, y: event.clientY };
  };

  private onPointerUp = (event: PointerEvent) => {
    if (this.downPosition === null || event.button !== LEFT_BUTTON) {
      return;
    }
    const distance = Math.hypot(event.clientX - this.downPosition.x, event.clientY - this.downPosition.y);
    this.downPosition = null;
    if (distance > CLICK_MAX_DISTANCE_PX) {
      return;
    }
    const coord = this.pick(event);
    this.listeners.forEach((listener) => listener(coord));
  };

  private onDoubleClick = (event: MouseEvent) => {
    const coord = this.pick(event);
    this.doubleListeners.forEach((listener) => listener(coord));
  };

  private pick(event: MouseEvent): Coord | null {
    const rect = this.renderer.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.renderer.activeCamera);
    for (const hit of this.raycaster.intersectObject(this.target, true)) {
      const coord = coordOf(hit.object);
      if (coord !== null) {
        return coord;
      }
    }
    return null;
  }
}

function coordOf(object: THREE.Object3D | null): Coord | null {
  for (let current = object; current !== null; current = current.parent) {
    if (current.userData.coord) {
      return current.userData.coord as Coord;
    }
  }
  return null;
}
