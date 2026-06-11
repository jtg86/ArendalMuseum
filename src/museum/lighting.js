import * as THREE from 'three';

// «Baked»-følelse uten shadow maps: jevn grunnbelysning + retningslys
// som later som sol gjennom vinduene + punktlys i lysekronene.
export function buildLighting(scene, layout) {
  scene.add(new THREE.AmbientLight(0xfff8ee, 0.85));

  const hemi = new THREE.HemisphereLight(0xeaf2ff, 0xcaa97a, 0.55);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff3dd, 1.4);
  sun.position.set(6, 8, -layout.totalLength / 2 + 4);
  sun.target.position.set(-2, 0, -layout.totalLength / 2);
  scene.add(sun);
  scene.add(sun.target);

  for (const ch of layout.chandeliers) {
    const p = new THREE.PointLight(0xffe6b0, 12, 14, 1.6);
    p.position.set(0, 3.6, ch.z);
    scene.add(p);
  }
}
