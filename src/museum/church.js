import * as THREE from 'three';
import {
  ROOM_WIDTH, WALL_HEIGHT, RIDGE_HEIGHT, WALL_THICKNESS,
  DOOR_WIDTH, DOOR_HEIGHT, WINDOW_SILL, WINDOW_WIDTH, COLORS,
} from '../config.js';

const half = ROOM_WIDTH / 2;

// --- Prosedyrale teksturer ---

// Stående hvitmalt panel: vertikale plankelinjer, dekker 1 m horisontalt per repetisjon
function makePanelTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f6f4ef';
  ctx.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 32) {
    ctx.fillStyle = 'rgba(190, 185, 172, 0.55)';
    ctx.fillRect(x, 0, 2, 256);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillRect(x + 2, 0, 2, 256);
  }
  // litt støy så flatene ikke blir sterile
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(120, 115, 100, ${Math.random() * 0.04})`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 8);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Furugulv: bord på 0.15 m bredde, repetisjon dekker 1.2 × 2.4 m
function makeFloorTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const ctx = c.getContext('2d');
  const boardW = 32; // 8 bord per repetisjon
  for (let x = 0; x < 256; x += boardW) {
    const tone = 196 + Math.floor(Math.random() * 24) - 12;
    ctx.fillStyle = `rgb(${tone}, ${Math.floor(tone * 0.82)}, ${Math.floor(tone * 0.55)})`;
    ctx.fillRect(x, 0, boardW, 512);
    // skjøter
    const joint = Math.floor(Math.random() * 512);
    ctx.fillStyle = 'rgba(90, 70, 40, 0.5)';
    ctx.fillRect(x, joint, boardW, 2);
    // bordskiller
    ctx.fillStyle = 'rgba(80, 60, 35, 0.6)';
    ctx.fillRect(x, 0, 2, 512);
    // treårer
    for (let i = 0; i < 14; i++) {
      ctx.strokeStyle = `rgba(120, 90, 50, ${0.05 + Math.random() * 0.08})`;
      ctx.beginPath();
      const gx = x + 4 + Math.random() * (boardW - 8);
      ctx.moveTo(gx, 0);
      ctx.bezierCurveTo(gx + 6, 170, gx - 6, 340, gx, 512);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeLightPoolTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
  g.addColorStop(0, 'rgba(255, 240, 200, 0.55)');
  g.addColorStop(1, 'rgba(255, 240, 200, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// --- Bygging ---

export function buildChurch(layout) {
  const group = new THREE.Group();
  const panelTex = makePanelTexture();
  const totalLen = layout.totalLength;

  const wallMat = (sx, sz, height) => {
    const tex = panelTex.clone();
    tex.needsUpdate = true;
    tex.repeat.set(Math.max(sx, sz), height / WALL_HEIGHT);
    return new THREE.MeshLambertMaterial({ map: tex });
  };
  const trimMat = new THREE.MeshLambertMaterial({ color: COLORS.trim });
  const beamMat = new THREE.MeshLambertMaterial({ color: COLORS.beam });

  // Vegger (samme bokser som kollisjonen bruker)
  for (const w of layout.walls) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w.sx, WALL_HEIGHT, w.sz),
      wallMat(w.sx, w.sz, WALL_HEIGHT)
    );
    mesh.position.set(w.cx, WALL_HEIGHT / 2, w.cz);
    group.add(mesh);
  }

  // Gavlfyll over tverrvegger (inngang, bakvegg, delevegger) opp til mønet.
  // Boksene stikker utenfor takflatene utvendig, men det er usynlig innenfra.
  const gableZs = [0, -totalLen, ...layout.doorways.map((d) => d.z)];
  for (const z of gableZs) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(ROOM_WIDTH + WALL_THICKNESS, RIDGE_HEIGHT - WALL_HEIGHT, WALL_THICKNESS),
      wallMat(ROOM_WIDTH, WALL_THICKNESS, RIDGE_HEIGHT - WALL_HEIGHT)
    );
    mesh.position.set(0, (WALL_HEIGHT + RIDGE_HEIGHT) / 2, z);
    group.add(mesh);
  }

  // Overstykke og karm rundt døråpningene
  for (const d of layout.doorways) {
    const lintel = new THREE.Mesh(
      new THREE.BoxGeometry(DOOR_WIDTH, WALL_HEIGHT - DOOR_HEIGHT, WALL_THICKNESS),
      wallMat(DOOR_WIDTH, WALL_THICKNESS, WALL_HEIGHT - DOOR_HEIGHT)
    );
    lintel.position.set(0, (WALL_HEIGHT + DOOR_HEIGHT) / 2, d.z);
    group.add(lintel);
    // hvit gerikt rundt åpningen, begge sider
    for (const side of [-1, 1]) {
      const zc = d.z + side * (WALL_THICKNESS / 2 + 0.02);
      const top = new THREE.Mesh(new THREE.BoxGeometry(DOOR_WIDTH + 0.3, 0.15, 0.04), trimMat);
      top.position.set(0, DOOR_HEIGHT + 0.07, zc);
      group.add(top);
      for (const sx of [-1, 1]) {
        const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.15, DOOR_HEIGHT, 0.04), trimMat);
        jamb.position.set(sx * (DOOR_WIDTH / 2 + 0.07), DOOR_HEIGHT / 2, zc);
        group.add(jamb);
      }
    }
  }

  // Gulv
  const floorTex = makeFloorTexture();
  floorTex.repeat.set(ROOM_WIDTH / 1.2, totalLen / 2.4);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_WIDTH, totalLen),
    new THREE.MeshLambertMaterial({ map: floorTex })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, -totalLen / 2);
  group.add(floor);

  // Gulvlist langs langveggene
  for (const side of [-1, 1]) {
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, totalLen), trimMat);
    skirt.position.set(side * (half - WALL_THICKNESS / 2 - 0.02), 0.08, -totalLen / 2);
    group.add(skirt);
  }

  // Takflater (synlig underside innenfra)
  const slope = Math.hypot(half, RIDGE_HEIGHT - WALL_HEIGHT);
  const angle = Math.atan2(RIDGE_HEIGHT - WALL_HEIGHT, half);
  const ceilMat = new THREE.MeshLambertMaterial({ color: 0xf8f6f1, side: THREE.DoubleSide });
  for (const side of [-1, 1]) {
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(slope, totalLen + WALL_THICKNESS), ceilMat);
    roof.rotation.order = 'ZXY';
    roof.rotation.x = -Math.PI / 2;
    roof.rotation.z = side * angle;
    roof.position.set(-side * half / 2, (WALL_HEIGHT + RIDGE_HEIGHT) / 2, -totalLen / 2);
    group.add(roof);
  }

  // Hanebjelker med kongestolpe (hopper over deleveggene)
  for (let z = -4; z > -totalLen; z -= 4) {
    if (layout.doorways.some((d) => Math.abs(d.z - z) < 0.5)) continue;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(ROOM_WIDTH + 0.2, 0.18, 0.18), beamMat);
    beam.position.set(0, WALL_HEIGHT - 0.09, z);
    group.add(beam);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, RIDGE_HEIGHT - WALL_HEIGHT, 0.15), beamMat);
    post.position.set(0, (WALL_HEIGHT + RIDGE_HEIGHT) / 2 - 0.09, z);
    group.add(post);
  }

  // Buevinduer høyt på langveggene
  buildWindows(group, layout);

  // Lysflekker på gulvet under solsidens vinduer
  const poolTex = makeLightPoolTexture();
  const poolMat = new THREE.MeshBasicMaterial({
    map: poolTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.6,
  });
  for (const w of layout.windows) {
    if (w.side !== 1) continue;
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3.2), poolMat);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(3.2, 0.012, w.z);
    group.add(pool);
  }

  // Lysekroner (selve armaturen — lyskildene settes i lighting.js)
  const metalMat = new THREE.MeshLambertMaterial({ color: COLORS.metal });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe6b0 });
  for (const ch of layout.chandeliers) {
    const g = new THREE.Group();
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, RIDGE_HEIGHT - 3.7, 6), metalMat);
    rod.position.y = (RIDGE_HEIGHT + 3.7) / 2;
    g.add(rod);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.035, 8, 24), metalMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 3.7;
    g.add(ring);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), bulbMat);
      bulb.position.set(Math.cos(a) * 0.45, 3.78, Math.sin(a) * 0.45);
      g.add(bulb);
    }
    g.position.z = ch.z;
    group.add(g);
  }

  return group;
}

function buildWindows(group, layout) {
  const W = WINDOW_WIDTH;          // innvendig bredde
  const rectH = 1.0;               // rett del over karmbunn
  const border = 0.1;              // karmbredde

  const archShape = (w, h, yOff) => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, yOff);
    s.lineTo(w / 2, yOff);
    s.lineTo(w / 2, yOff + h);
    s.absarc(0, yOff + h, w / 2, 0, Math.PI, false);
    s.lineTo(-w / 2, yOff);
    return s;
  };

  const outer = archShape(W + border * 2, rectH, 0);
  outer.holes.push(archShape(W, rectH, border));
  const casingGeo = new THREE.ExtrudeGeometry(outer, { depth: 0.08, bevelEnabled: false });
  const glassGeo = new THREE.ShapeGeometry(archShape(W, rectH, border));
  const casingMat = new THREE.MeshLambertMaterial({ color: COLORS.trim });
  const glassMat = new THREE.MeshBasicMaterial({ color: COLORS.windowGlow });
  const muntinMat = new THREE.MeshLambertMaterial({ color: COLORS.trim });
  const innerH = rectH + W / 2; // rett del + bue

  for (const w of layout.windows) {
    const g = new THREE.Group();
    const casing = new THREE.Mesh(casingGeo, casingMat);
    g.add(casing);
    const glass = new THREE.Mesh(glassGeo, glassMat);
    glass.position.z = 0.015;
    g.add(glass);
    const muntinV = new THREE.Mesh(new THREE.BoxGeometry(0.035, innerH, 0.02), muntinMat);
    muntinV.position.set(0, border + innerH / 2, 0.03);
    g.add(muntinV);
    const muntinH = new THREE.Mesh(new THREE.BoxGeometry(W, 0.035, 0.02), muntinMat);
    muntinH.position.set(0, border + rectH * 0.55, 0.03);
    g.add(muntinH);

    const surfaceX = w.side * (half - WALL_THICKNESS / 2);
    g.position.set(surfaceX, WINDOW_SILL, w.z);
    g.rotation.y = w.side * -Math.PI / 2; // ekstruderingsretningen (+Z) inn i rommet
    group.add(g);
  }
}
