import * as THREE from "three";
import type { PieceFactory, RampartLevel } from "./piece_factory.ts";

const WOOD_COLOR = 0xc49a6c;
const STONE_COLOR = 0x9a9a9a;
const BRONZE_COLOR = 0x9c7a3c;

const RAMPART_THICKNESS = 0.06;
const RAMPART_HEIGHT = 0.1;

const upright = (geometry: THREE.BufferGeometry) => geometry.rotateX(Math.PI / 2);
const pyramid = (radius: number, height: number) => upright(new THREE.ConeGeometry(radius, height, 4)).rotateZ(Math.PI / 4);

const VILLAGE_BODY = new THREE.BoxGeometry(0.28, 0.28, 0.18);
const VILLAGE_ROOF = pyramid(0.26, 0.16);

const CITY_BODY = new THREE.BoxGeometry(0.34, 0.34, 0.3);
const CITY_ROOF = pyramid(0.34, 0.14);
const CITY_TOP_BODY = new THREE.BoxGeometry(0.2, 0.2, 0.14);
const CITY_TOP_ROOF = pyramid(0.22, 0.14);

const ARMY_BODY = upright(new THREE.CylinderGeometry(0.05, 0.08, 0.2, 12));
const ARMY_HEAD = new THREE.SphereGeometry(0.06, 12, 8);

const TEMPLE_POST = new THREE.BoxGeometry(0.06, 0.06, 0.3);
const TEMPLE_TOP_BEAM = new THREE.BoxGeometry(0.44, 0.08, 0.05);
const TEMPLE_LOW_BEAM = new THREE.BoxGeometry(0.34, 0.05, 0.04);

export class ProceduralPieceFactory implements PieceFactory {
  private materials = new Map<string, THREE.Material>();

  village(color: number): THREE.Object3D {
    const material = this.material(color);
    return group(
      at(new THREE.Mesh(VILLAGE_BODY, material), 0, 0, 0.09),
      at(new THREE.Mesh(VILLAGE_ROOF, material), 0, 0, 0.26),
    );
  }

  city(color: number): THREE.Object3D {
    const material = this.material(color);
    return group(
      at(new THREE.Mesh(CITY_BODY, material), 0, 0, 0.15),
      at(new THREE.Mesh(CITY_ROOF, material), 0, 0, 0.37),
      at(new THREE.Mesh(CITY_TOP_BODY, material), 0, 0, 0.51),
      at(new THREE.Mesh(CITY_TOP_ROOF, material), 0, 0, 0.65),
    );
  }

  army(color: number): THREE.Object3D {
    const material = this.material(color);
    return group(
      at(new THREE.Mesh(ARMY_BODY, material), 0, 0, 0.1),
      at(new THREE.Mesh(ARMY_HEAD, material), 0, 0, 0.25),
    );
  }

  rampart(level: RampartLevel, halfWidth: number, halfDepth: number): THREE.Object3D {
    const frames = [frame(this.material(WOOD_COLOR), halfWidth, halfDepth, 0)];
    if (level === 2) {
      frames.push(frame(this.material(STONE_COLOR), halfWidth, halfDepth, RAMPART_HEIGHT));
    }
    return group(...frames);
  }

  temple(): THREE.Object3D {
    const material = this.material(BRONZE_COLOR, 0.3);
    return group(
      at(new THREE.Mesh(TEMPLE_POST, material), -0.14, 0, 0.15),
      at(new THREE.Mesh(TEMPLE_POST, material), 0.14, 0, 0.15),
      at(new THREE.Mesh(TEMPLE_LOW_BEAM, material), 0, 0, 0.24),
      at(new THREE.Mesh(TEMPLE_TOP_BEAM, material), 0, 0, 0.32),
    );
  }

  private material(color: number, metalness = 0): THREE.Material {
    const key = `${color}:${metalness}`;
    let material = this.materials.get(key);
    if (!material) {
      material = new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness });
      this.materials.set(key, material);
    }
    return material;
  }
}

function frame(material: THREE.Material, halfWidth: number, halfDepth: number, z: number): THREE.Object3D {
  const width = halfWidth * 2 + RAMPART_THICKNESS;
  const depth = halfDepth * 2 - RAMPART_THICKNESS;
  const horizontal = boxGeometry(width, RAMPART_THICKNESS, RAMPART_HEIGHT);
  const vertical = boxGeometry(RAMPART_THICKNESS, depth, RAMPART_HEIGHT);
  const center = z + RAMPART_HEIGHT / 2;
  return group(
    at(new THREE.Mesh(horizontal, material), 0, halfDepth, center),
    at(new THREE.Mesh(horizontal, material), 0, -halfDepth, center),
    at(new THREE.Mesh(vertical, material), halfWidth, 0, center),
    at(new THREE.Mesh(vertical, material), -halfWidth, 0, center),
  );
}

const BOX_GEOMETRIES = new Map<string, THREE.BoxGeometry>();

function boxGeometry(width: number, depth: number, height: number): THREE.BoxGeometry {
  const key = `${width}:${depth}:${height}`;
  let geometry = BOX_GEOMETRIES.get(key);
  if (!geometry) {
    geometry = new THREE.BoxGeometry(width, depth, height);
    BOX_GEOMETRIES.set(key, geometry);
  }
  return geometry;
}

function at(object: THREE.Object3D, x: number, y: number, z: number): THREE.Object3D {
  object.position.set(x, y, z);
  return object;
}

function group(...children: THREE.Object3D[]): THREE.Group {
  const result = new THREE.Group();
  result.add(...children);
  return result;
}
