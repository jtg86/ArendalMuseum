import * as THREE from 'three';
import { INTERACT_DISTANCE, COLORS } from '../config.js';

// Stråle fra skjermsenter mot bildelerretene; fremhever rammen og viser hint.
export class Interactor {
  constructor(camera) {
    this.camera = camera;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = INTERACT_DISTANCE;
    this.hitMeshes = [];
    this.hovered = null;
    this.hintEl = document.getElementById('hint');
    this._frame = 0;
    this._center = new THREE.Vector2(0, 0);
  }

  register(meshes) {
    this.hitMeshes.push(...meshes);
  }

  update(enabled) {
    this._frame++;
    if (this._frame % 2 !== 0) return;
    let hit = null;
    if (enabled) {
      this.raycaster.setFromCamera(this._center, this.camera);
      const hits = this.raycaster.intersectObjects(this.hitMeshes, false);
      if (hits.length > 0) hit = hits[0].object;
    }
    if (hit === this.hovered) return;
    if (this.hovered) this.hovered.userData.frameMat.color.setHex(COLORS.frame);
    this.hovered = hit;
    if (hit) {
      hit.userData.frameMat.color.setHex(COLORS.frameHighlight);
      this.hintEl.classList.remove('hidden');
    } else {
      this.hintEl.classList.add('hidden');
    }
  }
}
