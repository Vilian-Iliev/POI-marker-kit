import * as THREE from "three";
import { type PoiData, type MarkerState } from "../markerStateMachine";

/**
 * FUTURISTIC ROBOTIC SENTINEL
 *
 * A compact robot beacon with a visor head, arm-like vents, and floating drone
 * accents. It feels more like an autonomous sentinel than a passive marker.
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

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.76, 0.26), frameMaterial.clone());
  torso.position.y = 0.72;
  container.add(torso);

  const chestCore = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), coreMaterial);
  chestCore.position.set(0, 0.72, 0.08);
  container.add(chestCore);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.24), frameMaterial.clone());
  head.position.y = 1.28;
  container.add(head);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.02), glowMaterial.clone());
  visor.position.set(0, 1.25, 0.13);
  container.add(visor);

  const eyeLeft = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), glowMaterial.clone());
  eyeLeft.position.set(-0.07, 1.34, 0.14);
  container.add(eyeLeft);

  const eyeRight = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), glowMaterial.clone());
  eyeRight.position.set(0.07, 1.34, 0.14);
  container.add(eyeRight);

  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.26, 12), frameMaterial.clone());
  antenna.position.set(0, 1.48, 0);
  container.add(antenna);

  const antennaTip = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), glowMaterial.clone());
  antennaTip.position.set(0, 1.60, 0);
  container.add(antennaTip);

  const shoulders: THREE.Mesh[] = [];
  for (let i = -1; i <= 1; i += 2) {
    const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.36), frameMaterial.clone());
    shoulder.position.set(i * 0.28, 0.95, 0);
    shoulder.rotation.y = i * 0.12;
    container.add(shoulder);
    shoulders.push(shoulder);
  }

  const arms: THREE.Mesh[] = [];
  for (let i = -1; i <= 1; i += 2) {
    const upperArm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.1), frameMaterial.clone());
    upperArm.position.set(i * 0.32, 0.68, 0);
    container.add(upperArm);
    arms.push(upperArm);

    const lowerArm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.24, 0.08), frameMaterial.clone());
    lowerArm.position.set(i * 0.32, 0.42, 0);
    container.add(lowerArm);
    arms.push(lowerArm);
  }

  const drones: Array<{ mesh: THREE.Mesh; phase: number; radius: number }> = [];
  const droneCount = 5;
  for (let i = 0; i < droneCount; i++) {
    const drone = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), glowMaterial.clone());
    const phase = (i / droneCount) * Math.PI * 2;
    drone.position.set(Math.cos(phase) * 0.88, 0.95, Math.sin(phase) * 0.88);
    container.add(drone);
    drones.push({ mesh: drone, phase, radius: 0.88 });
  }

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

      const tilt = Math.sin(elapsedTime * 0.12) * 0.018;
      container.rotation.z = tilt;

      chestCore.rotation.y += dtSeconds * 0.9;

      eyeLeft.position.y = 1.34 + Math.sin(elapsedTime * 1.7) * 0.01;
      eyeRight.position.y = 1.34 + Math.sin(elapsedTime * 1.7 + 1.2) * 0.01;

      for (let i = 0; i < shoulders.length; i++) {
        shoulders[i].rotation.z = Math.sin(elapsedTime * 1.1 + i) * 0.08;
      }

      for (let i = 0; i < arms.length; i++) {
        arms[i].rotation.x = Math.sin(elapsedTime * 1.2 + i * 0.9) * 0.18;
      }

      for (const drone of drones) {
        const time = elapsedTime * 0.95 + drone.phase;
        drone.mesh.position.x = Math.cos(time) * drone.radius;
        drone.mesh.position.z = Math.sin(time) * drone.radius;
        drone.mesh.position.y = 0.95 + Math.sin(time * 1.3) * 0.05;
        drone.mesh.rotation.y += dtSeconds * 1.4;
      }

      if (state === "focused") {
        container.scale.lerp(new THREE.Vector3(1.22, 1.22, 1.22), 0.08);
      } else {
        container.scale.lerp(new THREE.Vector3(1, 1, 1), 0.08);
      }
    },

    dispose() {
      base.geometry.dispose();
      torso.geometry.dispose();
      chestCore.geometry.dispose();
      head.geometry.dispose();
      visor.geometry.dispose();
      eyeLeft.geometry.dispose();
      eyeRight.geometry.dispose();
      antenna.geometry.dispose();
      antennaTip.geometry.dispose();
      accent.geometry.dispose();
      coreMaterial.dispose();
      frameMaterial.dispose();
      glowMaterial.dispose();
      for (const shoulder of shoulders) {
        shoulder.geometry.dispose();
      }
      for (const arm of arms) {
        arm.geometry.dispose();
      }
      for (const drone of drones) {
        drone.mesh.geometry.dispose();
      }
    },
  };
}
