import * as THREE from "three";
import type { Coord } from "../game_types.ts";
import { worldToHex } from "./hex_layout.ts";
import type { Renderer } from "./renderer.ts";

const CLICK_MAX_DISTANCE_PX = 5;
const LEFT_BUTTON = 0;
const RIGHT_BUTTON = 2;

type CoordListener = (coord: Coord | null) => void;

export class PlanePicker {
  private renderer: Renderer;
  private target: () => THREE.Object3D | null;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  private point = new THREE.Vector3();
  private downPosition: { x: number; y: number } | null = null;
  private hoverListeners = new Set<CoordListener>();
  private clickListeners = new Set<CoordListener>();
  private rightClickListeners = new Set<CoordListener>();
  private hovered: Coord | null = null;

  constructor(renderer: Renderer, target: () => THREE.Object3D | null) {
    this.renderer = renderer;
    this.target = target;
    const canvas = renderer.renderer.domElement;
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerleave", this.onPointerLeave);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointerup", this.onPointerUp);
  }

  onHover(listener: CoordListener): () => void {
    this.hoverListeners.add(listener);
    return () => this.hoverListeners.delete(listener);
  }

  onClick(listener: CoordListener): () => void {
    this.clickListeners.add(listener);
    return () => this.clickListeners.delete(listener);
  }

  onRightClick(listener: CoordListener): () => void {
    this.rightClickListeners.add(listener);
    return () => this.rightClickListeners.delete(listener);
  }

  dispose() {
    const canvas = this.renderer.renderer.domElement;
    canvas.removeEventListener("pointermove", this.onPointerMove);
    canvas.removeEventListener("pointerleave", this.onPointerLeave);
    canvas.removeEventListener("pointerdown", this.onPointerDown);
    canvas.removeEventListener("pointerup", this.onPointerUp);
    this.hoverListeners.clear();
    this.clickListeners.clear();
    this.rightClickListeners.clear();
  }

  private onPointerMove = (event: PointerEvent) => {
    if (event.buttons !== 0) {
      return;
    }
    this.hover(this.pick(event));
  };

  private onPointerLeave = () => this.hover(null);

  private onPointerDown = (event: PointerEvent) => {
    this.downPosition = { x: event.clientX, y: event.clientY };
  };

  private onPointerUp = (event: PointerEvent) => {
    if (this.downPosition === null) {
      return;
    }
    const distance = Math.hypot(event.clientX - this.downPosition.x, event.clientY - this.downPosition.y);
    this.downPosition = null;
    if (distance > CLICK_MAX_DISTANCE_PX) {
      return;
    }
    const listeners = event.button === LEFT_BUTTON ? this.clickListeners : event.button === RIGHT_BUTTON ? this.rightClickListeners : null;
    if (listeners === null) {
      return;
    }
    const coord = this.pick(event);
    this.hover(coord);
    listeners.forEach((listener) => listener(coord));
  };

  private hover(coord: Coord | null) {
    if (coord?.col === this.hovered?.col && coord?.row === this.hovered?.row) {
      return;
    }
    this.hovered = coord;
    this.hoverListeners.forEach((listener) => listener(coord));
  }

  private pick(event: PointerEvent): Coord | null {
    const target = this.target();
    if (target === null) {
      return null;
    }
    const rect = this.renderer.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.renderer.activeCamera);
    this.plane.constant = -target.getWorldPosition(this.point).z;
    if (this.raycaster.ray.intersectPlane(this.plane, this.point) === null) {
      return null;
    }
    const local = target.worldToLocal(this.point);
    return worldToHex(local.x, local.y);
  }
}
