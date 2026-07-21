import * as THREE from "three";
import { galleryScene } from "../scene/scene";
import { createBreathingOrb } from "../markers/styles/breathingOrb";
import { createFuturisticMarker } from "../markers/styles/futuristicMarker";
import { createLighthouse } from "../markers/styles/lighthouse";
//import { createOrbitingConstellation } from "../markers/styles/orbitingConstellation";
//import { createCrystallineSikeTower } from "../markers/styles/crystallineSpikeTower";
import { createMarker as createPlumbob } from "../markers/styles/plumbobMarker";
import { createMarker as createRibbonWave } from "../markers/styles/ribbonWave";
import { createMarker as createCrystalFlower } from "../markers/styles/crystalFlower";
import { createMarker as createCompassGyro } from "../markers/styles/compassGyro";
import { createMarker as createSignalPillar } from "../markers/styles/signalPillar";
import { store } from "../markers/store";
import { addMarker, vector3ToPlain } from "../markers/markerStateMachine";
import type { PoiData, MarkerData } from "../markers/markerStateMachine.ts";
import { Marker } from "../markers/markerController";

type MarkerCreatorFn = (position: THREE.Vector3, data: PoiData) => any;

interface GalleryMarker {
  controller: Marker;
  marker3d: any;
  data: MarkerData;
  update(dtSeconds: number, camera: THREE.Camera): void;
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
      creator: createFuturisticMarker,
      name: "Energy Vortex",
      position: new THREE.Vector3(0, 0, 0),
    },
    {
      creator: createLighthouse,
      name: "Crystalline Growth",
      position: new THREE.Vector3(0, 0, 0),
    },
    {
      creator: createPlumbob,
      name: "Plumbob",
      position: new THREE.Vector3(0, 0, 0),
    },
    {
      creator: createRibbonWave,
      name: "Ribbon Wave",
      position: new THREE.Vector3(0, 0, 0),
    },
    {
      creator: createCrystalFlower,
      name: "Crystal Flower",
      position: new THREE.Vector3(0, 0, 0),
    },
    {
      creator: createCompassGyro,
      name: "Compass Gyro",
      position: new THREE.Vector3(0, 0, 0),
    },
    {
      creator: createSignalPillar,
      name: "Signal Pillar",
      position: new THREE.Vector3(0, 0, 0),
    },
  ];

  for (let i = 0; i < markerConfigs.length; i++) {
    const config = markerConfigs[i];
    const data: PoiData = { name: config.name, iconUrl: "" };
    const marker3d = config.creator(config.position, data);

    // Create a Marker controller that manages camera-based state transitions
    const markerController = new Marker(config.position, data);

    galleryScene.add(marker3d.mesh);
    galleryScene.add(markerController.object3d);
    marker3d.mesh.visible = i === 0;
    const markerData: MarkerData = {
      name: config.name,
      label: config.name,
      imageAdress: data.iconUrl || "",
      position: vector3ToPlain(config.position),
      anchorOffset: vector3ToPlain(new THREE.Vector3(0, 0, 0)),
      currentState: "hidden",
    };

    store.dispatch(addMarker(markerData));
    const storeIndex = store.getState().markerState.length - 1;
    const galleryMarker: GalleryMarker = {
      controller: markerController,
      marker3d,
      data: markerData,
      update(dtSeconds: number, camera: THREE.Camera) {
        // Let the Marker controller handle state transitions based on camera
        markerController.update(dtSeconds, camera);

        // Get the updated state from Redux store
        const live = store.getState().markerState[storeIndex];
        const stateToUse = live ? live.currentState : markerData.currentState;
        console.log(`gallery marker ${storeIndex} state:`, stateToUse);
        // Update the visual marker with the new state
        marker3d.update(dtSeconds, stateToUse);
      },
      dispose() {
        marker3d.dispose();
        markerController.dispose();
        galleryScene.remove(marker3d.mesh);
        galleryScene.remove(markerController.object3d);
      },
    };

    galleryMarkers.push(galleryMarker);
  }
}

export function updateGallery(dtSeconds: number, camera: THREE.Camera) {
  for (const marker of galleryMarkers) {
    marker.update(dtSeconds, camera);
  }
}

export function disposeGallery() {
  for (const marker of galleryMarkers) {
    marker.dispose();
  }
  galleryMarkers.length = 0;
}

/**
 * Switch visibility to a specific marker by index
 */
export function switchToMarker(index: number) {
  if (index < 0 || index >= galleryMarkers.length) {
    console.warn(`Invalid marker index: ${index}`);
    return;
  }

  // Hide all markers
  for (const marker of galleryMarkers) {
    marker.marker3d.mesh.visible = false;
  }

  // Show the selected marker
  galleryMarkers[index].marker3d.mesh.visible = true;
}

export { galleryMarkers };
