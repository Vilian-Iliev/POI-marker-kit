import * as THREE from "three";
import { camera, threeRenderer } from "../render/threeRenderer";

export const galleryScene = new THREE.Scene();
galleryScene.background = new THREE.Color(0x000000);
const ambientLight = new THREE.AmbientLight(0xffffff, 3);
galleryScene.add(ambientLight);
camera.position.set(0, 0, 10);



