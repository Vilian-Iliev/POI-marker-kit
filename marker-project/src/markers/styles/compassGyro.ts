import * as THREE from "three";
import { type PoiData, type MarkerState } from "../markerStateMachine";

// COMPASS GYRO
// Circular rings with a floating needle. The needle slowly spins and pulses.
export function createMarker(position: THREE.Vector3, data: PoiData) {
  const container = new THREE.Object3D();
  container.position.copy(position);

  const outer = new THREE.Mesh(
    new THREE.TorusGeometry(1.1, 0.05, 12, 100),
    new THREE.MeshStandardMaterial({
      color: 0xffcc33,
      emissive: 0xaa7700,
      roughness: 0.3,
    }),
  );
  outer.rotation.x = Math.PI * 0.25;
  container.add(outer);

  const inner = new THREE.Mesh(
    new THREE.TorusGeometry(0.7, 0.03, 12, 100),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x333333,
      roughness: 0.4,
    }),
  );
  inner.rotation.x = Math.PI * 0.32;
  container.add(inner);

  const needle = new THREE.Mesh(
    new THREE.ConeGeometry(0.06, 0.9, 8),
    new THREE.MeshStandardMaterial({ color: 0xff3333, emissive: 0xff4444 }),
  );
  needle.position.y = 0.2;
  needle.rotation.x = Math.PI;
  container.add(needle);

  // small cardinal markers
  const cards: THREE.Mesh[] = [];
  const cardGeo = new THREE.BoxGeometry(0.08, 0.02, 0.18);
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(
      cardGeo,
      new THREE.MeshStandardMaterial({ color: 0xffffff }),
    );
    const a = (i / 4) * Math.PI * 2;
    m.position.set(Math.cos(a) * 0.95, 0.05, Math.sin(a) * 0.95);
    m.lookAt(new THREE.Vector3(0, 0.05, 0));
    container.add(m);
    cards.push(m);
  }

  // label plane
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgba(0,0,0,0)";
  ctx.fillRect(0, 0, 512, 128);
  ctx.font = "36px sans-serif";
  ctx.fillStyle = "#ffeebb";
  ctx.textAlign = "center";
  ctx.fillText(data?.name ?? "", 256, 80);
  const tex = new THREE.CanvasTexture(canvas);
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 0.4),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true }),
  );
  plane.position.y = 0.9;
  container.add(plane);

  let t = 0;
  let opacity = 0;

  return {
    mesh: container,
    update(dtSeconds: number, state: MarkerState) {
      t += dtSeconds;
      if (state === "hidden") opacity = 0;
      else if (state === "revealing")
        opacity = Math.min(1, opacity + dtSeconds * 1.4);
      else if (state === "hiding")
        opacity = Math.max(0, opacity - dtSeconds * 1.9);

      needle.rotation.y += dtSeconds * 0.9 + Math.sin(t * 1.8) * 0.01;
      outer.rotation.z += dtSeconds * 0.2;
      inner.rotation.z -= dtSeconds * 0.35;

      (needle.material as THREE.MeshStandardMaterial).emissiveIntensity =
        0.6 + Math.abs(Math.sin(t * 3.0)) * 0.6;
      (outer.material as THREE.MeshStandardMaterial).opacity = opacity;
      (inner.material as THREE.MeshStandardMaterial).opacity = opacity * 0.9;
      for (const c of cards)
        (c.material as THREE.MeshStandardMaterial).opacity = opacity;
      (plane.material as THREE.MeshBasicMaterial).opacity = opacity;

      const target = state === "focused" ? 1.3 : 1.0;
      container.scale.lerp(new THREE.Vector3(target, target, target), 0.06);
    },
    dispose() {
      (outer.geometry as THREE.Geometry).dispose();
      (outer.material as THREE.Material).dispose();
      (inner.geometry as THREE.Geometry).dispose();
      (inner.material as THREE.Material).dispose();
      (needle.geometry as THREE.Geometry).dispose();
      (needle.material as THREE.Material).dispose();
      for (const c of cards) {
        c.geometry.dispose();
        (c.material as THREE.Material).dispose();
      }
      tex.dispose();
      (plane.material as THREE.Material).dispose();
    },
  };
}
