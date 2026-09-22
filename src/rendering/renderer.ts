import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export class Renderer {
  height: number;
  width: number;
  camera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls | null = null;
  container: HTMLElement;

  constructor(width: number, height: number, container: HTMLElement) {
    this.width = width;
    this.height = height;
    this.container = container;

    this.camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 100);
    this.camera.position.set(0, -14, 14);
    this.camera.lookAt(0, 0, 0);

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
      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.controls.target.set(0, 0, 0);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.1;
      this.controls.update();
    }
  }

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  render() {
    this.controls?.update();
    this.renderer.render(this.scene, this.camera);
  }
}
