import * as THREE from "three";
import { TileType } from "../../game_types.ts";
import { MINE_PIT } from "./tile_mine.ts";

const TEXTURE_SIZE = 512;
const TEXTURES = new Map<TileType, THREE.CanvasTexture>();

type Draw = (context: CanvasRenderingContext2D, next: () => number) => void;

const DRAWERS: Partial<Record<TileType, Draw>> = {
  [TileType.RiceField]: drawRiceField,
  [TileType.Forest]: drawForest,
  [TileType.Hills]: drawHills,
  [TileType.Mine]: drawMine,
};

export function isTextured(type: TileType): boolean {
  return DRAWERS[type] !== undefined;
}

export function tileTexture(type: TileType, radius: number): THREE.CanvasTexture | null {
  const draw = DRAWERS[type];
  if (!draw) {
    return null;
  }
  const cached = TEXTURES.get(type);
  if (cached) {
    return cached;
  }

  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;
  draw(canvas.getContext("2d")!, seeded(type));

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.repeat.set(1 / (2 * radius), 1 / (2 * radius));
  texture.offset.set(0.5, 0.5);
  TEXTURES.set(type, texture);
  return texture;
}

function drawRiceField(context: CanvasRenderingContext2D, next: () => number) {
  const size = TEXTURE_SIZE;
  context.fillStyle = "#d8d78c";
  context.fillRect(0, 0, size, size);

  const hub = { x: size * (0.4 + next() * 0.2), y: size * (0.4 + next() * 0.2) };
  const start = next() * Math.PI * 2;
  const dykes = [0, 1, 2].map((i) => start + (i * 2 * Math.PI) / 3 + (next() - 0.5) * 0.6);

  dykes.forEach((from, i) => {
    const to = dykes[(i + 1) % 3] + (i === 2 ? Math.PI * 2 : 0);
    context.save();
    context.beginPath();
    context.moveTo(hub.x, hub.y);
    context.arc(hub.x, hub.y, size * 1.5, from, to);
    context.closePath();
    context.clip();

    const bandAngle = (from + to) / 2 + (next() - 0.5) * 0.8;
    const center = { x: hub.x + Math.cos(bandAngle) * size * 1.4, y: hub.y + Math.sin(bandAngle) * size * 1.4 };
    const tones = i % 2 === 0 ? ["#d2d27f", "#e3e29e"] : ["#cacb74", "#dcdc93"];
    for (let r = size * 0.4, band = 0; r < size * 2.6; r += 20, band++) {
      context.beginPath();
      context.arc(center.x, center.y, r, 0, Math.PI * 2);
      context.lineWidth = 14;
      context.strokeStyle = tones[band % 2];
      context.stroke();
      context.lineWidth = 2;
      context.strokeStyle = "rgba(140, 140, 70, 0.55)";
      context.stroke();
    }
    context.restore();
  });

  for (let i = 0; i < 14; i++) {
    context.beginPath();
    context.ellipse(next() * size, next() * size, 10 + next() * 22, 5 + next() * 10, next() * Math.PI, 0, Math.PI * 2);
    context.fillStyle = "rgba(170, 215, 205, 0.45)";
    context.fill();
  }

  context.lineCap = "round";
  for (const angle of dykes) {
    const end = { x: hub.x + Math.cos(angle) * size, y: hub.y + Math.sin(angle) * size };
    context.beginPath();
    context.moveTo(hub.x, hub.y);
    context.quadraticCurveTo(
      (hub.x + end.x) / 2 + (next() - 0.5) * 80,
      (hub.y + end.y) / 2 + (next() - 0.5) * 80,
      end.x,
      end.y,
    );
    context.lineWidth = 9;
    context.strokeStyle = "#9c9a4e";
    context.stroke();
    context.lineWidth = 3;
    context.strokeStyle = "#c9c77c";
    context.stroke();
  }

  speckle(context, next, 900, ["rgba(120, 120, 60, 0.18)", "rgba(255, 255, 220, 0.2)"]);
}

function drawForest(context: CanvasRenderingContext2D, next: () => number) {
  const size = TEXTURE_SIZE;
  context.fillStyle = "#4a6f2a";
  context.fillRect(0, 0, size, size);
  speckle(context, next, 900, ["rgba(40, 60, 20, 0.35)", "rgba(120, 150, 60, 0.25)"]);

  const greens = ["#4a7428", "#56832e", "#5f8d34", "#3f6524", "#668f3a"];
  const trees = Array.from({ length: 160 }, () => ({
    x: next() * size,
    y: next() * size,
    radius: 8 + next() * 12,
    color: greens[Math.floor(next() * greens.length)],
  })).sort((a, b) => a.y - b.y);

  for (const tree of trees) {
    context.beginPath();
    context.arc(tree.x + tree.radius * 0.25, tree.y + tree.radius * 0.3, tree.radius, 0, Math.PI * 2);
    context.fillStyle = "rgba(25, 45, 15, 0.45)";
    context.fill();

    context.beginPath();
    context.arc(tree.x, tree.y, tree.radius, 0, Math.PI * 2);
    context.fillStyle = tree.color;
    context.fill();
    context.lineWidth = 2;
    context.strokeStyle = "rgba(30, 55, 18, 0.6)";
    context.stroke();

    context.beginPath();
    context.arc(tree.x - tree.radius * 0.3, tree.y - tree.radius * 0.3, tree.radius * 0.45, 0, Math.PI * 2);
    context.fillStyle = "rgba(190, 220, 120, 0.35)";
    context.fill();
  }
}

function drawHills(context: CanvasRenderingContext2D, next: () => number) {
  const size = TEXTURE_SIZE;
  context.fillStyle = "#b4c26a";
  context.fillRect(0, 0, size, size);

  const hills = Array.from({ length: 5 }, () => ({
    x: next() * size,
    y: next() * size,
    rx: 120 + next() * 80,
    ry: 70 + next() * 40,
    rotation: (next() - 0.5) * 0.6,
  })).sort((a, b) => a.y - b.y);

  for (const hill of hills) {
    context.save();
    context.translate(hill.x, hill.y);
    context.rotate(hill.rotation);
    context.scale(1, hill.ry / hill.rx);
    const gradient = context.createRadialGradient(-hill.rx * 0.2, -hill.rx * 0.3, 0, 0, 0, hill.rx);
    gradient.addColorStop(0, "#cbd584");
    gradient.addColorStop(0.7, "#b4c26a");
    gradient.addColorStop(1, "rgba(160, 176, 88, 0)");
    context.beginPath();
    context.arc(0, 0, hill.rx, 0, Math.PI * 2);
    context.fillStyle = gradient;
    context.fill();
    context.restore();
  }

  speckle(context, next, 500, ["rgba(110, 125, 50, 0.18)", "rgba(250, 250, 200, 0.18)"]);
}

function drawMine(context: CanvasRenderingContext2D, next: () => number) {
  const size = TEXTURE_SIZE;
  context.fillStyle = "#a9794a";
  context.fillRect(0, 0, size, size);
  speckle(context, next, 2200, ["rgba(80, 50, 25, 0.3)", "rgba(230, 190, 140, 0.3)", "rgba(60, 40, 20, 0.2)"]);

  const pit = {
    x: (0.5 + Math.cos(MINE_PIT.angle) * MINE_PIT.distance * 0.5) * size,
    y: (0.5 - Math.sin(MINE_PIT.angle) * MINE_PIT.distance * 0.5) * size,
    radius: MINE_PIT.radius * 0.5 * size,
  };
  const spoil = context.createRadialGradient(pit.x, pit.y, pit.radius, pit.x, pit.y, pit.radius * 1.7);
  spoil.addColorStop(0, "#d2a86f");
  spoil.addColorStop(1, "rgba(169, 121, 74, 0)");
  context.fillStyle = spoil;
  context.fillRect(0, 0, size, size);

  for (let i = 0; i < 28; i++) {
    const x = next() * size;
    const y = next() * size;
    if (Math.hypot(x - pit.x, y - pit.y) < pit.radius * 1.2) {
      continue;
    }
    const radius = 6 + next() * 12;
    context.beginPath();
    for (let k = 0; k < 6; k++) {
      const angle = (k / 6) * Math.PI * 2;
      const r = radius * (0.7 + next() * 0.5);
      context.lineTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
    }
    context.closePath();
    context.fillStyle = "#86613c";
    context.fill();
    context.lineWidth = 2;
    context.strokeStyle = "rgba(60, 40, 22, 0.6)";
    context.stroke();
  }

  context.lineCap = "round";
  for (let i = 0; i < 5; i++) {
    const angle = next() * Math.PI * 2;
    const from = pit.radius * 1.3;
    const to = from + 40 + next() * 90;
    context.beginPath();
    context.moveTo(pit.x + Math.cos(angle) * from, pit.y + Math.sin(angle) * from);
    context.lineTo(pit.x + Math.cos(angle) * to, pit.y + Math.sin(angle) * to);
    context.lineWidth = 10;
    context.strokeStyle = "rgba(200, 160, 110, 0.5)";
    context.stroke();
  }
}

function speckle(context: CanvasRenderingContext2D, next: () => number, count: number, colors: string[]) {
  for (let i = 0; i < count; i++) {
    context.fillStyle = colors[i % colors.length];
    context.fillRect(next() * TEXTURE_SIZE, next() * TEXTURE_SIZE, 1 + next() * 3, 1 + next() * 3);
  }
}

function seeded(type: TileType): () => number {
  let seed = [...type].reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 16777619), 2166136261) >>> 0;
  return () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
