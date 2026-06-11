import {
  ROOM_WIDTH, ROOM_LENGTH, WALL_THICKNESS, DOOR_WIDTH,
} from '../config.js';

// Bygger romplanen: ett rom per periode, på rad langs negativ Z.
// Veggsegmentene er den ene kilden til sannhet for geometri, opphenging og kollisjon.
export function buildLayout(periods) {
  const W = ROOM_WIDTH;
  const L = ROOM_LENGTH;
  const T = WALL_THICKNESS;
  const half = W / 2;
  const doorHalf = DOOR_WIDTH / 2;
  const inset = T / 2; // veggboksene sentreres på romgrensen; innvendig flate ligger inset inn
  const count = periods.length;
  const totalLength = count * L;

  const rooms = periods.map((p, i) => ({
    index: i,
    period: p.id,
    label: p.label,
    zMax: -i * L,
    zMin: -(i + 1) * L,
    segments: [],
  }));

  // Kollisjons-/geometribokser i XZ-planet { cx, cz, sx, sz }
  const walls = [
    { cx: -half, cz: -totalLength / 2, sx: T, sz: totalLength + T }, // venstre langvegg
    { cx: half, cz: -totalLength / 2, sx: T, sz: totalLength + T },  // høyre langvegg
    { cx: 0, cz: 0, sx: W + T, sz: T },                              // inngangsvegg
    { cx: 0, cz: -totalLength, sx: W + T, sz: T },                   // bakvegg
  ];

  const doorways = [];
  for (let i = 1; i < count; i++) {
    const z = -i * L;
    walls.push({ cx: -(half + doorHalf) / 2, cz: z, sx: half - doorHalf, sz: T });
    walls.push({ cx: (half + doorHalf) / 2, cz: z, sx: half - doorHalf, sz: T });
    doorways.push({ z, fromRoom: i - 1, toRoom: i });
  }

  // Veggsegmenter for opphenging: { x, z, dx, dz, nx, nz, length }
  // (x,z) er startpunktet på innvendig veggflate, (dx,dz) retning langs veggen,
  // (nx,nz) normal inn i rommet.
  const seg = (x, z, dx, dz, nx, nz, length) => ({ x, z, dx, dz, nx, nz, length });
  for (const room of rooms) {
    const hasDoorFront = room.index > 0;          // veggen ved zMax (mot inngangen)
    const hasDoorBack = room.index < count - 1;   // veggen ved zMin (dypere inn)

    // Venstre langvegg (x = -half), normal +X
    room.segments.push(seg(-half + inset, room.zMax, 0, -1, 1, 0, L));
    // Høyre langvegg (x = +half), normal -X
    room.segments.push(seg(half - inset, room.zMin, 0, 1, -1, 0, L));

    // Bakre tverrvegg-flate (z = zMin), normal +Z
    const zb = room.zMin + inset;
    if (hasDoorBack) {
      room.segments.push(seg(-half, zb, 1, 0, 0, 1, half - doorHalf));
      room.segments.push(seg(doorHalf, zb, 1, 0, 0, 1, half - doorHalf));
    } else {
      room.segments.push(seg(-half, zb, 1, 0, 0, 1, W));
    }

    // Fremre tverrvegg-flate (z = zMax), normal -Z
    const zf = room.zMax - inset;
    if (hasDoorFront) {
      room.segments.push(seg(-half, zf, 1, 0, 0, -1, half - doorHalf));
      room.segments.push(seg(doorHalf, zf, 1, 0, 0, -1, half - doorHalf));
    } else {
      room.segments.push(seg(-half, zf, 1, 0, 0, -1, W));
    }
  }

  // Vinduer høyt på langveggene: to per rom per side
  const windows = [];
  for (const room of rooms) {
    for (const zOff of [4, 12]) {
      windows.push({ side: -1, z: room.zMax - zOff }); // venstre (x = -half)
      windows.push({ side: 1, z: room.zMax - zOff });  // høyre (x = +half)
    }
  }

  // Lysekroner: to per rom langs mønet
  const chandeliers = [];
  for (const room of rooms) {
    chandeliers.push({ z: room.zMax - 5 });
    chandeliers.push({ z: room.zMax - 11 });
  }

  return { rooms, walls, doorways, windows, chandeliers, totalLength };
}

// Hvilket rom er spilleren i, gitt z-posisjon?
export function roomIndexAt(z) {
  return Math.max(0, Math.min(2, Math.floor(-z / ROOM_LENGTH)));
}
