import * as THREE from "three";
import { type PoiData, type MarkerState } from "../markerStateMachine";

/**
 * ENERGY VORTEX
 *
 * A spinning toroid with satellite nodes that orbit around it, exchanging energy.
 * The toroid rotates hypnotically while satellites trace clean Lissajous-like paths,
 * creating a stable yet dynamic 3D structure. The motion is mathematically clear and
 * immediately reads as something organized and intentional, even from distance.
 * GPS error disappears into the complexity of the motion.
 */

export function createOrbitingConstellation(position: THREE.Vector3, data: PoiData) {
  const container = new THREE.Object3D();
  container.position.copy(position);

  // Main toroid - the heart of the vortex
  const toroidGeometry = new THREE.TorusGeometry(1.0, 0.3, 32, 200);
  const toroidMaterial = new THREE.MeshPhongMaterial({
    color: 0x00ffff,
    emissive: 0x0099ff,
    emissiveIntensity: 0.7,
    shininess: 100,
    wireframe: false,
  });
  const toroid = new THREE.Mesh(toroidGeometry, toroidMaterial);
  toroid.rotation.x = Math.PI * 0.3;
  container.add(toroid);

  // Inner spinning ring
  const innerRingGeometry = new THREE.TorusGeometry(0.6, 0.12, 16, 100);
  const innerRingMaterial = new THREE.MeshPhongMaterial({
    color: 0x00ffff,
    emissive: 0x00ffff,
    emissiveIntensity: 0.5,
    side: THREE.DoubleSide,
  });
  const innerRing = new THREE.Mesh(innerRingGeometry, innerRingMaterial);
  innerRing.rotation.z = Math.PI * 0.5;
  container.add(innerRing);

  // Energy satellites - orbit the vortex in complex patterns
  interface Satellite {
    mesh: THREE.Mesh;
    phase1: number; // Primary orbit angle
    phase2: number; // Secondary modulation
    scale: number;
  }

  const satellites: Satellite[] = [];
  const satelliteCount = 6;

  for (let i = 0; i < satelliteCount; i++) {
    // Vary satellite size
    const scale = 0.3 + (i % 2) * 0.15;
    const geometry = new THREE.OctahedronGeometry(scale, 2);
    const material = new THREE.MeshPhongMaterial({
      color: 0x00ff99,
      emissive: 0x00ff99,
      emissiveIntensity: 0.8,
      shininess: 120,
    });
    const mesh = new THREE.Mesh(geometry, material);
    container.add(mesh);

    satellites.push({
      mesh,
      phase1: (i / satelliteCount) * Math.PI * 2,
      phase2: (i / satelliteCount) * Math.PI,
      scale,
    });
  }

  // Swirling energy tendrils (tori at different scales/angles)
  const tendrilGeometries = [
    new THREE.TorusGeometry(1.3, 0.08, 12, 100),
    new THREE.TorusGeometry(1.6, 0.06, 12, 100),
  ];
  const tendrils: THREE.Mesh[] = [];

  for (let i = 0; i < tendrilGeometries.length; i++) {
    const material = new THREE.MeshPhongMaterial({
      color: 0x0088ff,
      emissive: 0x0088ff,
      emissiveIntensity: 0.4,
      side: THREE.DoubleSide,
      transparent: true,
    });
    const mesh = new THREE.Mesh(tendrilGeometries[i], material);
    mesh.rotation.x = (i * Math.PI) / 2.5;
    container.add(mesh);
    tendrils.push(mesh);
  }

  let elapsedTime = 0;
  let currentOpacity = 0;

  return {
    mesh: container,

    update(dtSeconds: number, state: MarkerState) {
      elapsedTime += dtSeconds;

      // Fade control
      let targetOpacity = 1.0;
      if (state === "hidden") {
        targetOpacity = 0;
        currentOpacity = 0;
      } else if (state === "revealing") {
        targetOpacity = 1.0;
        currentOpacity += dtSeconds * 1.25;
      } else if (state === "hiding") {
        targetOpacity = 0;
        currentOpacity -= dtSeconds * 1.67;
      }
      currentOpacity = Math.max(0, Math.min(1, currentOpacity));

      toroidMaterial.opacity = currentOpacity;
      innerRingMaterial.opacity = currentOpacity * 0.8;

      for (const tendril of tendrils) {
        (tendril.material as THREE.MeshPhongMaterial).opacity =
          currentOpacity * 0.4;
      }

      // Main toroid spins fast
      toroid.rotation.z += dtSeconds * 2.0;
      toroid.rotation.x = Math.PI * 0.3 + Math.sin(elapsedTime * 0.4) * 0.2;

      // Inner ring spins opposite direction
      innerRing.rotation.x += dtSeconds * 1.5;

      // Update satellites with Lissajous-like orbits
      for (const sat of satellites) {
        const time1 = elapsedTime * 1.3 + sat.phase1;
        const time2 = elapsedTime * 0.8 + sat.phase2;

        // Complex orbital path
        const x = Math.cos(time1) * 1.5 + Math.sin(time2 * 0.5) * 0.4;
        const y = Math.sin(time1 * 1.2) * 1.2 + Math.cos(time2 * 0.3) * 0.3;
        const z = Math.sin(time1 * 0.7) * 1.0;

        sat.mesh.position.set(x, y, z);

        // Satellites pulse in size
        const pulse = 0.8 + Math.sin(time1 * 2) * 0.2;
        sat.mesh.scale.set(pulse, pulse, pulse);

        // Self-rotation
        sat.mesh.rotation.x += dtSeconds * 3.0;
        sat.mesh.rotation.y += dtSeconds * 2.5;
        sat.mesh.rotation.z += dtSeconds * 1.8;

        // Opacity based on position
        const distFromCenter = Math.sqrt(x * x + y * y + z * z);
        const satOpacity = currentOpacity * (0.6 + Math.sin(elapsedTime * 1.5) * 0.4);
        (sat.mesh.material as THREE.MeshPhongMaterial).opacity = satOpacity;
      }

      // Tendrils swirl
      tendrils[0].rotation.y += dtSeconds * 1.2;
      tendrils[1].rotation.z += dtSeconds * 0.9;

      // Container sways slightly
      container.rotation.x = Math.sin(elapsedTime * 0.25) * 0.08;
      container.rotation.z = Math.cos(elapsedTime * 0.2) * 0.12;

      // Focus expansion
      const focusScale = state === "focused" ? 1.4 : 1.0;
      container.scale.lerp(new THREE.Vector3(focusScale, focusScale, focusScale), 0.1);
    },

    dispose() {
      toroidGeometry.dispose();
      toroidMaterial.dispose();
      innerRingGeometry.dispose();
      innerRingMaterial.dispose();

      for (const sat of satellites) {
        sat.mesh.geometry.dispose();
        (sat.mesh.material as THREE.MeshPhongMaterial).dispose();
      }

      for (let i = 0; i < tendrilGeometries.length; i++) {
        tendrilGeometries[i].dispose();
        tendrils[i].geometry.dispose();
        (tendrils[i].material as THREE.MeshPhongMaterial).dispose();
      }
    },
  };
}
