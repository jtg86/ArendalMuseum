import * as THREE from 'three';

// Laster 512px-teksturene for alle bildene med fremdriftsrapport.
// Returnerer Map<itemId, Texture>.
export function loadPictureTextures(items, maxAnisotropy, onProgress) {
  return new Promise((resolve) => {
    if (items.length === 0) return resolve(new Map());
    const manager = new THREE.LoadingManager();
    const loader = new THREE.TextureLoader(manager);
    const map = new Map();
    let done = 0;
    manager.onLoad = () => resolve(map);
    for (const item of items) {
      const tex = loader.load(
        item.src512,
        () => onProgress(++done, items.length),
        undefined,
        () => {
          console.warn(`Kunne ikke laste tekstur: ${item.src512}`);
          onProgress(++done, items.length);
        }
      );
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = Math.min(8, maxAnisotropy);
      map.set(item.id, tex);
    }
  });
}
