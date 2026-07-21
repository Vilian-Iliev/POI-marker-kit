import * as THREE from "three";
import { type PoiData, type MarkerState } from "../markerStateMachine";

// CRYSTAL FLOWER
// Petals unfold from a core and gently rotate — looks delicate at distance,
// revealing crystalline detail up close. Name sits in the heart as a tiny label.
export function createMarker(position: THREE.Vector3, data: PoiData) {
  const container = new THREE.Object3D();
  container.position.copy(position);

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 16, 12),
    new THREE.MeshStandardMaterial({
      color: 0xffdd88,
      emissive: 0xffcc66,
      roughness: 0.2,
    }),
  );
  container.add(core);

  const petals: { mesh: THREE.Mesh; baseAngle: number }[] = [];
  const petalCount = 6;
  for (let i = 0; i < petalCount; i++) {
    const g = new THREE.ConeGeometry(0.24, 0.9, 8);
    const m = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(0.6 - i * 0.05, 0.8, 0.5),
      metalness: 0.2,
      roughness: 0.15,
      emissive: 0x113344,
    });
    const mesh = new THREE.Mesh(g, m);
    mesh.position.y = 0.0;
    mesh.rotation.x = Math.PI;
    const angle = (i / petalCount) * Math.PI * 2;
    mesh.position.x = Math.cos(angle) * 0.35;
    mesh.position.z = Math.sin(angle) * 0.35;
    mesh.lookAt(new THREE.Vector3(0, 0.6, 0));
    container.add(mesh);
    petals.push({ mesh, baseAngle: angle });
  }

  // small label at core
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgba(0,0,0,0)";
  ctx.fillRect(0, 0, 512, 128);
  ctx.font = "36px sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.fillText(data?.name ?? "", 256, 80);
  const labelTex = new THREE.CanvasTexture(canvas);
  const labelMat = new THREE.SpriteMaterial({
    map: labelTex,
    transparent: true,
  });
  const labelSprite = new THREE.Sprite(labelMat);
  labelSprite.scale.set(0.8, 0.2, 1);
  labelSprite.position.y = 0.4;
  container.add(labelSprite);

  let elapsed = 0;
  let opacity = 0;

  return {
    mesh: container,
    update(dtSeconds: number, state: MarkerState) {
      elapsed += dtSeconds;
      if (state === "hidden") opacity = 0;
      else if (state === "revealing")
        opacity = Math.min(1, opacity + dtSeconds * 1.2);
      else if (state === "hiding")
        opacity = Math.max(0, opacity - dtSeconds * 1.8);

      // Petals open/close and sway
      for (let i = 0; i < petals.length; i++) {
        const p = petals[i];
        const open = 0.2 + Math.sin(elapsed * 1.2 + i) * 0.6; // -1..1
        const angle = p.baseAngle;
        p.mesh.rotation.z = open * 0.6 * (state === "focused" ? 1.4 : 1.0);
        p.mesh.position.y = 0.15 + Math.max(0, open) * 0.3;
        (p.mesh.material as THREE.MeshStandardMaterial).opacity = opacity;
        (p.mesh.material as THREE.MeshStandardMaterial).transparent =
          opacity < 1;
      }

      core.material.opacity = opacity;
      (labelSprite.material as THREE.SpriteMaterial).opacity = opacity;

      // slow rotation
      container.rotation.y += dtSeconds * 0.25;
      const target = state === "focused" ? 1.2 : 1.0;
      container.scale.lerp(new THREE.Vector3(target, target, target), 0.06);
    },
    dispose() {
      core.geometry.dispose();
      (core.material as THREE.Material).dispose();
      for (const p of petals) {
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
      }
      labelTex.dispose();
      (labelSprite.material as THREE.Material).dispose();
    },
  };
}
