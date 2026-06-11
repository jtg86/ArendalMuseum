import * as THREE from 'three';

// Tegner tekstlinjer på et canvas og returnerer en CanvasTexture.
// lines: [{ text, font, color }], tegnes vertikalt fordelt og sentrert.
export function makeTextTexture({ width = 512, height = 128, bg = '#fdfcf8', lines }) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const n = lines.length;
  lines.forEach((line, i) => {
    ctx.font = line.font ?? '28px Georgia';
    ctx.fillStyle = line.color ?? '#2b2117';
    ctx.fillText(line.text, width / 2, height * ((i + 0.5) / n), width - 24);
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function truncate(text, max = 60) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
