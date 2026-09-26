import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { disposeObject } from "../dispose.ts";

const TOP_MARGIN = 3.5;
const TOP_THICKNESS = 1.4;
const TOP_RADIUS = 0.5;
const APRON_INSET = 2.2;
const APRON_HEIGHT = 2.6;
const APRON_THICKNESS = 0.7;
const LEG_SIZE = 1.9;
const LEG_FOOT_SCALE = 0.7;
const LEG_HEIGHT = 30;
const SHADOW_SPREAD = 2.4;
const SHADOW_OPACITY = 0.55;
const SHADOW_BLUR = 0.8;
const SHADOW_TEXTURE_SIZE = 512;
const FLOOR_SHADOW_SCALE = 1.9;
const FLOOR_SHADOW_OPACITY = 0.7;
const FLOOR_SHADOW_TEXTURE = 256;
const WOOD_TEXTURE_SIZE = 512;
const WOOD_TILE_UNITS = 16;

export class TableView {
  root = new THREE.Group();
  floorZ: number;
  private materials: THREE.Material[] = [];
  private textures: THREE.Texture[] = [];

  private footprint: THREE.Mesh | null = null;
  private surface: number;

  constructor(parent: THREE.Object3D, board: THREE.Box3) {
    const size = board.getSize(new THREE.Vector3());
    const center = board.getCenter(new THREE.Vector3());
    const width = size.x + TOP_MARGIN * 2;
    const depth = size.y + TOP_MARGIN * 2;
    const surface = board.min.z;
    this.surface = surface;

    const top = this.wood(width, depth, "#8a5a33", 0.45);
    const frame = this.wood(WOOD_TILE_UNITS, WOOD_TILE_UNITS, "#6e4527", 0.6);

    const tabletop = new THREE.Mesh(new RoundedBoxGeometry(width, depth, TOP_THICKNESS, 4, TOP_RADIUS), top);
    tabletop.position.set(center.x, center.y, surface - TOP_THICKNESS / 2);
    this.root.add(tabletop);

    const underTop = surface - TOP_THICKNESS;
    this.floorZ = underTop - LEG_HEIGHT;
    const apronWidth = width - APRON_INSET * 2;
    const apronDepth = depth - APRON_INSET * 2;
    for (const [w, d, x, y] of [
      [apronWidth, APRON_THICKNESS, 0, (apronDepth - APRON_THICKNESS) / 2],
      [apronWidth, APRON_THICKNESS, 0, -(apronDepth - APRON_THICKNESS) / 2],
      [APRON_THICKNESS, apronDepth, (apronWidth - APRON_THICKNESS) / 2, 0],
      [APRON_THICKNESS, apronDepth, -(apronWidth - APRON_THICKNESS) / 2, 0],
    ]) {
      const apron = new THREE.Mesh(new THREE.BoxGeometry(w, d, APRON_HEIGHT), frame);
      apron.position.set(center.x + x, center.y + y, underTop - APRON_HEIGHT / 2);
      this.root.add(apron);
    }

    const leg = legGeometry();
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const mesh = new THREE.Mesh(leg, frame);
        mesh.position.set(
          center.x + sx * (apronWidth / 2 - LEG_SIZE / 2),
          center.y + sy * (apronDepth / 2 - LEG_SIZE / 2),
          underTop,
        );
        this.root.add(mesh);
      }
    }

    this.root.add(this.floorShadow(width, depth, center));
    parent.add(this.root);
  }

  setFootprint(tiles: THREE.Vector3[], tileRadius: number) {
    if (this.footprint !== null) {
      this.root.remove(this.footprint);
      disposeObject(this.footprint);
      (this.footprint.material as THREE.MeshBasicMaterial).map?.dispose();
      this.footprint = null;
    }
    if (tiles.length === 0) {
      return;
    }
    const bounds = new THREE.Box3();
    tiles.forEach((tile) => bounds.expandByPoint(tile));
    bounds.expandByVector(new THREE.Vector3(tileRadius, tileRadius, 0));
    bounds.min.z = this.surface;
    this.footprint = this.contactShadow(bounds, tiles, tileRadius);
    this.root.add(this.footprint);
  }

  dispose(parent: THREE.Object3D) {
    this.setFootprint([], 0);
    parent.remove(this.root);
    disposeObject(this.root);
    this.materials.forEach((material) => material.dispose());
    this.textures.forEach((texture) => texture.dispose());
  }

  private wood(width: number, depth: number, base: string, roughness: number): THREE.MeshStandardMaterial {
    const texture = new THREE.CanvasTexture(woodCanvas(base));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 8;
    texture.repeat.set(width / WOOD_TILE_UNITS, depth / WOOD_TILE_UNITS);
    const material = new THREE.MeshStandardMaterial({ map: texture, roughness, metalness: 0 });
    this.textures.push(texture);
    this.materials.push(material);
    return material;
  }

  private floorShadow(width: number, depth: number, center: THREE.Vector3): THREE.Mesh {
    const size = new THREE.Vector2(width * FLOOR_SHADOW_SCALE, depth * FLOOR_SHADOW_SCALE);
    const texture = new THREE.CanvasTexture(floorShadowCanvas(size.x / size.y));
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: FLOOR_SHADOW_OPACITY, depthWrite: false });
    this.textures.push(texture);
    this.materials.push(material);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(size.x, size.y), material);
    shadow.position.set(center.x, center.y, this.floorZ + 0.05);
    return shadow;
  }

  private contactShadow(board: THREE.Box3, tiles: THREE.Vector3[], tileRadius: number): THREE.Mesh {
    const min = new THREE.Vector2(board.min.x - SHADOW_SPREAD, board.min.y - SHADOW_SPREAD);
    const size = new THREE.Vector2(board.max.x - board.min.x + SHADOW_SPREAD * 2, board.max.y - board.min.y + SHADOW_SPREAD * 2);
    const texture = new THREE.CanvasTexture(shadowCanvas(min, size, tiles, tileRadius));
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: SHADOW_OPACITY, depthWrite: false });
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(size.x, size.y), material);
    shadow.position.set(min.x + size.x / 2, min.y + size.y / 2, board.min.z + 0.01);
    shadow.renderOrder = -1;
    return shadow;
  }
}

function floorShadowCanvas(aspect: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = FLOOR_SHADOW_TEXTURE;
  canvas.height = Math.round(FLOOR_SHADOW_TEXTURE / aspect);
  const context = canvas.getContext("2d")!;
  const gradient = context.createRadialGradient(canvas.width / 2, canvas.height / 2, 0, canvas.width / 2, canvas.height / 2, canvas.width / 2);
  gradient.addColorStop(0, "rgba(0, 0, 0, 1)");
  gradient.addColorStop(0.45, "rgba(0, 0, 0, 0.85)");
  gradient.addColorStop(0.8, "rgba(0, 0, 0, 0.3)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  context.setTransform(1, 0, 0, canvas.height / canvas.width, 0, 0);
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.width);
  return canvas;
}

function legGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(LEG_SIZE, LEG_SIZE, LEG_HEIGHT, 1, 1, 1).translate(0, 0, -LEG_HEIGHT / 2);
  const positions = geometry.getAttribute("position");
  for (let i = 0; i < positions.count; i++) {
    if (positions.getZ(i) < -LEG_HEIGHT / 2) {
      positions.setXY(i, positions.getX(i) * LEG_FOOT_SCALE, positions.getY(i) * LEG_FOOT_SCALE);
    }
  }
  geometry.computeVertexNormals();
  return geometry;
}

function woodCanvas(base: string): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = WOOD_TEXTURE_SIZE;
  canvas.height = WOOD_TEXTURE_SIZE;
  const context = canvas.getContext("2d")!;
  context.fillStyle = base;
  context.fillRect(0, 0, WOOD_TEXTURE_SIZE, WOOD_TEXTURE_SIZE);

  let seed = 7;
  const next = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const plank = WOOD_TEXTURE_SIZE / 4;
  for (let p = 0; p < 4; p++) {
    const y0 = p * plank;
    context.fillStyle = `rgba(${next() > 0.5 ? "255, 230, 200" : "40, 20, 5"}, ${0.05 + next() * 0.07})`;
    context.fillRect(0, y0, WOOD_TEXTURE_SIZE, plank);
    const phase = next() * Math.PI * 2;
    for (let line = 0; line < 38; line++) {
      const offset = y0 + next() * plank;
      const amplitude = 2 + next() * 6;
      const frequency = (1 + Math.floor(next() * 3)) * ((Math.PI * 2) / WOOD_TEXTURE_SIZE);
      context.beginPath();
      for (let x = 0; x <= WOOD_TEXTURE_SIZE; x += 8) {
        const y = offset + Math.sin(x * frequency + phase + line) * amplitude;
        if (x === 0) {
          context.moveTo(x, y);
        } else {
          context.lineTo(x, y);
        }
      }
      context.lineWidth = 0.6 + next() * 1.8;
      context.strokeStyle = `rgba(45, 22, 8, ${0.12 + next() * 0.22})`;
      context.stroke();
    }
    context.fillStyle = "rgba(30, 15, 5, 0.55)";
    context.fillRect(0, y0, WOOD_TEXTURE_SIZE, 2);
  }
  for (let i = 0; i < 5; i++) {
    const x = next() * WOOD_TEXTURE_SIZE;
    const y = next() * WOOD_TEXTURE_SIZE;
    const knot = context.createRadialGradient(x, y, 0, x, y, 10 + next() * 14);
    knot.addColorStop(0, "rgba(50, 25, 8, 0.6)");
    knot.addColorStop(1, "rgba(50, 25, 8, 0)");
    context.fillStyle = knot;
    context.fillRect(x - 30, y - 30, 60, 60);
  }
  return canvas;
}

function shadowCanvas(min: THREE.Vector2, size: THREE.Vector2, tiles: THREE.Vector3[], tileRadius: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const scale = SHADOW_TEXTURE_SIZE / Math.max(size.x, size.y);
  canvas.width = Math.round(size.x * scale);
  canvas.height = Math.round(size.y * scale);
  const context = canvas.getContext("2d")!;
  context.filter = `blur(${Math.round(SHADOW_BLUR * scale)}px)`;
  context.fillStyle = "#000";
  context.beginPath();
  for (const tile of tiles) {
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      const x = (tile.x + Math.cos(angle) * tileRadius - min.x) * scale;
      const y = (size.y - (tile.y + Math.sin(angle) * tileRadius - min.y)) * scale;
      if (i === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    }
    context.closePath();
  }
  context.fill();
  return canvas;
}
