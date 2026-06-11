import * as THREE from 'three';
import './style.css';
import { buildLayout, roomIndexAt } from './museum/layout.js';
import { buildChurch } from './museum/church.js';
import { buildLighting } from './museum/lighting.js';
import { hangRoom } from './museum/hanging.js';
import { buildRoomSigns } from './museum/signage.js';
import { buildColliders } from './player/collision.js';
import { Player } from './player/controls.js';
import { Interactor } from './interact/raycaster.js';
import { Overlay } from './interact/overlay.js';
import { loadPictureTextures } from './util/textures.js';

const loadingEl = document.getElementById('loading');
const loadingStatus = document.getElementById('loading-status');
const blockerEl = document.getElementById('blocker');
const blockerCta = document.getElementById('blocker-cta');
const hudEl = document.getElementById('hud');
const toastEl = document.getElementById('toast');

async function init() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xdfe8f0);
  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 120);

  // BASE_URL gjør at museet også kan serveres under en understi (f.eks. /museum/)
  const base = import.meta.env.BASE_URL;
  const manifest = await (await fetch(`${base}data/manifest.json`)).json();
  for (const item of manifest.items) {
    item.src = base + item.src.replace(/^\//, '');
    item.src512 = base + item.src512.replace(/^\//, '');
  }
  const layout = buildLayout(manifest.periods);

  scene.add(buildChurch(layout));
  buildLighting(scene, layout);
  buildRoomSigns(scene, layout);

  const textureMap = await loadPictureTextures(
    manifest.items,
    renderer.capabilities.getMaxAnisotropy(),
    (done, total) => {
      loadingStatus.textContent = `Henter bilder … ${done}/${total}`;
    }
  );

  const interactor = new Interactor(camera);
  for (const room of layout.rooms) {
    const items = manifest.items.filter((i) => i.period === room.period);
    interactor.register(hangRoom(scene, room, items, manifest.categories, textureMap));
  }

  const colliders = buildColliders(layout.walls);
  const player = new Player(camera, renderer.domElement);
  const overlay = new Overlay(manifest.categories, manifest.periods);

  // --- UI-flyt: lasteskjerm → blocker → pekerlås → museet ---
  loadingEl.classList.add('hidden');
  blockerEl.classList.remove('hidden');

  blockerEl.addEventListener('click', () => player.controls.lock());
  player.controls.addEventListener('lock', () => {
    blockerEl.classList.add('hidden');
    hudEl.classList.remove('hidden');
  });
  player.controls.addEventListener('unlock', () => {
    hudEl.classList.add('hidden');
    if (!overlay.isOpen) {
      blockerCta.textContent = 'Klikk for å fortsette';
      blockerEl.classList.remove('hidden');
    }
  });

  overlay.onClose = (fromClick) => {
    if (fromClick) {
      player.controls.lock();
    } else {
      blockerCta.textContent = 'Klikk for å fortsette';
      blockerEl.classList.remove('hidden');
    }
  };

  const tryOpenHovered = () => {
    if (interactor.hovered && !overlay.isOpen) {
      const { item } = interactor.hovered.userData;
      player.controls.unlock();
      overlay.open(item);
    }
  };
  document.addEventListener('mousedown', () => {
    if (player.isLocked) tryOpenHovered();
  });
  document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyE') {
      if (overlay.isOpen) {
        overlay.close(true);
        // Tastetrykk regnes som brukeraktivering, men hvis nettleseren likevel
        // nekter å gjenopprette pekerlåsen, fall tilbake til blokkeren.
        setTimeout(() => {
          if (!player.isLocked && !overlay.isOpen) {
            blockerCta.textContent = 'Klikk for å fortsette';
            blockerEl.classList.remove('hidden');
          }
        }, 300);
      } else if (player.isLocked) {
        tryOpenHovered();
      }
    }
    if (e.code === 'Escape' && overlay.isOpen) overlay.close(false);
  });

  // Romnavn-toast ved dørpassering
  let currentRoom = -1;
  let toastTimer = 0;
  function maybeToast() {
    const idx = roomIndexAt(camera.position.z);
    if (idx !== currentRoom) {
      currentRoom = idx;
      toastEl.textContent = layout.rooms[idx].label;
      toastEl.classList.remove('hidden');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toastEl.classList.add('hidden'), 2200);
    }
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Debug-krok for inspeksjon fra konsollen under utvikling
  window.__museum = { camera, renderer, scene, layout, player, overlay, interactor, colliders };

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const delta = clock.getDelta();
    player.update(delta, colliders);
    interactor.update(player.isLocked);
    if (player.isLocked) maybeToast();
    renderer.render(scene, camera);
  });
}

init().catch((err) => {
  loadingStatus.textContent = `Noe gikk galt: ${err.message}. Har du kjørt «npm run fetch-data»?`;
  console.error(err);
});
