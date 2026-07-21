import * as THREE from "three";
import type { PoiData, MarkerState } from "../markerStateMachine.ts";

/**
 * SIM MARKER
 *
 * Clean, iconic gem floating above a circular base—inspired by The Sims 4 UI.
 * A plumbob-like diamond pulses with a vibrant neon glow, bobbing gently in 3D space.
 * The design is immediately readable from any distance: bold color, simple geometry,
 * unmistakably intentional. Horizontal GPS error feels like natural floating motion.
 */

export function createCrystallineSikeTower(position: THREE.Vector3, data: PoiData) {
  const container = new THREE.Object3D();
  container.position.copy(position);

  // Bright neon colors (Sims-style palette)
  const gemColor = 0xff1493; // Deep pink/magenta
  const glowIntensity = 1.0;

  // Create main gem/diamond shape (octahedron for classic gem look)
  const gemGeometry = new THREE.OctahedronGeometry(0.6, 3);
  const gemMaterial = new THREE.MeshStandardMaterial({
    color: gemColor,
    metalness: 0.4,
    roughness: 0.1,
    emissive: gemColor,
    emissiveIntensity: glowIntensity,
  });
  const gem = new THREE.Mesh(gemGeometry, gemMaterial);
  gem.position.y = 0.8;
  container.add(gem);

  // Outer glow halo around gem
  const haloGeometry = new THREE.IcosahedronGeometry(0.85, 2);
  const haloMaterial = new THREE.MeshBasicMaterial({
    color: gemColor,
    transparent: true,
    opacity: 0.2,
  });
  const halo = new THREE.Mesh(haloGeometry, haloMaterial);
  halo.position.y = 0.8;
  halo.scale.set(1.3, 1.3, 1.3);
  container.add(halo);

  // Circular base platform (classic Sims location marker base)
  const baseGeometry = new THREE.CylinderGeometry(1.2, 1.2, 0.15, 32);
  const baseMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a1a2e,
    metalness: 0.3,
    roughness: 0.2,
    emissive: 0x0a0a1a,
    emissiveIntensity: 0.3,
  });
  const base = new THREE.Mesh(baseGeometry, baseMaterial);
  base.position.y = -0.1;
  container.add(base);

  // Ring around base (subtle accent)
  const ringGeometry = new THREE.TorusGeometry(1.15, 0.08, 16, 100);
  const ringMaterial = new THREE.MeshStandardMaterial({
    color: gemColor,
    metalness: 0.6,
    roughness: 0.05,
    emissive: gemColor,
    emissiveIntensity: 0.5,
  });
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.position.y = 0.0;
  ring.rotation.x = Math.PI * 0.1;
  container.add(ring);

  // Inner rotating ring (adds motion complexity)
  const innerRingGeometry = new THREE.TorusGeometry(0.7, 0.06, 16, 100);
  const innerRing = new THREE.Mesh(innerRingGeometry, ringMaterial.clone());
  innerRing.position.y = 0.3;
  innerRing.rotation.x = Math.PI * 0.4;
  container.add(innerRing);

  // Vertical light beam effect
  const beamGeometry = new THREE.CylinderGeometry(0.3, 0.5, 2.5, 16);
  const beamMaterial = new THREE.MeshBasicMaterial({
    color: gemColor,
    transparent: true,
    opacity: 0.15,
    side: THREE.DoubleSide,
  });
  const beam = new THREE.Mesh(beamGeometry, beamMaterial);
  beam.position.y = 0.6;
  container.add(beam);

  let elapsedTime = 0;
  let currentOpacity = 0;

  return {
    mesh: container,

    update(dtSeconds: number, state: MarkerState) {
      elapsedTime += dtSeconds;

      // Fade in/out
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

      // Gem bob up and down (signature Sims floating motion)
      const bobPhase = elapsedTime * 1.5;
      const bobHeight = Math.sin(bobPhase) * 0.25;
      gem.position.y = 0.8 + bobHeight;
      halo.position.y = 0.8 + bobHeight;
      innerRing.position.y = 0.3 + bobHeight;
      beam.position.y = 0.6 + bobHeight;

      // Gem rotation - steady spin
      gem.rotation.x += dtSeconds * 0.8;
      gem.rotation.y += dtSeconds * 1.2;
      gem.rotation.z += dtSeconds * 0.5;

      // Halo rotation (opposite direction)
      halo.rotation.z -= dtSeconds * 0.7;

      // Base ring rotates
      ring.rotation.z += dtSeconds * 1.5;

      // Inner ring rotates faster
      innerRing.rotation.z -= dtSeconds * 2.0;

      // Gem pulse brightness
      const pulseBrightness = 0.6 + Math.sin(bobPhase * 2) * 0.4;
      gemMaterial.emissiveIntensity = glowIntensity * pulseBrightness;
      ringMaterial.emissiveIntensity = 0.5 * pulseBrightness;

      // Apply opacity to all materials
      gemMaterial.opacity = currentOpacity;
      haloMaterial.opacity = currentOpacity * 0.2;
      baseMaterial.opacity = currentOpacity;
      ringMaterial.opacity = currentOpacity;
      beamMaterial.opacity = currentOpacity * 0.15;

      // Beam pulsing effect
      beamMaterial.opacity = currentOpacity * (0.1 + Math.sin(elapsedTime * 3) * 0.08);

      // Focus state: expand gem and increase glow
      if (state === "focused") {
        const focusScale = 1.3;
        gem.scale.lerp(new THREE.Vector3(focusScale, focusScale, focusScale), 0.1);
        halo.scale.lerp(new THREE.Vector3(focusScale * 1.3, focusScale * 1.3, focusScale * 1.3), 0.1);
        gemMaterial.emissiveIntensity = Math.min(1.2, glowIntensity * pulseBrightness * 1.3);
      } else {
        gem.scale.lerp(new THREE.Vector3(1.0, 1.0, 1.0), 0.1);
        halo.scale.lerp(new THREE.Vector3(1.3, 1.3, 1.3), 0.1);
      }

      // Subtle container tilt (very minimal for Sims aesthetic)
      container.rotation.z = Math.sin(elapsedTime * 0.3) * 0.03;
    },

    dispose() {
      gemGeometry.dispose();
      gemMaterial.dispose();
      haloGeometry.dispose();
      haloMaterial.dispose();
      baseGeometry.dispose();
      baseMaterial.dispose();
      ringGeometry.dispose();
      ringMaterial.dispose();
      innerRingGeometry.dispose();
      innerRing.material.dispose();
      beamGeometry.dispose();
      beamMaterial.dispose();
    },
  };
}
