import * as THREE from "three";
import { galleryScene } from "../scene/scene";
import { createBreathingOrb } from "../markers/styles/breathingOrb";
import { createOrbitingConstellation } from "../markers/styles/orbitingConstellation";
import { createCrystallineSikeTower } from "../markers/styles/crystallineSpikeTower";
import { store } from "../markers/store";
import { addMarker } from "../markers/markerStateMachine";
import type { PoiData, MarkerData } from "../markers/markerStateMachine";

type MarkerCreatorFn = (position: THREE.Vector3, data: PoiData) => any;

interface GalleryMarker {
  marker3d: any;
  data: MarkerData;
  update(dtSeconds: number): void;
  dispose(): void;
}

const galleryMarkers: GalleryMarker[] = [];

/**
 * Initialize gallery with one marker of each type (Ripple Pulse, Energy Vortex, Crystalline Growth)
 * Only the first marker is visible initially
 */
export function initializeGallery() {
  // Define one marker of each unique type
  const markerConfigs: Array<{
    creator: MarkerCreatorFn;
    name: string;
    position: THREE.Vector3;
  }> = [
    {
      creator: createBreathingOrb,
      name: "Ripple Pulse",
      position: new THREE.Vector3(0, 0, 0),
    },
    {
      creator: createOrbitingConstellation,
      name: "Energy Vortex",
      position: new THREE.Vector3(0, 0, 0),
    },
    {
      creator: createCrystallineSikeTower,
      name: "Crystalline Growth",
      position: new THREE.Vector3(0, 0, 0),
    },
  ];

  for (let i = 0; i < markerConfigs.length; i++) {
    const config = markerConfigs[i];
    const data: PoiData = { name: config.name, iconUrl: "" };

    // Create the marker 3D object
    const marker3d = config.creator(config.position, data);

    // Add to scene
    galleryScene.add(marker3d.mesh);

    // Initially hide all markers except the first one
    marker3d.mesh.visible = i === 0;

    // Create marker data for state management
    const markerData: MarkerData = {
      name: config.name,
      label: config.name,
      imageAdress: data.iconUrl || "",
      position: config.position,
      anchorOffset: new THREE.Vector3(0, 0, 0),
      currentState: "idle",
      object3d: marker3d.mesh,
    };

    // Add to Redux store
    store.dispatch(addMarker(markerData));

    // Create gallery marker wrapper
    const galleryMarker: GalleryMarker = {
      marker3d,
      data: markerData,
      update(dtSeconds: number) {
        marker3d.update(dtSeconds, markerData.currentState);
      },
      dispose() {
        marker3d.dispose();
        galleryScene.remove(marker3d.mesh);
      },
    };

    galleryMarkers.push(galleryMarker);
  }
}

/**
 * Update all gallery markers (call once per frame)
 */
export function updateGallery(dtSeconds: number) {
  for (const marker of galleryMarkers) {
    marker.update(dtSeconds);
  }
}

/**
 * Clean up gallery resources
 */
export function disposeGallery() {
  for (const marker of galleryMarkers) {
    marker.dispose();
  }
  galleryMarkers.length = 0;
}

export { galleryMarkers };
