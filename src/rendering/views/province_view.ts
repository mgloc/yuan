import * as THREE from "three";
import { Building, type Province } from "../../game_types.ts";
import type { PieceFactory } from "../pieces/piece_factory.ts";

const DOUBLED_CITY_OFFSET = 0.22;
const RAMPART_MARGIN = 0.28;
const SIDE_SLOT_DISTANCE = 1.0;
const ARMY_ANCHOR_ANGLE = (11 * Math.PI) / 6;
const TEMPLE_ANCHOR_ANGLE = (7 * Math.PI) / 6;
const ARMY_SPREAD = 0.24;
const PIECE_SCALE = 1.6;
const TEMPLE_SCALE = 1.5;

export class ProvinceView {
  root: THREE.Group;
  private factory: PieceFactory;

  constructor(parent: THREE.Object3D, factory: PieceFactory, z: number) {
    this.root = new THREE.Group();
    this.root.position.z = z;
    this.factory = factory;
    parent.add(this.root);
  }

  private add(piece: THREE.Object3D): THREE.Object3D {
    piece.scale.setScalar(PIECE_SCALE);
    this.root.add(piece);
    return piece;
  }

  update(province: Province | null, ownerColor: number | null) {
    this.root.clear();
    if (province === null) {
      return;
    }

    const hasBuilding = province.building !== null && ownerColor !== null;
    if (hasBuilding) {
      this.addBuilding(province, ownerColor);
    }

    if (province.temple) {
      const temple = this.add(this.factory.temple());
      temple.scale.multiplyScalar(TEMPLE_SCALE);
      if (hasBuilding) {
        temple.position.copy(sideSlot(TEMPLE_ANCHOR_ANGLE));
        temple.rotation.z = TEMPLE_ANCHOR_ANGLE + Math.PI / 2;
      }
    }

    if (ownerColor !== null) {
      this.addArmies(province.armies, ownerColor);
    }
  }

  private addBuilding(province: Province, color: number) {
    if (province.building === Building.Village) {
      this.add(this.factory.village(color));
      return;
    }

    const offsets = province.doubled ? [-DOUBLED_CITY_OFFSET, DOUBLED_CITY_OFFSET] : [0];
    for (const offset of offsets) {
      this.add(this.factory.city(color)).position.x = offset * PIECE_SCALE;
    }

    if (province.ramparts > 0) {
      const halfWidth = RAMPART_MARGIN + (province.doubled ? DOUBLED_CITY_OFFSET : 0);
      this.add(this.factory.rampart(province.ramparts as 1 | 2, halfWidth, RAMPART_MARGIN));
    }
  }

  private addArmies(count: number, color: number) {
    const anchor = sideSlot(ARMY_ANCHOR_ANGLE);
    for (let i = 0; i < count; i++) {
      const angle = ARMY_ANCHOR_ANGLE + (i * 2 * Math.PI) / count;
      this.add(this.factory.army(color)).position.set(
        anchor.x + (count > 1 ? Math.cos(angle) * ARMY_SPREAD : 0),
        anchor.y + (count > 1 ? Math.sin(angle) * ARMY_SPREAD : 0),
        0,
      );
    }
  }
}

function sideSlot(angle: number): THREE.Vector3 {
  return new THREE.Vector3(Math.cos(angle) * SIDE_SLOT_DISTANCE, Math.sin(angle) * SIDE_SLOT_DISTANCE, 0);
}
