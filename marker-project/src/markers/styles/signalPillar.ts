import * as THREE from "three";
import type { PoiData, MarkerState } from "../markerStateMachine.ts";

// SIGNAL PILLAR
// A tall translucent pillar emits small rising particles; reads as a beacon
// from afar and sparkly when close. The POI name is wrapped on a floating band.
export function createMarker(position: THREE.Vector3, data: PoiData) {
  const container = new THREE.Object3D();
  container.position.copy(position);

  const pillarGeo = new THREE.CylinderGeometry(0.18, 0.5, 2.0, 16, 1, true);
  const pillarMat = new THREE.MeshStandardMaterial({
    color: 0x77ccff,
    emissive: 0x3388ff,
    transparent: true,
    opacity: 0.18,
    side: THREE.DoubleSide,
  });
  const pillar = new THREE.Mesh(pillarGeo, pillarMat);
  pillar.position.y = 0.9;
  container.add(pillar);

  // glowing core
  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 1.4, 12),
    new THREE.MeshStandardMaterial({
      color: 0xaaffff,
      emissive: 0x88eeff,
      roughness: 0.2,
    }),
  );
  core.position.y = 0.9;
  container.add(core);

  // rising particle pool
  const particles: { mesh: THREE.Mesh; birth: number; life: number }[] = [];
  const maxParticles = 18;

  const spawnParticle = (now: number) => {
    if (particles.length >= maxParticles) return;
    const g = new THREE.SphereGeometry(0.03, 8, 8);
    const m = new THREE.MeshBasicMaterial({
      color: 0xcceeff,
      transparent: true,
      opacity: 0.9,
    });
    const s = new THREE.Mesh(g, m);
    s.position.set(
      (Math.random() - 0.5) * 0.3,
      0.2,
      (Math.random() - 0.5) * 0.3,
    );
    container.add(s);
    particles.push({ mesh: s, birth: now, life: 1.2 + Math.random() * 0.8 });
  };

  // name band (canvas texture wrapped on thin torus-like plane)
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, 512, 64);
  ctx.fillStyle = "rgba(0,0,0,0)";
  ctx.fillRect(0, 0, 512, 64);
  ctx.font = "32px sans-serif";
  ctx.fillStyle = "#ddf7ff";
  ctx.textAlign = "center";
  ctx.fillText(data?.name ?? "", 256, 44);
  const bandTex = new THREE.CanvasTexture(canvas);
  const band = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 0.22),
    new THREE.MeshBasicMaterial({ map: bandTex, transparent: true }),
  );
  band.position.y = 1.4;
  band.rotation.y = Math.PI / 8;
  container.add(band);

  let time = 0;
  let opacity = 0;

  return {
    mesh: container,
    update(dtSeconds: number, state: MarkerState) {
      time += dtSeconds;
      if (state === "hidden") opacity = 0;
      else if (state === "revealing")
        opacity = Math.min(1, opacity + dtSeconds * 1.1);
      else if (state === "hiding")
        opacity = Math.max(0, opacity - dtSeconds * 2.0);

      // spawn rhythm
      if (Math.random() < dtSeconds * 3.0) spawnParticle(time);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        const age = time - p.birth;
        const life = p.life;
        const prog = age / life;
        p.mesh.position.y = 0.3 + prog * 1.6;
        //p.mesh.material.opacity = Math.max(0, 1.0 - prog) * opacity;
        p.mesh.scale.setScalar(0.6 + prog * 0.8);
        if (prog >= 1) {
          container.remove(p.mesh);
          p.mesh.geometry.dispose();
          (p.mesh.material as THREE.Material).dispose();
          particles.splice(i, 1);
        }
      }

      pillarMat.opacity = 0.12 * opacity;
      (core.material as THREE.MeshStandardMaterial).emissiveIntensity =
        0.6 + Math.abs(Math.sin(time * 2.5)) * 0.6;
      (band.material as THREE.MeshBasicMaterial).opacity = opacity;

      const target = state === "focused" ? 1.45 : 1.0;
      container.scale.lerp(new THREE.Vector3(target, target, target), 0.06);
    },
    dispose() {
      pillarGeo.dispose();
      pillarMat.dispose();
      core.geometry.dispose();
      (core.material as THREE.Material).dispose();
      for (const p of particles) {
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
      }
      bandTex.dispose();
      (band.material as THREE.Material).dispose();
    },
  };
}
