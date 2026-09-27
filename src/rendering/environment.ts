import * as THREE from "three";
import { EXRLoader } from "three/addons/loaders/EXRLoader.js";
import { GroundedSkybox } from "three/addons/objects/GroundedSkybox.js";

const URL = `${import.meta.env.BASE_URL}environment/background.exr`;
export const SKY_ROTATION = new THREE.Euler(Math.PI / 2, 0, 0);
const ROTATION = SKY_ROTATION;
const INTENSITY = 0.55;
const CAPTURE_HEIGHT = 70;
const SKY_RADIUS = 1200;
const BLUR_PASSES = 2;
const BLUR_REFERENCE_WIDTH = 1024;
const NADIR_BLUR_LIMIT = Math.PI / 4;

export class Environment {
  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;
  private lighting: THREE.WebGLRenderTarget | null = null;
  private backdrop: THREE.Texture | null = null;
  private skybox: GroundedSkybox | null = null;
  private groundZ: number | null = null;
  private disposed = false;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
    this.renderer = renderer;
    this.scene = scene;
    this.load();
  }

  static readonly radius = SKY_RADIUS;

  setGround(z: number) {
    this.groundZ = z;
    this.buildSkybox();
  }

  dispose() {
    this.disposed = true;
    this.removeSkybox();
    this.lighting?.dispose();
  }

  private async load() {
    try {
      const { source, backdrop } = await loadSky();
      if (this.disposed) {
        return;
      }
      const generator = new THREE.PMREMGenerator(this.renderer);
      this.lighting = generator.fromEquirectangular(source);
      generator.dispose();
      this.backdrop = backdrop;

      this.scene.environment = this.lighting.texture;
      this.scene.environmentIntensity = INTENSITY;
      this.scene.environmentRotation.copy(ROTATION);
      this.scene.background = this.backdrop;
      this.scene.backgroundRotation.copy(ROTATION);
      this.buildSkybox();
    } catch (error) {
      console.warn("Could not load the environment map", error);
    }
  }

  private buildSkybox() {
    if (this.backdrop === null || this.groundZ === null || this.disposed) {
      return;
    }
    this.removeSkybox();
    this.skybox = new GroundedSkybox(this.backdrop, CAPTURE_HEIGHT, SKY_RADIUS);
    this.skybox.rotation.x = Math.PI / 2;
    this.skybox.position.z = this.groundZ + CAPTURE_HEIGHT;
    this.skybox.renderOrder = -2;
    this.scene.add(this.skybox);
  }

  private removeSkybox() {
    if (this.skybox === null) {
      return;
    }
    this.scene.remove(this.skybox);
    this.skybox.geometry.dispose();
    (this.skybox.material as THREE.Material).dispose();
    this.skybox = null;
  }
}

export interface Sky {
  source: THREE.DataTexture;
  backdrop: THREE.DataTexture;
}

let sky: Promise<Sky> | null = null;

export function loadSky(): Promise<Sky> {
  sky ??= new EXRLoader()
    .setDataType(THREE.FloatType)
    .loadAsync(URL)
    .then((source) => {
      source.mapping = THREE.EquirectangularReflectionMapping;
      return { source, backdrop: blurred(source) };
    });
  sky.catch(() => (sky = null));
  return sky;
}

function blurred(source: THREE.DataTexture): THREE.DataTexture {
  const { width, height } = source.image;
  const input = source.image.data as Float32Array;
  const channels = input.length / (width * height);
  const radius = Math.max(1, Math.round(width / BLUR_REFERENCE_WIDTH));

  let front = new Float32Array(width * height * 4);
  let back = new Float32Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    for (let c = 0; c < 4; c++) {
      front[i * 4 + c] = c < channels ? input[i * channels + c] : 1;
    }
  }
  const run = (blur: (from: Float32Array, to: Float32Array) => void) => {
    blur(front, back);
    [front, back] = [back, front];
  };
  for (let pass = 0; pass < BLUR_PASSES; pass++) {
    run((from, to) => boxBlur(from, to, width, height, radius, true));
    run((from, to) => boxBlur(from, to, width, height, radius, false));
  }
  for (let pass = 0; pass < BLUR_PASSES; pass++) {
    run((from, to) => nadirBlur(from, to, width, height, radius, source.flipY));
  }

  const half = new Uint16Array(front.length);
  for (let i = 0; i < front.length; i++) {
    half[i] = THREE.DataUtils.toHalfFloat(front[i]);
  }

  const texture = new THREE.DataTexture(half, width, height, THREE.RGBAFormat, THREE.HalfFloatType);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.LinearSRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.flipY = source.flipY;
  texture.needsUpdate = true;
  return texture;
}

function nadirBlur(input: Float32Array, output: Float32Array, width: number, height: number, radius: number, flipped: boolean) {
  output.set(input);
  for (let y = 0; y < height; y++) {
    const fromNadir = (((flipped ? height - 1 - y : y) + 0.5) / height) * Math.PI;
    if (fromNadir >= NADIR_BLUR_LIMIT) {
      continue;
    }
    const stretch = 2 / Math.max(Math.sin(2 * fromNadir), 1e-3);
    const reach = Math.min(Math.floor(width / 2), Math.round(radius * stretch));
    if (reach <= radius) {
      continue;
    }
    const span = reach * 2 + 1;
    const row = y * width;
    for (let c = 0; c < 4; c++) {
      let sum = 0;
      for (let k = -reach; k <= reach; k++) {
        sum += input[(row + ((k % width) + width) % width) * 4 + c];
      }
      for (let x = 0; x < width; x++) {
        output[(row + x) * 4 + c] = sum / span;
        sum += input[(row + ((x + reach + 1) % width)) * 4 + c] - input[(row + (((x - reach) % width) + width) % width) * 4 + c];
      }
    }
  }
}

function boxBlur(input: Float32Array, output: Float32Array, width: number, height: number, radius: number, horizontal: boolean) {
  const span = radius * 2 + 1;
  const lines = horizontal ? height : width;
  const length = horizontal ? width : height;
  const index = (line: number, position: number) =>
    horizontal ? line * width + ((position % width) + width) % width : Math.min(height - 1, Math.max(0, position)) * width + line;
  for (let line = 0; line < lines; line++) {
    for (let c = 0; c < 4; c++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) {
        sum += input[index(line, k) * 4 + c];
      }
      for (let position = 0; position < length; position++) {
        output[index(line, position) * 4 + c] = sum / span;
        sum += input[index(line, position + radius + 1) * 4 + c] - input[index(line, position - radius) * 4 + c];
      }
    }
  }
}
