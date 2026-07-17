import * as THREE from 'three';
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/** Lifecycle states — driven by the harness/app, rendered by the style. */
export type MarkerState = 'hidden' | 'revealing' | 'idle' | 'focused' | 'hiding';

// hidden -> revealing 
// revealing -> idle 
// idle -> focused / hiding
// focused -> idle / hiding
// hiding -> hidden

/*export var legalTransitions: Record<MarkerState, MarkerState[]> = { // Dictionary of legal transitions
  hidden: ['revealing'],
  revealing: ['idle'],
  idle: ['focused', 'hiding'],
  focused: ['idle', 'hiding'],
  hiding: ['hidden']
}; */

/**
 * The data OFFER. Every field is optional, and — important! — a style
 * decides for itself which fields it renders. Setting a name does NOT
 * guarantee the user will ever see it.
 */

export interface PoiData {
  name?: string;
  iconUrl?: string;
  distanceMeters?: number; // kept up to date by the harness/app every frame
}

export type MarkerData = {
    name:String;
    label:String;
    imageAdress:String;
    position:THREE.Vector3;
    anchorOffset:THREE.Vector3;
    currentState:MarkerState;
    object3d:THREE.Object3D;
}


export const initialMarkerData: MarkerData[] = [];
//const initialMarkerState: MarkerState = 'idle';

export const markerStateSlice = createSlice({
  name: 'markerState',
  initialState: initialMarkerData,
  reducers: {
    changeState: (state, action: PayloadAction<{ index: number; state: MarkerState }>) => {
      state[action.payload.index].currentState = action.payload.state;
    },
    addMarker: (state, action: PayloadAction<MarkerData>) => {
      state.push(action.payload);
    }
  }
});

export const { changeState, addMarker } = markerStateSlice.actions;
export const selectMarkerArray = (state: { markerState: MarkerData[] }) => state.markerState;
//export const selectMarkerByIndex = (state: { markerState: MarkerData[] }, index: number) => state.markerState[index];
export const selectMarkerState = (state: { markerState: MarkerData[] }, index: number) => state.markerState[index].currentState;