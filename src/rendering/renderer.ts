import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export class Renderer {
  height: number;
  width: number;
  camera: THREE.PerspectiveCamera;
  debugCamera: THREE.PerspectiveCamera | null = null;
  cameraHelper: THREE.CameraHelper | null = null;
  activeCamera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
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
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    this.scene.fog = new THREE.Fog(0xffffff, 10, 100);

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

      window.addEventListener("keydown", (e) => {
        if (e.key === "c") {
          this.toggleDebugCamera();
        }
      });
    }
  }

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

  render() {
    this.controls?.update();
    this.cameraHelper?.update();
    this.renderer.render(this.scene, this.activeCamera);
  }
}
