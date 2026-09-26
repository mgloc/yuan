import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Environment } from "./environment.ts";

const BACKGROUND_COLOR = 0xece8df;
const MAX_PIXEL_RATIO = 2;
const MAX_DEVICE_PIXELS = 5_000_000;
const MSAA_MAX_PIXEL_RATIO = 1.5;
const HEMISPHERE_INTENSITY = 0.7;
const SUN_INTENSITY = 1.5;
const FRAME_MARGIN = 0.03;
const FIT_ITERATIONS = 4;

export interface ViewInsets {
  top: number;
  bottom: number;
}

export class Renderer {
  height: number;
  width: number;
  camera: THREE.PerspectiveCamera;
  debugCamera: THREE.PerspectiveCamera | null = null;
  cameraHelper: THREE.CameraHelper | null = null;
  activeCamera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
  sun: THREE.DirectionalLight;
  renderer: THREE.WebGLRenderer;
  orbit: OrbitControls;
  debugControls: OrbitControls | null = null;
  container: HTMLElement;
  private insets: ViewInsets = { top: 0, bottom: 0 };
  environment: Environment;

  constructor(width: number, height: number, container: HTMLElement) {
    this.width = width;
    this.height = height;
    this.container = container;

    this.camera = new THREE.PerspectiveCamera(70, width / height, 0.1, Environment.radius * 3);
    this.camera.up.set(0, 0, 1);
    this.camera.position.set(10, 10, 10);
    this.camera.lookAt(0, 0, 0);
    this.activeCamera = this.camera;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(BACKGROUND_COLOR);
    this.scene.add(new THREE.HemisphereLight(0xfffaf0, 0x8a7a55, HEMISPHERE_INTENSITY));
    this.sun = new THREE.DirectionalLight(0xfff4e4, SUN_INTENSITY);
    this.sun.position.set(6, -4, 10);
    this.scene.add(this.sun);

    this.renderer = new THREE.WebGLRenderer({ antialias: pixelRatio(width, height) < MSAA_MAX_PIXEL_RATIO, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(pixelRatio(width, height));
    this.renderer.setSize(width, height);
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.container.appendChild(this.renderer.domElement);
    this.orbit = new OrbitControls(this.camera, this.renderer.domElement);

    this.environment = new Environment(this.renderer, this.scene);
    this.initDebug();
  }

  private initDebug() {
    if (import.meta.env.DEV) {
      this.debugCamera = new THREE.PerspectiveCamera(70, this.width / this.height, 0.1, Environment.radius * 3);
      this.debugCamera.up.set(0, 0, 1);
      this.debugCamera.position.set(30, -30, 30);
      this.debugCamera.lookAt(0, 0, 0);

      this.cameraHelper = new THREE.CameraHelper(this.camera);
      this.cameraHelper.visible = false;
      this.scene.add(this.cameraHelper);

      this.debugControls = new OrbitControls(this.debugCamera, this.renderer.domElement);
      this.debugControls.target.set(0, 0, 0);
      this.debugControls.enableDamping = true;
      this.debugControls.dampingFactor = 0.1;
      this.debugControls.enabled = false;
      this.debugControls.update();

      window.addEventListener("keydown", this.onKeyDown);
    }
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "c") {
      this.toggleDebugCamera();
    }
  };

  toggleDebugCamera() {
    if (!this.debugCamera) {
      return;
    }
    this.activeCamera = this.activeCamera === this.camera ? this.debugCamera : this.camera;
    const debugging = this.activeCamera !== this.camera;
    this.orbit.enabled = !debugging;
    if (this.debugControls) {
      this.debugControls.enabled = debugging;
    }
    if (this.cameraHelper) {
      this.cameraHelper.visible = debugging;
    }
  }

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.renderer.setPixelRatio(pixelRatio(width, height));
    for (const camera of [this.camera, this.debugCamera]) {
      if (camera) {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
    }
    this.renderer.setSize(width, height);
    this.applyViewOffset();
  }

  setInsets(insets: ViewInsets) {
    this.insets = insets;
    this.applyViewOffset();
  }

  fit(box: THREE.Box3, center: THREE.Vector3, direction: THREE.Vector3): { target: THREE.Vector3; distance: number } {
    const saved = this.camera.position.clone();
    const target = center.clone();
    const toward = new THREE.Vector3(direction.x, direction.y, 0).normalize();
    const polar = Math.acos(THREE.MathUtils.clamp(direction.z, -1, 1));
    let distance = this.fitDistance(box, target, direction);
    for (let i = 0; i < FIT_ITERATIONS; i++) {
      const bounds = this.projectedBounds(box, target, direction, distance);
      const imbalance = (bounds.min.y - this.insets.top - (this.height - this.insets.bottom - bounds.max.y)) / 2;
      const unitsPerPixel = (2 * distance * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))) / this.height;
      target.addScaledVector(toward, (imbalance * unitsPerPixel) / Math.max(Math.cos(polar), 0.2));
      distance = this.fitDistance(box, target, direction);
    }
    this.camera.position.copy(saved);
    return { target, distance };
  }

  private fitDistance(box: THREE.Box3, target: THREE.Vector3, direction: THREE.Vector3): number {
    const margin = { x: this.width * FRAME_MARGIN, y: this.height * FRAME_MARGIN };
    let near = 1;
    let far = 500;
    for (let i = 0; i < 30; i++) {
      const distance = (near + far) / 2;
      const bounds = this.projectedBounds(box, target, direction, distance);
      const fits =
        bounds.min.x >= margin.x &&
        bounds.max.x <= this.width - margin.x &&
        bounds.min.y >= this.insets.top + margin.y &&
        bounds.max.y <= this.height - this.insets.bottom - margin.y;
      if (fits) {
        far = distance;
      } else {
        near = distance;
      }
    }
    return far;
  }

  private applyViewOffset() {
    this.camera.setViewOffset(this.width, this.height, 0, (this.insets.bottom - this.insets.top) / 2, this.width, this.height);
  }

  private projectedBounds(box: THREE.Box3, target: THREE.Vector3, direction: THREE.Vector3, distance: number): THREE.Box2 {
    this.camera.position.copy(target).addScaledVector(direction, distance);
    this.camera.lookAt(target);
    this.camera.updateMatrixWorld();
    const bounds = new THREE.Box2();
    const corner = new THREE.Vector3();
    for (let i = 0; i < 8; i++) {
      corner.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(this.camera);
      bounds.expandByPoint(new THREE.Vector2(((corner.x + 1) / 2) * this.width, ((1 - corner.y) / 2) * this.height));
    }
    return bounds;
  }

  dispose() {
    this.environment.dispose();
    window.removeEventListener("keydown", this.onKeyDown);
    this.orbit.dispose();
    this.debugControls?.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }

  render() {
    this.debugControls?.update();
    this.cameraHelper?.update();
    this.renderer.render(this.scene, this.activeCamera);
  }
}

function pixelRatio(width: number, height: number): number {
  const budget = Math.sqrt(MAX_DEVICE_PIXELS / Math.max(1, width * height));
  return Math.max(1, Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO, budget));
}
