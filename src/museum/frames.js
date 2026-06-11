import * as THREE from 'three';
import { PICTURE_HEIGHT, COLORS } from '../config.js';
import { makeTextTexture, truncate } from '../util/textcanvas.js';

// Beregner lerretsmål: fast galleri-høyde, men bredden begrenses
// slik at ekstreme formater ikke sprenger veggplassen.
export function pictureSize(aspect) {
  let h = PICTURE_HEIGHT;
  let w = h * aspect;
  if (w > 1.6) {
    w = 1.6;
    h = w / aspect;
  } else if (w < 0.6) {
    w = 0.6;
    h = Math.min(w / aspect, 1.15);
  }
  return { w, h };
}

// Bygger bilde med ramme og plakett. Returnerer { group, hitMesh }.
// Gruppens origo er midt på lerretet; +Z peker ut fra veggen.
export function buildPicture(item, texture) {
  const { w, h } = pictureSize(item.aspect);
  const group = new THREE.Group();

  const canvas = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: texture })
  );
  canvas.position.z = 0.045;
  group.add(canvas);

  const fw = 0.07; // listebredde
  const fd = 0.06; // dybde ut fra veggen
  const frameMat = new THREE.MeshLambertMaterial({ color: COLORS.frame });
  const horiz = new THREE.BoxGeometry(w + fw * 2, fw, fd);
  const vert = new THREE.BoxGeometry(fw, h, fd);
  for (const [geo, x, y] of [
    [horiz, 0, h / 2 + fw / 2],
    [horiz, 0, -h / 2 - fw / 2],
    [vert, -w / 2 - fw / 2, 0],
    [vert, w / 2 + fw / 2, 0],
  ]) {
    const bar = new THREE.Mesh(geo, frameMat);
    bar.position.set(x, y, fd / 2);
    group.add(bar);
  }

  const plaqueTex = makeTextTexture({
    width: 512,
    height: 160,
    bg: '#fdfcf8',
    lines: [
      { text: truncate(item.title, 52), font: '30px Georgia', color: '#2b2117' },
      { text: `${item.year} — ${truncate(item.creator, 44)}`, font: 'italic 24px Georgia', color: '#6b5d49' },
    ],
  });
  const plaque = new THREE.Mesh(
    new THREE.PlaneGeometry(0.36, 0.1125),
    new THREE.MeshBasicMaterial({ map: plaqueTex })
  );
  plaque.position.set(0, -h / 2 - 0.16, 0.012);
  group.add(plaque);

  canvas.userData = { item, frameMat };
  return { group, hitMesh: canvas, width: w, height: h };
}
