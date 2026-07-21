import * as THREE from "three";
import { changeState, initialMarkerData, selectMarkerArray } from "./markerStateMachine.ts";
import type { MarkerData, MarkerState, PoiData } from "./markerStateMachine.ts";
import {config} from "../config.ts";
import {calculateDistance} from "../spatial/distance.ts";
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
    constructor(position: THREE.Vector3, data: PoiData) {
        this.markerData = {
            name: data.name || "Unnamed",
            label: data.name || "Unnamed",
            imageAdress: data.iconUrl || "",
            position: position,
            anchorOffset: new THREE.Vector3(0,0,config.hoverHeight),
            currentState:'hidden',
            object3d: new THREE.Object3D()
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
        var revealRange = calculateDistance(camera.position, this.object3d.position) <= config.revealDistance; //placeholder for now
        var hideRange = calculateDistance(camera.position, this.object3d.position) > config.hideDistance; //placeholder for now
        var isFocused = objectIsInView(camera.position, this.object3d.position, config.focusAngle); //placeholder for now
        var isInFocusDistance = calculateDistance(camera.position, this.object3d.position) <= config.focusDistance; //placeholder for now
        
        //const possibleStates: MarkerState[] = [];
        let index = selectMarkerArray(store.getState()).findIndex(marker => marker.name === this.markerData.name);

        if(this.markerData.currentState === 'hidden'){
            if(revealRange)
                store.dispatch(changeState({ index: index, state: 'revealing' }));
            else return;
        }else if(this.markerData.currentState === 'revealing')
                store.dispatch(changeState({ index: index, state: 'idle' }));
         else if(this.markerData.currentState === 'idle'){
                if(isFocused && dtSeconds >= config.focusDwellMs/1000 && isInFocusDistance)
                    store.dispatch(changeState({ index: index, state: 'focused' }));
                else if(hideRange)
                    store.dispatch(changeState({ index: index, state: 'hiding' }));
         }else if(this.markerData.currentState === 'focused'){
                if(!isFocused)
                    store.dispatch(changeState({ index: index, state: 'idle' }));
                else if(hideRange)
                    store.dispatch(changeState({ index: index, state: 'hiding' }));
            }else if(this.markerData.currentState === 'hiding'){
                store.dispatch(changeState({ index: index, state: 'hidden' }));
            }
    }    
}
