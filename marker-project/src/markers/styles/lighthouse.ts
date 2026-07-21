import * as THREE from "three";
import { type PoiData, type MarkerState } from "../markerStateMachine";

/**
 * RED-STRIPED LIGHTHOUSE
 *
 * A tall lighthouse with bold red and white bands, a dark lantern cage, and a
 * cone roof. The design is cleaned up, with no arm-like appendages and a
 * rotating light animation inside the lantern.
 */

export function createLighthouse(position: THREE.Vector3, _data: PoiData) {
  const container = new THREE.Object3D();
  container.position.copy(position);

  const whiteMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.12,
    roughness: 0.28,
    emissive: 0x111111,
    emissiveIntensity: 0.05,
    transparent: true,
    opacity: 1,
  });

  const redMaterial = new THREE.MeshStandardMaterial({
    color: 0xe33b2a,
    metalness: 0.08,
    roughness: 0.3,
    emissive: 0x310d06,
    emissiveIntensity: 0.05,
    transparent: true,
    opacity: 1,
  });

  const darkMaterial = new THREE.MeshStandardMaterial({
    color: 0x2e2f38,
    metalness: 0.6,
    roughness: 0.25,
    emissive: 0x081010,
    emissiveIntensity: 0.08,
    transparent: true,
    opacity: 0.96,
  });

  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xf8f6f2,
    emissive: 0xf8f6f2,
    emissiveIntensity: 0.42,
    roughness: 0.04,
    metalness: 0.0,
    transparent: true,
    opacity: 0.22,
    transmission: 0.85,
    side: THREE.DoubleSide,
  });

  const lightMaterial = new THREE.MeshBasicMaterial({
    color: 0xfff1b5,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 0.28, 26), whiteMaterial);
  base.position.y = -0.08;
  container.add(base);

  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 2.5, 26), whiteMaterial);
  tower.position.y = 1.35;
  container.add(tower);

  const stripes: THREE.Mesh[] = [];
  const stripeHeights = [0.45, 0.95, 1.45, 1.95];
  for (let i = 0; i < stripeHeights.length; i++) {
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.44, 0.18, 26), i % 2 === 0 ? redMaterial : whiteMaterial.clone());
    stripe.position.y = stripeHeights[i];
    container.add(stripe);
    stripes.push(stripe);
  }

  const lanternFloor = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.08, 26), darkMaterial);
  lanternFloor.position.y = 2.60;
  container.add(lanternFloor);

  const lanternGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.28, 26, 1, true), glassMaterial);
  lanternGlass.position.y = 2.75;
  container.add(lanternGlass);

  const lanternCage: THREE.Mesh[] = [];
  for (let i = 0; i < 8; i++) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.32, 0.04), darkMaterial.clone());
    const angle = (Math.PI * 2 * i) / 8;
    rib.position.set(Math.cos(angle) * 0.4, 2.75, Math.sin(angle) * 0.4);
    rib.rotation.y = angle;
    container.add(rib);
    lanternCage.push(rib);
  }

  const roofBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.92, 0.08, 24), redMaterial.clone());
  roofBrim.position.y = 3.25;
  container.add(roofBrim);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.72, 0.46, 24), redMaterial);
  roof.position.y = 3.55;
  roof.rotation.y = Math.PI * 0.02;
  container.add(roof);

  const roofBand = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.08, 24), darkMaterial);
  roofBand.position.y = 3.15;
  container.add(roofBand);

  const roofBase = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.1, 24), whiteMaterial);
  roofBase.position.y = 3.35;
  container.add(roofBase);

  const roofTop = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), darkMaterial.clone());
  roofTop.position.y = 3.83;
  container.add(roofTop);

  const beaconCore = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), lightMaterial);
  beaconCore.position.y = 2.75;
  container.add(beaconCore);

  const lightConeMaterial = new THREE.MeshBasicMaterial({
    color: 0xfff1b5,
    transparent: true,
    opacity: 0.14,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const lightPivot = new THREE.Object3D();
  lightPivot.position.set(0, 2.75, 0);
  container.add(lightPivot);

  const lightConeGeometry = new THREE.BufferGeometry();
  const lightConeVertices = new Float32Array([
    0.0,
    0.0,
    0.0,
    -0.48,
    -0.16,
    2.6,
    0.48,
    -0.16,
    2.6,
    0.48,
    0.16,
    2.6,
    -0.48,
    0.16,
    2.6,
  ]);
  lightConeGeometry.setAttribute("position", new THREE.BufferAttribute(lightConeVertices, 3));
  lightConeGeometry.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 4]);
  lightConeGeometry.computeVertexNormals();

  const lightCone = new THREE.Mesh(lightConeGeometry, lightConeMaterial);
  lightCone.position.z = 0.05;
  lightPivot.add(lightCone);

  const lightRings: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16 + i * 0.05, 0.02, 12, 48), lightMaterial.clone());
    ring.position.y = 2.75;
    ring.rotation.x = Math.PI * 0.5;
    ring.material.opacity = 0.55 - i * 0.14;
    container.add(ring);
    lightRings.push(ring);
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

      const opacityFactor = Math.pow(currentOpacity, 0.92);
      whiteMaterial.opacity = opacityFactor;
      redMaterial.opacity = opacityFactor;
      darkMaterial.opacity = opacityFactor;
      glassMaterial.opacity = Math.max(0.18, opacityFactor * 0.32);
      lightMaterial.opacity = opacityFactor * 0.9;

      const sway = Math.sin(elapsedTime * 0.16) * 0.015;
      container.rotation.z = sway;
      container.rotation.x = Math.cos(elapsedTime * 0.08) * 0.01;

      beaconCore.rotation.y += dtSeconds * 1.5;
      const beaconPulse = 0.8 + Math.sin(elapsedTime * 4.2) * 0.14;
      (beaconCore.material as THREE.MeshBasicMaterial).opacity = opacityFactor * beaconPulse;

      for (let i = 0; i < lightRings.length; i++) {
        lightRings[i].rotation.y = elapsedTime * (0.6 + i * 0.35);
      }

      for (let i = 0; i < lanternCage.length; i++) {
        lanternCage[i].position.y = 2.75 + Math.sin(elapsedTime * 1.2 + i) * 0.005;
      }

      lightPivot.rotation.y = elapsedTime * 0.8;
      lightConeMaterial.opacity = Math.max(0.04, opacityFactor * 0.18);

      if (state === "focused") {
        container.scale.lerp(new THREE.Vector3(1.18, 1.18, 1.18), 0.08);
      } else {
        container.scale.lerp(new THREE.Vector3(1, 1, 1), 0.08);
      }
    },

    dispose() {
      base.geometry.dispose();
      tower.geometry.dispose();
      whiteMaterial.dispose();
      redMaterial.dispose();
      darkMaterial.dispose();
      glassMaterial.dispose();
      lightMaterial.dispose();
      for (const stripe of stripes) {
        stripe.geometry.dispose();
      }
      lanternFloor.geometry.dispose();
      lanternGlass.geometry.dispose();
      roof.geometry.dispose();
      beaconCore.geometry.dispose();
      for (const rib of lanternCage) {
        rib.geometry.dispose();
        (rib.material as THREE.Material).dispose();
      }
      for (const ring of lightRings) {
        ring.geometry.dispose();
      }
      lightCone.geometry.dispose();
      lightConeMaterial.dispose();
    },
  };
}
