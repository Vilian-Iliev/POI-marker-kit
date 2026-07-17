import * as THREE from "three";
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls";

export const threeRenderer = new THREE.WebGLRenderer();
threeRenderer.setSize(window.innerWidth, window.innerHeight);



export const camera = new THREE.PerspectiveCamera(75, window.innerWidth / 
                                                window.innerHeight, 0.1, 1000);
                                                
export const orbitControls = new OrbitControls(camera, threeRenderer.domElement);
