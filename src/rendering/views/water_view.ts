import * as THREE from "three";
import { Water } from "three/addons/objects/Water.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const NORMAL_MAP_SIZE = 256;
const NORMAL_MAP_OCTAVES = [4, 8, 16];
const NORMAL_MAP_STRENGTH = 14;
const WATER_COLOR = 0x35d0dc;
const WATER_ALPHA = 0.8;
const NOISE_SIZE = 8;
const DISTORTION_SCALE = 2.2;
const REFLECTION_SIZE = 512;

export class WaterView {
  root: Water;
  private material: THREE.ShaderMaterial;

  constructor(parent: THREE.Object3D, centers: THREE.Vector3[], radius: number, z: number, sunDirection: THREE.Vector3) {
    const geometry = mergeGeometries(
      centers.map((center) => new THREE.ShapeGeometry(hexShape(radius)).translate(center.x, center.y, 0)),
    );

    this.root = new Water(geometry, {
      textureWidth: REFLECTION_SIZE,
      textureHeight: REFLECTION_SIZE,
      waterNormals: waterNormals(),
      sunDirection: sunDirection.clone().normalize(),
      sunColor: 0xffffff,
      waterColor: WATER_COLOR,
      distortionScale: DISTORTION_SCALE,
      alpha: WATER_ALPHA,
    });
    this.root.position.z = z;

    this.material = this.root.material as THREE.ShaderMaterial;
    this.material.uniforms.size.value = NOISE_SIZE;
    this.material.transparent = true;
    this.material.depthWrite = false;
    this.material.fragmentShader = this.material.fragmentShader
      .replace("getNoise( worldPosition.xz * size )", "getNoise( worldPosition.xy * size )")
      .replace("normalize( noise.xzy * vec3( 1.5, 1.0, 1.5 ) )", "normalize( noise.xyz * vec3( 1.5, 1.5, 1.0 ) )")
      .replace("surfaceNormal.xz * ( 0.001", "surfaceNormal.xy * ( 0.001");

    parent.add(this.root);
  }

  update(dt: number) {
    this.material.uniforms.time.value += dt;
  }

  dispose(parent: THREE.Object3D) {
    parent.remove(this.root);
    this.root.geometry.dispose();
    this.material.dispose();
  }
}

function hexShape(radius: number): THREE.Shape {
  return new THREE.Shape(
    Array.from({ length: 6 }, (_, i) => {
      const angle = (i * Math.PI) / 3;
      return new THREE.Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }),
  );
}

function waterNormals(): THREE.DataTexture {
  const octaves = NORMAL_MAP_OCTAVES.map((period, i) => ({
    noise: periodicNoise(period),
    period,
    amplitude: 0.55 ** i,
  }));
  const height = (u: number, v: number) =>
    octaves.reduce((sum, octave) => sum + octave.amplitude * octave.noise(u * octave.period, v * octave.period), 0);

  const heights = new Float32Array(NORMAL_MAP_SIZE * NORMAL_MAP_SIZE);
  for (let y = 0; y < NORMAL_MAP_SIZE; y++) {
    for (let x = 0; x < NORMAL_MAP_SIZE; x++) {
      heights[y * NORMAL_MAP_SIZE + x] = height(x / NORMAL_MAP_SIZE, y / NORMAL_MAP_SIZE);
    }
  }

  const at = (x: number, y: number) =>
    heights[((y + NORMAL_MAP_SIZE) % NORMAL_MAP_SIZE) * NORMAL_MAP_SIZE + ((x + NORMAL_MAP_SIZE) % NORMAL_MAP_SIZE)];
  const data = new Uint8Array(NORMAL_MAP_SIZE * NORMAL_MAP_SIZE * 4);
  const normal = new THREE.Vector3();
  for (let y = 0; y < NORMAL_MAP_SIZE; y++) {
    for (let x = 0; x < NORMAL_MAP_SIZE; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * NORMAL_MAP_STRENGTH;
      const dy = (at(x, y + 1) - at(x, y - 1)) * NORMAL_MAP_STRENGTH;
      normal.set(-dx, -dy, 1).normalize();
      const i = (y * NORMAL_MAP_SIZE + x) * 4;
      data[i] = (normal.x * 0.5 + 0.5) * 255;
      data[i + 1] = (normal.y * 0.5 + 0.5) * 255;
      data[i + 2] = (normal.z * 0.5 + 0.5) * 255;
      data[i + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, NORMAL_MAP_SIZE, NORMAL_MAP_SIZE);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function periodicNoise(period: number): (x: number, y: number) => number {
  const lattice = Array.from({ length: period * period }, () => Math.random());
  const value = (ix: number, iy: number) => lattice[(((iy % period) + period) % period) * period + (((ix % period) + period) % period)];
  const smooth = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  return (x, y) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const sx = smooth(x - ix);
    const sy = smooth(y - iy);
    const top = value(ix, iy) * (1 - sx) + value(ix + 1, iy) * sx;
    const bottom = value(ix, iy + 1) * (1 - sx) + value(ix + 1, iy + 1) * sx;
    return top * (1 - sy) + bottom * sy;
  };
}
