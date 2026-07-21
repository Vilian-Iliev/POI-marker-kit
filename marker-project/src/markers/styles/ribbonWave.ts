import * as THREE from "three";
import type { PoiData, MarkerState } from "../markerStateMachine.ts";

// RIBBON WAVE
// A flowing ribbon constructed from many slim segments that form a waving band.
export function createMarker(position: THREE.Vector3, data: PoiData) {
  const container = new THREE.Object3D();
  container.position.copy(position);

  const segments = 20;
  const segmentLength = 0.2;
  const meshes: THREE.Mesh[] = [];

  const baseColor = new THREE.Color(0x4477ff);

  for (let i = 0; i < segments; i++) {
    const g = new THREE.BoxGeometry(segmentLength, 0.08, 0.6);
    const m = new THREE.MeshStandardMaterial({
      color: baseColor.clone().offsetHSL(0, 0, (i / segments) * -0.12),
      emissive: 0x2244ff,
      roughness: 0.4,
    });
    const mesh = new THREE.Mesh(g, m);
    mesh.position.x = (i - segments / 2) * (segmentLength * 0.9);
    container.add(mesh);
    meshes.push(mesh);
  }

  // small anchor pole for reading the name (plane with canvas)
  const makeLabel = (text = "") => {
    const w = 512,
      h = 128;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(20,30,60,0.6)";
    ctx.fillRect(0, 0, w, h);
    ctx.font = "36px sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText(text, w / 2, 80);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.42), mat);
    plane.position.y = 0.9;
    return { plane, tex };
  };

  const label = makeLabel(data?.name ?? "");
  label.plane.lookAt(new THREE.Vector3(0, 1, 0));
  container.add(label.plane);

  let t = 0;
  let opacity = 0;

  return {
    mesh: container,
    update(dtSeconds: number, state: MarkerState) {
      t += dtSeconds;
      if (state === "hidden") opacity = 0;
      else if (state === "revealing")
        opacity = Math.min(1, opacity + dtSeconds * 1.5);
      else if (state === "hiding")
        opacity = Math.max(0, opacity - dtSeconds * 2.0);

      for (let i = 0; i < meshes.length; i++) {
        const m = meshes[i];
        const phase = t * 2.0 + i * 0.25;
        m.position.y =
          Math.sin(phase) *
          0.25 *
          (1 - Math.abs(i - meshes.length / 2) / (meshes.length / 2));
        m.rotation.z = Math.sin(phase * 0.7) * 0.25;
        (m.material as THREE.MeshStandardMaterial).opacity = opacity;
        (m.material as THREE.MeshStandardMaterial).transparent = opacity < 1;
      }

      label.plane.material.opacity = opacity;

      // gentle overall sway
      container.rotation.z = Math.sin(t * 0.2) * 0.08;
      const target = state === "focused" ? 1.25 : 1.0;
      container.scale.lerp(new THREE.Vector3(target, target, target), 0.06);
    },
    dispose() {
      for (const m of meshes) {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      }
      label.tex.dispose();
      (label.plane.material as THREE.Material).dispose();
    },
  };
}
