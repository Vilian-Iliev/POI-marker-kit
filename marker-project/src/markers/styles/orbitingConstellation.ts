import * as THREE from "three";
import { type PoiData, type MarkerState } from "../markerStateMachine";

/**
 * HIGH-RES GEOMETRIC BEACON
 *
 * A clean, tall beacon with faceted geometry, layered prisms, and sharp polygonal
 * detail. It reads clearly from distance and feels distinctly modern.
 */

export function createFuturisticMarker(position: THREE.Vector3, _data: PoiData) {
  const container = new THREE.Object3D();
  container.position.copy(position);

  const coreMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xdcfeff,
    emissive: 0x99fbff,
    emissiveIntensity: 1.2,
    roughness: 0.04,
    metalness: 0.6,
    transparent: true,
    opacity: 0.96,
    transmission: 0.8,
    clearcoat: 0.4,
  });

  const frameMaterial = new THREE.MeshStandardMaterial({
    color: 0x15354f,
    emissive: 0x1c5c80,
    emissiveIntensity: 0.35,
    roughness: 0.14,
    metalness: 0.82,
    transparent: true,
    opacity: 0.94,
    side: THREE.DoubleSide,
  });

  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0x8affff,
    transparent: true,
    opacity: 0.78,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 0.88, 0.16, 18), frameMaterial);
  base.position.y = -0.04;
  container.add(base);

  const core = new THREE.Mesh(new THREE.DodecahedronGeometry(0.26, 1), coreMaterial);
  core.position.y = 0.72;
  container.add(core);

  const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.05, 18), frameMaterial);
  spine.position.y = 0.35;
  container.add(spine);

  const panels: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.92, 0.28), frameMaterial.clone());
    const angle = (i / 5) * Math.PI * 2;
    panel.position.set(Math.cos(angle) * 0.33, 0.4, Math.sin(angle) * 0.33);
    panel.rotation.y = angle;
    panel.position.y = 0.42;
    container.add(panel);
    panels.push(panel);
  }

  const glassPanels: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.5), glowMaterial.clone());
    const angle = (Math.PI / 2) * i + Math.PI * 0.1;
    glass.position.set(Math.cos(angle) * 0.32, 0.92, Math.sin(angle) * 0.32);
    glass.rotation.y = -angle;
    glass.rotation.x = Math.PI * 0.04;
    container.add(glass);
    glassPanels.push(glass);
  }

  const shardMaterial = new THREE.MeshStandardMaterial({
    color: 0x97fbff,
    emissive: 0x97fbff,
    emissiveIntensity: 1.0,
    roughness: 0.08,
    metalness: 0.55,
    transparent: true,
    opacity: 0.95,
  });

  interface Shard {
    mesh: THREE.Mesh;
    phase: number;
    radius: number;
  }

  const shards: Shard[] = [];
  const shardCount = 7;
  for (let i = 0; i < shardCount; i++) {
    const shard = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 10), shardMaterial.clone());
    const phase = (i / shardCount) * Math.PI * 2;
    shard.position.set(Math.cos(phase) * 0.85, 0.62, Math.sin(phase) * 0.85);
    shard.rotation.set(Math.PI * 0.2, phase, 0);
    container.add(shard);
    shards.push({ mesh: shard, phase, radius: 0.85 });
  }

  const accent = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.16, 18), glowMaterial.clone());
  accent.position.y = 1.12;
  container.add(accent);

  let elapsedTime = 0;
  let currentOpacity = 0;

  return {
    mesh: container,

    update(dtSeconds: number, state: MarkerState) {
      elapsedTime += dtSeconds;

      let targetOpacity = 1;
      if (state === "hidden") {
        targetOpacity = 0;
      } else if (state === "revealing") {
        targetOpacity = 1;
      } else if (state === "hiding") {
        targetOpacity = 0;
      }
      currentOpacity += (targetOpacity - currentOpacity) * Math.min(1, dtSeconds * 3.2);
      currentOpacity = Math.max(0, Math.min(1, currentOpacity));

      const opacityFactor = Math.pow(currentOpacity, 0.94);
      coreMaterial.opacity = opacityFactor * 0.96;
      frameMaterial.opacity = opacityFactor * 0.93;
      glowMaterial.opacity = opacityFactor * 0.8;
      shardMaterial.opacity = opacityFactor * 0.95;
      accent.material.opacity = opacityFactor * 0.72;

      const tilt = Math.sin(elapsedTime * 0.12) * 0.022;
      container.rotation.z = tilt;

      core.rotation.y += dtSeconds * 0.85;
      core.rotation.x += dtSeconds * 0.5;

      for (let i = 0; i < panels.length; i++) {
        const panel = panels[i];
        const phase = elapsedTime * 0.8 + i * 0.9;
        panel.position.y = 0.42 + Math.sin(phase) * 0.025;
        panel.rotation.z = Math.PI * 0.08 + Math.sin(phase * 1.3) * 0.015;
      }

      for (let i = 0; i < glassPanels.length; i++) {
        const glass = glassPanels[i];
        const phase = elapsedTime * 1.25 + i;
        glass.position.y = 0.92 + Math.sin(phase) * 0.022;
        glass.rotation.z = Math.sin(phase * 0.9) * 0.06;
      }

      for (const shard of shards) {
        const time = elapsedTime * 1.15 + shard.phase;
        const radius = shard.radius + Math.sin(time * 0.7) * 0.11;
        shard.mesh.position.x = Math.cos(time) * radius;
        shard.mesh.position.z = Math.sin(time) * radius;
        shard.mesh.position.y = 0.62 + Math.sin(time * 1.35) * 0.085;
        shard.mesh.rotation.y += dtSeconds * 1.6;
      }

      accent.rotation.y += dtSeconds * 1.4;

      if (state === "focused") {
        container.scale.lerp(new THREE.Vector3(1.22, 1.22, 1.22), 0.08);
      } else {
        container.scale.lerp(new THREE.Vector3(1, 1, 1), 0.08);
      }
    },

    dispose() {
      base.geometry.dispose();
      spine.geometry.dispose();
      core.geometry.dispose();
      coreMaterial.dispose();
      frameMaterial.dispose();
      glowMaterial.dispose();
      shardMaterial.dispose();
      accent.geometry.dispose();
      for (const panel of panels) {
        panel.geometry.dispose();
      }
      for (const glass of glassPanels) {
        glass.geometry.dispose();
      }
      for (const shard of shards) {
        shard.mesh.geometry.dispose();
      }
    },
  };
}
