import * as THREE from 'three';
import { PICTURE_CENTER_Y, PICTURE_GAP, SEGMENT_MARGIN } from '../config.js';
import { buildPicture, pictureSize } from './frames.js';
import { makeSign } from './signage.js';

// Henger opp et roms bilder: kategoriene legges ut som sammenhengende grupper
// over rommets veggsegmenter, med kategoriskilt over hver gruppe.
// Returnerer hitMeshes for raycasting.
export function hangRoom(scene, room, items, categories, textureMap) {
  const hitMeshes = [];
  // per segment: liste av { item, center } (avstand langs segmentet)
  const bySegment = room.segments.map(() => []);
  // kategoriskilt: per (kategori, segment): { catId, segIdx, tMin, tMax }
  const signSpans = [];

  // Største kategorier først, så de får langveggene
  const order = [...categories]
    .map((c) => ({ ...c, items: items.filter((i) => i.category === c.id) }))
    .filter((c) => c.items.length > 0)
    .sort((a, b) => b.items.length - a.items.length);

  let segIdx = 0;
  let cursor = SEGMENT_MARGIN;
  const dropped = [];

  for (const cat of order) {
    let span = null;
    for (const item of cat.items) {
      const { w } = pictureSize(item.aspect);
      // finn et segment med plass
      while (
        segIdx < room.segments.length &&
        cursor + w > room.segments[segIdx].length - SEGMENT_MARGIN
      ) {
        if (span) signSpans.push(span);
        span = null;
        segIdx++;
        cursor = SEGMENT_MARGIN;
      }
      if (segIdx >= room.segments.length) {
        dropped.push(item);
        continue;
      }
      const center = cursor + w / 2;
      bySegment[segIdx].push({ item, center });
      if (!span || span.segIdx !== segIdx) {
        if (span) signSpans.push(span);
        span = { catId: cat.id, label: cat.label, segIdx, tMin: cursor, tMax: cursor + w };
      } else {
        span.tMax = cursor + w;
      }
      cursor += w + PICTURE_GAP;
    }
    if (span) signSpans.push(span);
  }
  if (dropped.length > 0) {
    console.warn(`Rom «${room.label}»: ${dropped.length} bilder fikk ikke veggplass og vises ikke.`);
  }

  // Sentrer innholdet i hvert segment
  const shifts = room.segments.map((seg, i) => {
    const placed = bySegment[i];
    if (placed.length === 0) return 0;
    const last = placed[placed.length - 1];
    const { w: lastW } = pictureSize(last.item.aspect);
    const usedEnd = last.center + lastW / 2;
    return (seg.length - SEGMENT_MARGIN - usedEnd) / 2;
  });

  // Bygg mesh-ene
  for (let i = 0; i < room.segments.length; i++) {
    const seg = room.segments[i];
    const rotY = Math.atan2(seg.nx, seg.nz);
    for (const { item, center } of bySegment[i]) {
      const t = center + shifts[i];
      const { group, hitMesh } = buildPicture(item, textureMap.get(item.id));
      group.position.set(
        seg.x + seg.dx * t + seg.nx * 0.01,
        PICTURE_CENTER_Y,
        seg.z + seg.dz * t + seg.nz * 0.01
      );
      group.rotation.y = rotY;
      scene.add(group);
      hitMeshes.push(hitMesh);
    }
  }

  // Kategoriskilt over gruppene
  for (const span of signSpans) {
    const seg = room.segments[span.segIdx];
    const t = (span.tMin + span.tMax) / 2 + shifts[span.segIdx];
    const sign = makeSign(span.label, 1.1, 0.2);
    sign.position.set(
      seg.x + seg.dx * t + seg.nx * 0.02,
      2.32,
      seg.z + seg.dz * t + seg.nz * 0.02
    );
    sign.rotation.y = Math.atan2(seg.nx, seg.nz);
    scene.add(sign);
  }

  return hitMeshes;
}
