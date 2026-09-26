import * as THREE from "three";
import type { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Renderer } from "./renderer.ts";

const HOME_POLAR = THREE.MathUtils.degToRad(38);
const HOME_AZIMUTH = -Math.PI / 2;
const FOCUS_POLAR = THREE.MathUtils.degToRad(30);
const FOCUS_DISTANCE = 14;
const MIN_DISTANCE = 6;
const MAX_DISTANCE_FACTOR = 1.8;
const MAX_POLAR = THREE.MathUtils.degToRad(72);
const ANIMATION_SECONDS = 0.6;

interface Orbit {
  radius: number;
  polar: number;
  azimuth: number;
}

interface Pose {
  target: THREE.Vector3;
  orbit: Orbit;
}

interface Animation {
  from: Pose;
  to: Pose;
  elapsed: number;
}

export class CameraRig {
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private renderer: Renderer;
  private home: Pose | null = null;
  private saved: Pose | null = null;
  private animation: Animation | null = null;

  constructor(renderer: Renderer) {
    this.renderer = renderer;
    this.camera = renderer.camera;
    this.controls = renderer.orbit;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = MIN_DISTANCE;
    this.controls.maxPolarAngle = MAX_POLAR;
    this.controls.addEventListener("start", this.onUserInput);
  }

  frame(box: THREE.Box3, apply = true) {
    const center = box.getCenter(new THREE.Vector3());
    center.z = box.min.z;
    const direction = toOffset({ radius: 1, polar: HOME_POLAR, azimuth: HOME_AZIMUTH });
    const { target, distance: radius } = this.renderer.fit(box, center, direction);
    this.home = { target, orbit: { radius, polar: HOME_POLAR, azimuth: HOME_AZIMUTH } };
    this.controls.maxDistance = radius * MAX_DISTANCE_FACTOR;
    if (apply) {
      this.animation = null;
      this.saved = null;
      this.apply(this.home);
    }
  }

  focus(point: THREE.Vector3) {
    const current = this.current();
    this.saved ??= current;
    this.animateTo({ target: point.clone(), orbit: { radius: FOCUS_DISTANCE, polar: FOCUS_POLAR, azimuth: current.orbit.azimuth } });
  }

  restore() {
    if (this.saved === null) {
      return;
    }
    this.animateTo(this.saved);
    this.saved = null;
  }

  reset() {
    this.saved = null;
    if (this.home !== null) {
      this.animateTo(this.home);
    }
  }

  update(dt: number) {
    if (this.animation === null) {
      this.controls.update();
      return;
    }
    const animation = this.animation;
    animation.elapsed += dt;
    const t = easeInOut(Math.min(1, animation.elapsed / ANIMATION_SECONDS));
    this.apply(interpolate(animation.from, animation.to, t));
    if (t >= 1) {
      this.animation = null;
    }
  }

  dispose() {
    this.controls.removeEventListener("start", this.onUserInput);
  }

  private onUserInput = () => {
    this.animation = null;
  };

  private animateTo(to: Pose) {
    this.animation = { from: this.current(), to, elapsed: 0 };
  }

  private current(): Pose {
    const target = this.controls.target.clone();
    return { target, orbit: toOrbit(this.camera.position.clone().sub(target)) };
  }

  private apply(pose: Pose) {
    this.controls.target.copy(pose.target);
    this.camera.position.copy(pose.target).add(toOffset(pose.orbit));
    this.camera.lookAt(pose.target);
    this.controls.update();
  }
}

function toOrbit(offset: THREE.Vector3): Orbit {
  const radius = offset.length();
  return { radius, polar: Math.acos(THREE.MathUtils.clamp(offset.z / radius, -1, 1)), azimuth: Math.atan2(offset.y, offset.x) };
}

function toOffset({ radius, polar, azimuth }: Orbit): THREE.Vector3 {
  return new THREE.Vector3(Math.cos(azimuth) * Math.sin(polar), Math.sin(azimuth) * Math.sin(polar), Math.cos(polar)).multiplyScalar(radius);
}

function interpolate(from: Pose, to: Pose, t: number): Pose {
  let turn = to.orbit.azimuth - from.orbit.azimuth;
  turn = Math.atan2(Math.sin(turn), Math.cos(turn));
  return {
    target: from.target.clone().lerp(to.target, t),
    orbit: {
      radius: THREE.MathUtils.lerp(from.orbit.radius, to.orbit.radius, t),
      polar: THREE.MathUtils.lerp(from.orbit.polar, to.orbit.polar, t),
      azimuth: from.orbit.azimuth + turn * t,
    },
  };
}

function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}
