import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const BACKGROUND_COLOR = 0xece8df;
const FRAME_TILT = THREE.MathUtils.degToRad(38);
const FRAME_FILL = 0.94;

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
  controls: OrbitControls | null = null;
  container: HTMLElement;

  constructor(width: number, height: number, container: HTMLElement) {
    this.width = width;
    this.height = height;
    this.container = container;

    this.camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 100);
    this.camera.up.set(0, 0, 1);
    this.camera.position.set(10, 10, 10);
    this.camera.lookAt(0, 0, 0);
    this.activeCamera = this.camera;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(BACKGROUND_COLOR);
    this.scene.add(new THREE.HemisphereLight(0xfffaf0, 0x8a7a55, 2.2));
    this.sun = new THREE.DirectionalLight(0xfff4e4, 2.0);
    this.sun.position.set(6, -4, 10);
    this.scene.add(this.sun);
    this.scene.fog = new THREE.Fog(BACKGROUND_COLOR, 30, 120);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.container.appendChild(this.renderer.domElement);

    this.initDebug();
  }

  private initDebug() {
    if (import.meta.env.DEV) {
      this.debugCamera = new THREE.PerspectiveCamera(70, this.width / this.height, 0.1, 500);
      this.debugCamera.up.set(0, 0, 1);
      this.debugCamera.position.set(30, -30, 30);
      this.debugCamera.lookAt(0, 0, 0);

      this.cameraHelper = new THREE.CameraHelper(this.camera);
      this.cameraHelper.visible = false;
      this.scene.add(this.cameraHelper);

      this.controls = new OrbitControls(this.debugCamera, this.renderer.domElement);
      this.controls.target.set(0, 0, 0);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.1;
      this.controls.update();

      const axesHelper = new THREE.AxesHelper(10);
      this.scene.add(axesHelper);

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
    if (this.cameraHelper) {
      this.cameraHelper.visible = this.activeCamera !== this.camera;
    }
  }

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    for (const camera of [this.camera, this.debugCamera]) {
      if (camera) {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
    }
    this.renderer.setSize(width, height);
  }

  frame(box: THREE.Box3, insets: { top: number; bottom: number }) {
    const center = box.getCenter(new THREE.Vector3());
    const direction = new THREE.Vector3(0, -Math.sin(FRAME_TILT), Math.cos(FRAME_TILT));
    const available = { width: this.width * FRAME_FILL, height: Math.max(1, this.height - insets.top - insets.bottom) * FRAME_FILL };
    this.camera.clearViewOffset();

    let near = 1;
    let far = 500;
    for (let i = 0; i < 30; i++) {
      const distance = (near + far) / 2;
      const bounds = this.projectedBounds(box, center, direction, distance);
      if (bounds.max.x - bounds.min.x <= available.width && bounds.max.y - bounds.min.y <= available.height) {
        far = distance;
      } else {
        near = distance;
      }
    }

    const bounds = this.projectedBounds(box, center, direction, far);
    const offsetX = (bounds.min.x + bounds.max.x) / 2 - this.width / 2;
    const offsetY = (bounds.min.y + bounds.max.y) / 2 - (insets.top + (this.height - insets.top - insets.bottom) / 2);
    this.camera.setViewOffset(this.width, this.height, offsetX, offsetY, this.width, this.height);
  }

  private projectedBounds(box: THREE.Box3, center: THREE.Vector3, direction: THREE.Vector3, distance: number): THREE.Box2 {
    this.camera.position.copy(center).addScaledVector(direction, distance);
    this.camera.lookAt(center);
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
    window.removeEventListener("keydown", this.onKeyDown);
    this.controls?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  render() {
    this.controls?.update();
    this.cameraHelper?.update();
    this.renderer.render(this.scene, this.activeCamera);
  }
}
