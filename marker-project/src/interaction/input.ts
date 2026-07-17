import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/Addons.js";
import { camera, threeRenderer } from "../render/threeRenderer";

export const controls = new OrbitControls(camera, threeRenderer.domElement);