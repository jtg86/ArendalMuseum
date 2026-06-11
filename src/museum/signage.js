import * as THREE from 'three';
import { WALL_THICKNESS, DOOR_HEIGHT } from '../config.js';
import { makeTextTexture } from '../util/textcanvas.js';

// Lite veggskilt med tekst, festes på veggflate (plan vendt mot +Z før rotasjon).
export function makeSign(text, width = 1.1, height = 0.2) {
  const tex = makeTextTexture({
    width: 512,
    height: Math.round(512 * (height / width)),
    bg: '#3d4a3e', // dempet museumsgrønn
    lines: [{ text, font: 'small-caps 44px Georgia', color: '#efe9da' }],
  });
  return new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: tex })
  );
}

// Periodeskilt over døråpningene (begge sider) og museumstittel ved inngangen.
export function buildRoomSigns(scene, layout) {
  for (const d of layout.doorways) {
    const toLabel = layout.rooms[d.toRoom].label;
    const fromLabel = layout.rooms[d.fromRoom].label;
    // skilt mot rommet man kommer fra, viser hva man går inn i
    const signTo = makeSign(toLabel, 1.8, 0.32);
    signTo.position.set(0, DOOR_HEIGHT + 0.45, d.z + WALL_THICKNESS / 2 + 0.03);
    scene.add(signTo);
    const signFrom = makeSign(fromLabel, 1.8, 0.32);
    signFrom.position.set(0, DOOR_HEIGHT + 0.45, d.z - WALL_THICKNESS / 2 - 0.03);
    signFrom.rotation.y = Math.PI;
    scene.add(signFrom);
  }

  // Tittel + første periode på inngangsveggen (innsiden, vendt mot -Z)
  const title = makeSign('Arendal-museet', 3.0, 0.5);
  title.position.set(0, 3.6, -WALL_THICKNESS / 2 - 0.03);
  title.rotation.y = Math.PI;
  scene.add(title);
  const firstPeriod = makeSign(layout.rooms[0].label, 1.8, 0.32);
  firstPeriod.position.set(0, 3.0, -WALL_THICKNESS / 2 - 0.03);
  firstPeriod.rotation.y = Math.PI;
  scene.add(firstPeriod);
}
