import * as THREE from "three";

const FONT_SIZE_PX = 64;
const FONT = `600 ${FONT_SIZE_PX}px Georgia, "Times New Roman", serif`;
const LETTER_SPACING_PX = 10;
const CANVAS_PADDING_PX = 16;
const TEXT_COLOR = "rgba(255, 255, 255, 0.9)";
const OUTLINE_COLOR = "rgba(0, 0, 0, 0.7)";
const OUTLINE_WIDTH_PX = 6;
const SHADOW_COLOR = "rgba(0, 0, 0, 0.6)";
const SHADOW_BLUR_PX = 8;
const LABEL_EDGE_ANGLES = [Math.PI / 6, (5 * Math.PI) / 6, (3 * Math.PI) / 2];

const TEXTURES = new Map<string, { texture: THREE.CanvasTexture; aspect: number }>();

export function createTileLabels(name: string, radius: number, z: number): THREE.Group {
  const { texture, aspect } = labelTexture(name.toUpperCase());
  const height = radius * 0.14;
  const geometry = new THREE.PlaneGeometry(height * aspect, height);
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
  const distance = radius * 0.6;

  const group = new THREE.Group();
  for (const angle of LABEL_EDGE_ANGLES) {
    const label = new THREE.Mesh(geometry, material);
    label.position.set(Math.cos(angle) * distance, Math.sin(angle) * distance, z);
    label.rotation.z = angle - Math.PI / 2;
    group.add(label);
  }
  return group;
}

function labelTexture(text: string): { texture: THREE.CanvasTexture; aspect: number } {
  const cached = TEXTURES.get(text);
  if (cached) {
    return cached;
  }

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d")!;
  context.font = FONT;
  context.letterSpacing = `${LETTER_SPACING_PX}px`;
  canvas.width = Math.ceil(context.measureText(text).width) + CANVAS_PADDING_PX * 2;
  canvas.height = Math.ceil(FONT_SIZE_PX * 1.3);

  context.font = FONT;
  context.letterSpacing = `${LETTER_SPACING_PX}px`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  const x = canvas.width / 2 + LETTER_SPACING_PX / 2;
  const y = canvas.height / 2;

  context.shadowColor = SHADOW_COLOR;
  context.shadowBlur = SHADOW_BLUR_PX;
  context.lineJoin = "round";
  context.lineWidth = OUTLINE_WIDTH_PX;
  context.strokeStyle = OUTLINE_COLOR;
  context.strokeText(text, x, y);

  context.shadowColor = "transparent";
  context.fillStyle = TEXT_COLOR;
  context.fillText(text, x, y);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const entry = { texture, aspect: canvas.width / canvas.height };
  TEXTURES.set(text, entry);
  return entry;
}
