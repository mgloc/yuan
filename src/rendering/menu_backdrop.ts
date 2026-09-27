import * as THREE from "three";
import { loadSky, SKY_ROTATION } from "./environment.ts";

const SPIN_SPEED = 0.025;
const TILT = 0.12;
const FIELD_OF_VIEW = 60;
const MAX_PIXEL_RATIO = 1;

export class MenuBackdrop {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(FIELD_OF_VIEW, 1, 0.1, 10);
  private target = new THREE.Vector3();
  private frame = 0;
  private angle = 0;
  private last = 0;
  private running = false;
  private still = window.matchMedia("(prefers-reduced-motion: reduce)");

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: "low-power" });
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.setClearColor(0x000000, 0);
    this.canvas = this.renderer.domElement;
    this.canvas.className = "menu-backdrop";
    this.canvas.setAttribute("aria-hidden", "true");
    container.prepend(this.canvas);
    this.camera.up.set(0, 0, 1);
    this.scene.backgroundRotation.copy(SKY_ROTATION);
    this.resize();
    window.addEventListener("resize", this.resize);
    loadSky().then(
      ({ backdrop }) => {
        this.scene.background = backdrop;
        this.canvas.classList.add("menu-backdrop--ready");
      },
      (error: unknown) => console.warn("Could not load the menu backdrop", error),
    );
  }

  show() {
    this.canvas.style.display = "block";
    if (!this.running) {
      this.running = true;
      this.last = performance.now();
      this.frame = requestAnimationFrame(this.loop);
    }
  }

  hide() {
    this.canvas.style.display = "none";
    this.running = false;
    cancelAnimationFrame(this.frame);
  }

  private loop = (now: number) => {
    if (!this.running) {
      return;
    }
    this.frame = requestAnimationFrame(this.loop);
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (!this.still.matches) {
      this.angle += dt * SPIN_SPEED;
    }
    this.target.set(Math.cos(this.angle), Math.sin(this.angle), TILT);
    this.camera.lookAt(this.target);
    this.renderer.render(this.scene, this.camera);
  };

  private resize = () => {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  };
}
