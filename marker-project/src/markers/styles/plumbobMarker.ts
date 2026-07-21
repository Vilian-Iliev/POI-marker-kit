import * as THREE from "three";
import { type PoiData, type MarkerState } from "../markerStateMachine";

// SIMS-STYLE PLUMBBOB (life marker)
// Green rhombus-based double pyramid that spins and bobs.
export function createMarker(position: THREE.Vector3, data: PoiData) {
  const container = new THREE.Object3D();
  container.position.copy(position);

  // Main plumbob: an elongated octahedron (bipyramid)
  const gemGeom = new THREE.OctahedronGeometry(0.5, 0);
  const gemMat = new THREE.MeshStandardMaterial({
    color: 0x3fe63f,
    emissive: 0x1fcf1f,
    emissiveIntensity: 0.9,
    metalness: 0.1,
    roughness: 0.2,
    transparent: true,
  });
  const plumbob = new THREE.Mesh(gemGeom, gemMat);
  plumbob.scale.set(1.0, 1.6, 1.0);
  plumbob.rotation.order = "YXZ";
  container.add(plumbob);

  // Subtle base ring
  const baseGeo = new THREE.RingGeometry(0.8, 0.95, 32);
  const baseMat = new THREE.MeshBasicMaterial({
    color: 0x0b0b0b,
    opacity: 0.6,
    transparent: true,
    side: THREE.DoubleSide,
  });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.rotation.x = -Math.PI / 2;
  base.position.y = -0.9;
  container.add(base);

  // Text label: canvas texture on a small plane (shows POI name)
  const makeLabel = (text = "") => {
    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, size, 128);
    ctx.fillStyle = "rgba(0,0,0,0.0)";
    ctx.fillRect(0, 0, size, 128);
    ctx.font = "48px sans-serif";
    ctx.fillStyle = "#e6ffe6";
    ctx.textAlign = "center";
    ctx.fillText(text, size / 2, 80);
    const texture = new THREE.CanvasTexture(canvas);
    // Typings may mismatch between three and @types/three (encoding vs colorSpace).
    // Cast to any to keep runtime behavior while avoiding TS errors.
    (texture as any).encoding = (THREE as any).sRGBEncoding;
    const mat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.6, 0.4, 1);
    return { sprite, texture };
  };

  const labelObj = makeLabel(data?.name ?? "");
  labelObj.sprite.position.y = 1.1;
  container.add(labelObj.sprite);

  let elapsed = 0;
  let currentOpacity = 0;

  return {
    mesh: container,

    update(dtSeconds: number, state: MarkerState) {
      elapsed += dtSeconds;

      // Fade control
      if (state === "hidden") currentOpacity = 0;
      else if (state === "revealing")
        currentOpacity = Math.min(1, currentOpacity + dtSeconds * 1.5);
      else if (state === "hiding")
        currentOpacity = Math.max(0, currentOpacity - dtSeconds * 2.0);

      // Bob and rotate
      plumbob.position.y = Math.sin(elapsed * 1.8) * 0.08;
      plumbob.rotation.y += dtSeconds * 1.6; // spins around itself
      plumbob.rotation.x = Math.sin(elapsed * 0.7) * 0.06;

      // Glow pulse
      gemMat.emissiveIntensity = 0.7 + Math.sin(elapsed * 3.0) * 0.25;
      gemMat.opacity = currentOpacity;
      baseMat.opacity = currentOpacity * 0.6;
      (labelObj.sprite.material as THREE.SpriteMaterial).opacity =
        currentOpacity;

      // Focus scaling
      const target = state === "focused" ? 1.45 : 1.0;
      container.scale.lerp(new THREE.Vector3(target, target, target), 0.08);
    },

    dispose() {
      gemGeom.dispose();
      gemMat.dispose();
      baseGeo.dispose();
      baseMat.dispose();
      labelObj.texture.dispose();
      (labelObj.sprite.material as THREE.SpriteMaterial).dispose();
    },
  };
}
