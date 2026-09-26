import * as THREE from "three";
import { type Coord, type Tile, TileType } from "../../game_types";
import { HIGHLIGHT_STYLES, type Highlight, type HighlightStyle } from "../highlight.ts";
import { createTileLabels } from "./tile_label.ts";
import { createRelief } from "./tile_relief.ts";

export const TILE_RADIUS = 2;
const TILE_HEIGHT = TILE_RADIUS / 10;
const TILE_BEVEL_THINKNESS = TILE_RADIUS / 20;
const WATER_HEIGHT = TILE_HEIGHT * 0.2;
const tileDepth = (type: TileType) => (type === TileType.Water ? WATER_HEIGHT : TILE_HEIGHT);
const TILE_GEOMETRIES = new Map<number, THREE.BufferGeometry>(
  [TILE_HEIGHT, WATER_HEIGHT].map((depth) => [
    depth,
    new THREE.ExtrudeGeometry(tileShape(TILE_RADIUS), {
      depth,
      bevelEnabled: true,
      steps: 1,
      bevelThickness: TILE_BEVEL_THINKNESS,
    }),
  ]),
);
const TILE_COLORS: Record<TileType, number> = {
  [TileType.RiceField]: 0xc8e66a,
  [TileType.Mine]: 0xb0906a,
  [TileType.Forest]: 0x4a8f4a,
  [TileType.Hills]: 0xaaffaa,
  [TileType.Water]: 0x3366aa,
  [TileType.Mountain]: 0x3a3b3e,
  [TileType.Volcano]: 0x3d3634,
};
const TILE_MATERIALS = new Map<TileType, THREE.Material>(
  Object.entries(TILE_COLORS).map(([type, color]) => [
    type as TileType,
    new THREE.MeshBasicMaterial({ color }),
  ]),
);

const OUTLINE_OUTER_RADIUS = TILE_RADIUS * 0.98;
const OUTLINE_SEGMENT_MARGIN = 0.2;
export const tileTopZ = (type: TileType) => tileDepth(type) + TILE_BEVEL_THINKNESS;
const OUTLINE_Z_OFFSET = 0.01;
const LABEL_Z_OFFSET = 0.005;
const OUTLINES = new Map<Highlight, { geometry: THREE.BufferGeometry; material: THREE.Material; lift: number }>(
  Object.entries(HIGHLIGHT_STYLES).map(([highlight, style]) => [
    highlight as Highlight,
    {
      geometry: outlineGeometry(style),
      material: new THREE.MeshBasicMaterial({
        color: style.color,
        transparent: style.opacity < 1,
        opacity: style.opacity,
        depthWrite: style.opacity >= 1,
      }),
      lift: style.lift,
    },
  ]),
);

export class TileView {
  root: THREE.Group;
  coord: Coord;
  private outline: THREE.Mesh;

  constructor(parent: THREE.Object3D, entity: Tile, coord: Coord) {
    this.root = new THREE.Group();
    this.coord = coord;
    this.root.userData.coord = coord;

    const material = TILE_MATERIALS.get(entity.type)!;
    const mesh = new THREE.Mesh(TILE_GEOMETRIES.get(tileDepth(entity.type))!, material);
    this.root.add(mesh);

    const topZ = tileTopZ(entity.type);
    const relief = createRelief(entity.type, TILE_RADIUS, topZ, coord, TILE_COLORS[entity.type]);
    if (relief) {
      this.root.add(relief);
    }

    if (entity.name) {
      this.root.add(createTileLabels(entity.name, TILE_RADIUS, topZ + LABEL_Z_OFFSET));
    }

    this.outline = new THREE.Mesh();
    this.outline.position.z = topZ + OUTLINE_Z_OFFSET;
    this.outline.visible = false;
    this.root.add(this.outline);

    parent.add(this.root);
  }

  setHighlight(highlight: Highlight | null) {
    const outline = highlight === null ? null : OUTLINES.get(highlight)!;
    this.root.position.z = outline?.lift ?? 0;
    this.outline.visible = outline !== null;
    if (outline !== null) {
      this.outline.geometry = outline.geometry;
      this.outline.material = outline.material;
    }
  }

  dispose(parent: THREE.Object3D) {
    parent.remove(this.root);
  }
}

function tileShape(radius: number): THREE.Shape {
  const hexagon = new THREE.Shape();

  for (let i = 0; i < 6; i++) {
    const angle = (i * 2 * Math.PI) / 6;

    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);

    if (i === 0) {
      hexagon.moveTo(x, y);
    } else {
      hexagon.lineTo(x, y);
    }
  }
  return hexagon;
}

function outlineGeometry(style: HighlightStyle): THREE.BufferGeometry {
  const innerRadius = OUTLINE_OUTER_RADIUS - style.thickness * TILE_RADIUS;
  if (!style.segmented) {
    const ring = tileShape(OUTLINE_OUTER_RADIUS);
    ring.holes.push(tileShape(innerRadius));
    return new THREE.ShapeGeometry(ring);
  }
  const segments = Array.from({ length: 6 }, (_, i) => {
    const from = (i * Math.PI) / 3;
    const to = ((i + 1) * Math.PI) / 3;
    const point = (radius: number, t: number) =>
      new THREE.Vector2(
        radius * (Math.cos(from) * (1 - t) + Math.cos(to) * t),
        radius * (Math.sin(from) * (1 - t) + Math.sin(to) * t),
      );
    return new THREE.Shape([
      point(OUTLINE_OUTER_RADIUS, OUTLINE_SEGMENT_MARGIN),
      point(OUTLINE_OUTER_RADIUS, 1 - OUTLINE_SEGMENT_MARGIN),
      point(innerRadius, 1 - OUTLINE_SEGMENT_MARGIN),
      point(innerRadius, OUTLINE_SEGMENT_MARGIN),
    ]);
  });
  return new THREE.ShapeGeometry(segments);
}
