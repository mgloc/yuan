import * as THREE from "three";
import { type Coord, type Tile, TileType } from "../../game_types";
import { disposeObject } from "../dispose.ts";
import { TILE_RADIUS } from "../hex_layout.ts";
import { HIGHLIGHT_STYLES, type Highlight, type HighlightStyle } from "../highlight.ts";
import { createTileLabels } from "./tile_label.ts";
import { createProps } from "./tile_props.ts";
import { createRelief } from "./tile_relief.ts";
import { createMinePit, mineHole } from "./tile_mine.ts";
import { isTextured, tileTexture } from "./tile_textures.ts";

const TILE_HEIGHT = TILE_RADIUS / 10;
const TILE_BEVEL_THINKNESS = TILE_RADIUS / 20;
const WATER_HEIGHT = TILE_HEIGHT * 0.2;
const tileDepth = (type: TileType) => (type === TileType.Water ? WATER_HEIGHT : TILE_HEIGHT);
const MINE_PIT_DEPTH = TILE_HEIGHT * 1.4;
const extrude = (shape: THREE.Shape, depth: number) =>
  new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    steps: 1,
    bevelThickness: TILE_BEVEL_THINKNESS,
  });
const TILE_GEOMETRY = extrude(tileShape(TILE_RADIUS), TILE_HEIGHT);
const WATER_GEOMETRY = extrude(tileShape(TILE_RADIUS), WATER_HEIGHT);
const MINE_GEOMETRY = extrude(withHole(tileShape(TILE_RADIUS), mineHole(TILE_RADIUS)), TILE_HEIGHT);
const tileGeometry = (type: TileType) =>
  type === TileType.Water ? WATER_GEOMETRY : type === TileType.Mine ? MINE_GEOMETRY : TILE_GEOMETRY;
export const TILE_COLORS: Record<TileType, number> = {
  [TileType.RiceField]: 0xdcdb8e,
  [TileType.Mine]: 0xa8784a,
  [TileType.Forest]: 0x6f9e3c,
  [TileType.Hills]: 0xbac86c,
  [TileType.Water]: 0xead9a6,
  [TileType.Mountain]: 0x3a3b3e,
  [TileType.Volcano]: 0x3d3634,
};
export const TILE_HINT_COLORS: Record<TileType, number> = {
  [TileType.RiceField]: 0xe6d25a,
  [TileType.Mine]: 0xa8784a,
  [TileType.Forest]: 0x4f9a3a,
  [TileType.Hills]: 0xb5cf6a,
  [TileType.Water]: 0x3f8fdc,
  [TileType.Mountain]: 0x8c9096,
  [TileType.Volcano]: 0xd8392b,
};
const TILE_MATERIALS = new Map<TileType, THREE.Material | THREE.Material[]>(
  Object.entries(TILE_COLORS).map(([key, color]) => {
    const type = key as TileType;
    const side = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
    if (!isTextured(type)) {
      return [type, side];
    }
    const top = new THREE.MeshStandardMaterial({ map: tileTexture(type, TILE_RADIUS), roughness: 0.95 });
    return [type, [top, side]];
  }),
);

const OUTLINE_OUTER_RADIUS = TILE_RADIUS * 0.98;
const OUTLINE_SEGMENT_MARGIN = 0.2;
export { TILE_RADIUS };
export const TILE_BOTTOM_Z = -TILE_BEVEL_THINKNESS;
export const tileTopZ = (type: TileType) => tileDepth(type) + TILE_BEVEL_THINKNESS;
export const WATER_SURFACE_Z = tileTopZ(TileType.Water) + 0.05;
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

    const mesh = new THREE.Mesh(tileGeometry(entity.type), TILE_MATERIALS.get(entity.type)!);
    if (isTextured(entity.type) && entity.type !== TileType.Mine) {
      mesh.rotation.z = (textureTurn(coord) * Math.PI) / 3;
    }
    this.root.add(mesh);

    const topZ = tileTopZ(entity.type);
    if (entity.type === TileType.Mine) {
      this.root.add(createMinePit(TILE_RADIUS, topZ, MINE_PIT_DEPTH));
    }
    const relief = createRelief(entity.type, TILE_RADIUS, topZ, coord, TILE_COLORS[entity.type]);
    if (relief) {
      this.root.add(relief);
    }
    const props = createProps(entity.type, TILE_RADIUS, topZ, coord, Boolean(entity.name));
    if (props) {
      this.root.add(props);
    }

    if (entity.name) {
      this.root.add(createTileLabels(entity.name, TILE_RADIUS, topZ + LABEL_Z_OFFSET));
    }

    this.outline = new THREE.Mesh();
    this.outline.position.z = (entity.type === TileType.Water ? WATER_SURFACE_Z : topZ) + OUTLINE_Z_OFFSET;
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
    disposeObject(this.root);
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

function withHole(shape: THREE.Shape, hole: THREE.Path): THREE.Shape {
  shape.holes.push(hole);
  return shape;
}

function textureTurn(coord: Coord): number {
  return ((Math.imul(coord.col + 7, 2654435761) ^ Math.imul(coord.row + 3, 40503)) >>> 0) % 6;
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
