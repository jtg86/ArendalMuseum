import { PLAYER_RADIUS } from '../config.js';

// Bygger AABB-er i XZ-planet fra veggboksene, utvidet med spillerradius.
export function buildColliders(walls) {
  return walls.map((w) => ({
    minX: w.cx - w.sx / 2 - PLAYER_RADIUS,
    maxX: w.cx + w.sx / 2 + PLAYER_RADIUS,
    minZ: w.cz - w.sz / 2 - PLAYER_RADIUS,
    maxZ: w.cz + w.sz / 2 + PLAYER_RADIUS,
  }));
}

function hits(x, z, colliders) {
  for (const c of colliders) {
    if (x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ) return true;
  }
  return false;
}

// Per-akse-oppløsning gir gratis "sliding" langs vegger og håndterer hjørner.
export function resolveMovement(position, dx, dz, colliders) {
  const nx = position.x + dx;
  if (!hits(nx, position.z, colliders)) position.x = nx;
  const nz = position.z + dz;
  if (!hits(position.x, nz, colliders)) position.z = nz;
}
