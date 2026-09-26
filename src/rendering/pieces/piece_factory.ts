import type * as THREE from "three";

export type RampartLevel = 1 | 2;

export interface PieceFactory {
  village(color: number): THREE.Object3D;
  city(color: number): THREE.Object3D;
  army(color: number): THREE.Object3D;
  rampart(level: RampartLevel, halfWidth: number, halfDepth: number): THREE.Object3D;
  temple(): THREE.Object3D;
}
