import type * as THREE_TYPES from "three";

type Group = THREE_TYPES.Group;

const CACHE = new Map<string, Promise<Group | null>>();

/** Loads a GLB/GLTF file and returns its scene group (cached per URL). */
export function loadGlb(url: string): Promise<Group | null> {
  const hit = CACHE.get(url);
  if (hit) return hit;
  const p = (async () => {
    try {
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync(url);
      return gltf.scene as Group;
    } catch {
      return null;
    }
  })();
  CACHE.set(url, p);
  return p;
}

/** Clone a loaded model so multiple instances can be placed in one scene. */
export async function instantiateGlb(url: string): Promise<Group | null> {
  const base = await loadGlb(url);
  if (!base) return null;
  return base.clone(true) as Group;
}

/**
 * Scales/centers a model so it stands on y=0, is centered on X/Z,
 * and is exactly `targetHeight` units tall.
 */
export async function fitModel(model: Group, targetHeight: number) {
  const THREE = await import("three");
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  box.getSize(size);
  const h = size.y || 1;
  const s = targetHeight / h;
  model.scale.setScalar(s);

  const box2 = new THREE.Box3().setFromObject(model);
  const center = new THREE.Vector3();
  box2.getCenter(center);
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= box2.min.y;
  return model;
}
