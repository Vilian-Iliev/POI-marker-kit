import * as THREE from "three";
import {
  changeState,
  selectMarkerArray,
  vector3ToPlain,
} from "./markerStateMachine.ts";
import type { MarkerData, PoiData } from "./markerStateMachine.ts";
import { config } from "../config.ts";
import { calculateDistance } from "../spatial/distance.ts";
import { objectIsInView } from "../interaction/attention.ts";
import { store } from "./store.ts";

interface PoiMarker {
  /** Root object; the harness adds/removes it from the scene. */
  readonly object3d: THREE.Object3D;
  /** Called every frame. */
  update(dtSeconds: number, camera: THREE.Camera): void;
  /** The harness drives the lifecycle; the style animates the transition. */
  setData(data: PoiData): void;
  /** Free ALL GPU resources this marker created. */
  dispose(): void;
  markerData: MarkerData;
}

export class Marker implements PoiMarker {
  object3d: THREE.Object3D;
  markerData: MarkerData;
  private focusDwellAccumulator: number = 0;
  private stateTimer: number = 0;
  constructor(position: THREE.Vector3, data: PoiData) {
    this.markerData = {
      name: data.name || "Unnamed",
      label: data.name || "Unnamed",
      imageAdress: data.iconUrl || "",
      position: vector3ToPlain(position),
      anchorOffset: vector3ToPlain(new THREE.Vector3(0, 0, config.hoverHeight)),
      currentState: "hidden",
    };
    this.object3d = new THREE.Object3D();
    this.object3d.position.copy(position);
  }

  setData(data: PoiData): void {
    this.markerData.name = data.name || this.markerData.name;
    this.markerData.label = data.name || this.markerData.label;
    this.markerData.imageAdress = data.iconUrl || this.markerData.imageAdress;
  }

  dispose(): void {
    this.object3d.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.geometry) {
          child.geometry.dispose();
        }
        child.material.dispose();
        child.removeFromParent();
      }
    });
    this.object3d.removeFromParent();
    // might need adjustment?
  }

  update(dtSeconds: number, camera: THREE.Camera): void {
    var revealRange =
      calculateDistance(camera.position, this.object3d.position) <=
      config.revealDistance;
    var hideRange =
      calculateDistance(camera.position, this.object3d.position) >
      config.hideDistance;
    // objectIsInView now checks both focusDistance and focusAngle from config
    var isFocused = objectIsInView(
      camera.position,
      this.object3d.position,
      config.focusAngle,
    );

    let index = selectMarkerArray(store.getState()).findIndex(
      (marker) => marker.name === this.markerData.name,
    );

    // Read current state from Redux store, not from local copy
    const currentState =
      store.getState().markerState[index]?.currentState || "hidden";

    // Track time in current state
    this.stateTimer += dtSeconds;

    // Track focus dwell time
    if (isFocused) {
      this.focusDwellAccumulator += dtSeconds;
    } else {
      this.focusDwellAccumulator = 0;
    }

    if (currentState === "hidden") {
      if (revealRange)
        store.dispatch(changeState({ index: index, state: "revealing" }));
      else return;
    } else if (currentState === "revealing") {
      // Stay in revealing for ~1.0 second to let animation play
      if (this.stateTimer >= 1.0) {
        store.dispatch(changeState({ index: index, state: "idle" }));
        this.stateTimer = 0;
      }
    } else if (currentState === "idle") {
      if (isFocused && this.focusDwellAccumulator >= config.focusDwellMs / 1000)
        store.dispatch(changeState({ index: index, state: "focused" }));
      else if (hideRange)
        store.dispatch(changeState({ index: index, state: "hiding" }));
    } else if (currentState === "focused") {
      if (!isFocused)
        store.dispatch(changeState({ index: index, state: "idle" }));
      else if (hideRange)
        store.dispatch(changeState({ index: index, state: "hiding" }));
    } else if (currentState === "hiding") {
      // Stay in hiding for ~0.6 second to let animation play
      if (this.stateTimer >= 0.6) {
        store.dispatch(changeState({ index: index, state: "hidden" }));
        this.stateTimer = 0;
      }
    }

    // Reset state timer when state changes
    if (store.getState().markerState[index]?.currentState !== currentState) {
      this.stateTimer = 0;
    }
  }
}
