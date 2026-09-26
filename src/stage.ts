import * as THREE from "three";
import { Timer } from "./core/timer.ts";
import { CameraRig } from "./rendering/camera_rig.ts";
import { TILE_RADIUS } from "./rendering/hex_layout.ts";
import { Renderer } from "./rendering/renderer.ts";
import { TableView } from "./rendering/views/table_view.ts";
import "./ui/hud.css";

const HUD_GAP = 8;

export class Stage {
  renderer: Renderer;
  rig: CameraRig;
  board = new THREE.Group();
  private container: HTMLElement;
  private table: TableView | null = null;
  private bounds = new THREE.Box3(new THREE.Vector3(-1, -1, 0), new THREE.Vector3(1, 1, 0));
  private top: HTMLElement | null = null;
  private bottom: HTMLElement | null = null;
  private observer = new ResizeObserver(() => this.layout(false));
  private updates: ((dt: number) => void)[] = [];
  private frame = 0;

  constructor(container: HTMLElement) {
    this.container = container;
    this.renderer = new Renderer(window.innerWidth, window.innerHeight, container);
    this.rig = new CameraRig(this.renderer);
    this.renderer.scene.add(this.board);
    window.addEventListener("resize", this.onResize);

    const timer = new Timer();
    const loop = () => {
      this.frame = requestAnimationFrame(loop);
      const dt = timer.tick();
      this.rig.update(dt);
      this.updates.forEach((update) => update(dt));
      this.renderer.render();
    };
    loop();
  }

  setHud(top: HTMLElement, bottom: HTMLElement) {
    this.observer.disconnect();
    this.top = top;
    this.bottom = bottom;
    this.observer.observe(top);
    this.observer.observe(bottom);
    this.layout(false);
  }

  setTable(area: THREE.Box3, frame = true) {
    this.table?.dispose(this.renderer.scene);
    this.table = new TableView(this.renderer.scene, area);
    this.renderer.environment.setGround(this.table.floorZ);
    this.bounds = area.clone();
    this.layout(frame);
  }

  setFootprint(tiles: THREE.Vector3[]) {
    this.table?.setFootprint(tiles, TILE_RADIUS);
  }

  onFrame(update: (dt: number) => void) {
    this.updates.push(update);
  }

  dispose() {
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    window.removeEventListener("resize", this.onResize);
    this.container.style.removeProperty("--hud-top");
    this.container.style.removeProperty("--hud-bottom");
    this.table?.dispose(this.renderer.scene);
    this.rig.dispose();
    this.renderer.dispose();
  }

  private layout(apply: boolean) {
    const top = (this.top?.getBoundingClientRect().bottom ?? 0) + HUD_GAP;
    const bottom = this.bottom === null ? 0 : window.innerHeight - this.bottom.getBoundingClientRect().top;
    this.container.style.setProperty("--hud-top", `${top}px`);
    this.container.style.setProperty("--hud-bottom", `${bottom}px`);
    this.renderer.setInsets({ top, bottom });
    this.rig.frame(this.bounds, apply);
  }

  private onResize = () => {
    this.renderer.resize(window.innerWidth, window.innerHeight);
    this.layout(false);
  };
}
