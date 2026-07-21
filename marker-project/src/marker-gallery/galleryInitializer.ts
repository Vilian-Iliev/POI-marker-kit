import * as THREE from "three";
import { galleryScene } from "../scene/scene";
import { createBreathingOrb } from "../markers/styles/breathingOrb";
import { createFuturisticMarker } from "../markers/styles/futuristicMarker";
import { createLighthouse } from "../markers/styles/lighthouse";
import { createOrbitingConstellation } from "../markers/styles/orbitingConstellation";
import { createCrystallineSikeTower } from "../markers/styles/crystallineSpikeTower";
import { createMarker as createPlumbob } from "../markers/styles/plumbobMarker";
import { createMarker as createRibbonWave } from "../markers/styles/ribbonWave";
import { createMarker as createCrystalFlower } from "../markers/styles/crystalFlower";
import { createMarker as createCompassGyro } from "../markers/styles/compassGyro";
import { createMarker as createSignalPillar } from "../markers/styles/signalPillar";
import { store } from "../markers/store";
import { addMarker } from "../markers/markerStateMachine";
import type { PoiData, MarkerData } from "../markers/markerStateMachine.ts";

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

    galleryScene.add(marker3d.mesh);
    marker3d.mesh.visible = i === 0;
    const markerData: MarkerData = {
      name: config.name,
      label: config.name,
      imageAdress: data.iconUrl || "",
      position: config.position,
      anchorOffset: new THREE.Vector3(0, 0, 0),
      currentState: "idle",
      object3d: marker3d.mesh,
    };

    store.dispatch(addMarker(markerData));
    const storeIndex = store.getState().markerState.length - 1;
    const galleryMarker: GalleryMarker = {
      marker3d,
      data: markerData,
      update(dtSeconds: number) {
        const live = store.getState().markerState[storeIndex];
        const stateToUse = live ? live.currentState : markerData.currentState;
        marker3d.update(dtSeconds, stateToUse);
      },
      dispose() {
        marker3d.dispose();
        galleryScene.remove(marker3d.mesh);
      },
    };

    galleryMarkers.push(galleryMarker);
  }
}

export function updateGallery(dtSeconds: number) {
  for (const marker of galleryMarkers) {
    marker.update(dtSeconds);
  }
}

export function disposeGallery() {
  for (const marker of galleryMarkers) {
    marker.dispose();
  }
  galleryMarkers.length = 0;
}

export { galleryMarkers };
