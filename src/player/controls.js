import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { MOVE_SPEED, EYE_HEIGHT } from '../config.js';
import { resolveMovement } from './collision.js';

const KEY_FORWARD = new Set(['KeyW', 'ArrowUp']);
const KEY_BACK = new Set(['KeyS', 'ArrowDown']);
const KEY_LEFT = new Set(['KeyA', 'ArrowLeft']);
const KEY_RIGHT = new Set(['KeyD', 'ArrowRight']);

export class Player {
  constructor(camera, domElement) {
    this.camera = camera;
    this.controls = new PointerLockControls(camera, domElement);
    this.keys = new Set();
    this._forward = new THREE.Vector3();
    this._right = new THREE.Vector3();
    camera.position.set(0, EYE_HEIGHT, -2.5);

    document.addEventListener('keydown', (e) => this.keys.add(e.code));
    document.addEventListener('keyup', (e) => this.keys.delete(e.code));
    // Mistede keyup-events (alt-tab) skal ikke gi evig bevegelse
    window.addEventListener('blur', () => this.keys.clear());
  }

  get isLocked() {
    return this.controls.isLocked;
  }

  update(delta, colliders) {
    if (!this.controls.isLocked) return;
    const dt = Math.min(delta, 0.05); // mot tunneling etter bakgrunnsfane
    let f = 0;
    let r = 0;
    for (const k of this.keys) {
      if (KEY_FORWARD.has(k)) f += 1;
      else if (KEY_BACK.has(k)) f -= 1;
      else if (KEY_RIGHT.has(k)) r += 1;
      else if (KEY_LEFT.has(k)) r -= 1;
    }
    if (f === 0 && r === 0) return;

    this.camera.getWorldDirection(this._forward);
    this._forward.y = 0;
    this._forward.normalize();
    this._right.crossVectors(this._forward, this.camera.up).normalize();

    const dx = (this._forward.x * f + this._right.x * r);
    const dz = (this._forward.z * f + this._right.z * r);
    const len = Math.hypot(dx, dz);
    if (len === 0) return;
    const scale = (MOVE_SPEED * dt) / len;
    resolveMovement(this.camera.position, dx * scale, dz * scale, colliders);
    this.camera.position.y = EYE_HEIGHT;
  }
}
