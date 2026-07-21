import * as THREE from "three";
import type { PoiData, MarkerState } from "../markerStateMachine.ts";

/**
 * RIPPLE PULSE
 * 
 * A compact core orb emits expanding ripple waves at regular intervals.
 * Each ripple visualizes energy radiating outward, creating clear concentric motion
 * that reads immediately from any distance. The repeated pulse rhythm is
 * unmistakably intentional. Positional offset becomes irrelevant—the radiating
 * rings define a zone, not a point.
 */

export function createBreathingOrb(position: THREE.Vector3, data: PoiData) {
  const container = new THREE.Object3D();
  container.position.copy(position);

  // Core sphere - compact and bright
  const coreGeometry = new THREE.IcosahedronGeometry(0.35, 4);
  const coreMaterial = new THREE.MeshPhongMaterial({
    color: 0xffff00,
    emissive: 0xffff00,
    emissiveIntensity: 1.0,
    shininess: 100,
  });
  const coreMesh = new THREE.Mesh(coreGeometry, coreMaterial);
  container.add(coreMesh);

  // Inner pulse ring (bright, rapid)
  const innerRingGeometry = new THREE.TorusGeometry(1.2, 0.15, 16, 100);
  const innerRingMaterial = new THREE.MeshPhongMaterial({
    color: 0xff9900,
    emissive: 0xff9900,
    emissiveIntensity: 0.8,
    side: THREE.DoubleSide,
  });
  const innerRing = new THREE.Mesh(innerRingGeometry, innerRingMaterial);
  innerRing.rotation.x = Math.PI * 0.3;
  container.add(innerRing);

  // Mid pulse ring
  const midRingGeometry = new THREE.TorusGeometry(2.0, 0.12, 16, 100);
  const midRingMaterial = new THREE.MeshPhongMaterial({
    color: 0xff6600,
    emissive: 0xff6600,
    emissiveIntensity: 0.6,
    side: THREE.DoubleSide,
  });
  const midRing = new THREE.Mesh(midRingGeometry, midRingMaterial);
  midRing.rotation.x = Math.PI * -0.2;
  midRing.rotation.z = Math.PI * 0.5;
  container.add(midRing);

  // Outer pulse ring
  const outerRingGeometry = new THREE.TorusGeometry(2.8, 0.1, 16, 100);
  const outerRingMaterial = new THREE.MeshPhongMaterial({
    color: 0xff3300,
    emissive: 0xff3300,
    emissiveIntensity: 0.4,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const outerRing = new THREE.Mesh(outerRingGeometry, outerRingMaterial);
  outerRing.rotation.x = 0;
  container.add(outerRing);

  // Expanding wave rings - pool of recyclable wave meshes
  interface Wave {
    mesh: THREE.Mesh;
    birthTime: number;
    maxRadius: number;
  }
  const waves: Wave[] = [];
  const maxWaves = 4;

  let elapsedTime = 0;
  let currentOpacity = 0;
  let lastPulseTime = 0;
  const pulseInterval = 0.6; // Emit new wave every 0.6 seconds

  // Create wave geometry template
  const createWaveMesh = () => {
    const waveTorus = new THREE.TorusGeometry(0.1, 0.08, 12, 64);
    const waveMat = new THREE.MeshPhongMaterial({
      color: 0xffff99,
      emissive: 0xffff00,
      emissiveIntensity: 1.0,
      side: THREE.DoubleSide,
      transparent: true,
    });
    return new THREE.Mesh(waveTorus, waveMat);
  };

  return {
    mesh: container,

    update(dtSeconds: number, state: MarkerState) {
      elapsedTime += dtSeconds;

      // Fade based on state
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

      coreMaterial.opacity = currentOpacity;
      innerRingMaterial.opacity = currentOpacity * 0.9;
      midRingMaterial.opacity = currentOpacity * 0.7;
      outerRingMaterial.opacity = currentOpacity * 0.4;

      // Emit new wave pulse every pulseInterval
      if (elapsedTime - lastPulseTime >= pulseInterval && currentOpacity > 0.5) {
        lastPulseTime = elapsedTime;

        // Remove oldest wave if at max
        if (waves.length >= maxWaves) {
          const oldWave = waves.shift();
          if (oldWave) {
            container.remove(oldWave.mesh);
            oldWave.mesh.geometry.dispose();
       //     oldWave.mesh.material.dispose();
          }
        }

        // Create new expanding wave
        const newWaveMesh = createWaveMesh();
        container.add(newWaveMesh);
        waves.push({
          mesh: newWaveMesh,
          birthTime: elapsedTime,
          maxRadius: 3.5,
        });
      }

      // Update expanding waves
      for (let i = 0; i < waves.length; i++) {
        const wave = waves[i];
        const waveAge = elapsedTime - wave.birthTime;
        const waveDuration = 1.2;
        const waveProgress = Math.min(waveAge / waveDuration, 1.0);

        // Expand outward
        const currentRadius = wave.maxRadius * waveProgress;
        wave.mesh.scale.set(currentRadius, currentRadius, currentRadius);

        // Fade out as it expands
        const fadeOut = Math.max(0, 1.0 - waveProgress * 1.5);
        (wave.mesh.material as THREE.MeshPhongMaterial).opacity = fadeOut * currentOpacity;

        // Remove dead waves
        if (waveProgress >= 1.0) {
          container.remove(wave.mesh);
          wave.mesh.geometry.dispose();
//        wave.mesh.material.dispose();
          waves.splice(i, 1);
          i--;
        }
      }

      // Rotate rings for visual complexity
      innerRing.rotation.z += dtSeconds * 0.8;
      midRing.rotation.y += dtSeconds * 1.2;
      outerRing.rotation.x += dtSeconds * 0.5;

      // Core pulse (brightness rhythm)
      const corePulse = Math.sin(elapsedTime * 3.0) * 0.3 + 0.7;
      coreMaterial.emissiveIntensity = corePulse;

      // Focus state
      const focusScale = state === "focused" ? 1.3 : 1.0;
      container.scale.lerp(new THREE.Vector3(focusScale, focusScale, focusScale), 0.1);
    },

    dispose() {
      coreGeometry.dispose();
      coreMaterial.dispose();
      innerRingGeometry.dispose();
      innerRingMaterial.dispose();
      midRingGeometry.dispose();
      midRingMaterial.dispose();
      outerRingGeometry.dispose();
      outerRingMaterial.dispose();

      for (const wave of waves) {
        wave.mesh.geometry.dispose();
        //wave.mesh.material.dispose();
      }
      waves.length = 0;
    },
  };
}
