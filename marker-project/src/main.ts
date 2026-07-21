import { camera, threeRenderer } from "./render/threeRenderer";
import { galleryScene } from "./scene/scene";
import "./style.css";
import * as THREE from "three";
import type { Marker } from "./markers/markerController.ts";
import { controls } from "./interaction/input.ts";
import {
  changeState,
  selectMarkerState,
} from "./markers/markerStateMachine.ts";
import { store } from "./markers/store.ts";
import {
  initializeGallery,
  updateGallery,
  disposeGallery,
  switchToMarker,
} from "./marker-gallery/galleryInitializer.ts";

// offset text box
// click event to select marker
document.body.appendChild(threeRenderer.domElement);
let index = 0;

const offsetInput = document.createElement("input");
offsetInput.type = "number";
offsetInput.placeholder = "Enter offset value";
offsetInput.value = "0";
//offsetInput.style.position = 'absolute';
offsetInput.style.position = "fixed";
offsetInput.style.top = "12px";
offsetInput.style.left = "12px";
offsetInput.style.zIndex = "10";

offsetInput.addEventListener("input", (event) => {
  camera.position.z = parseFloat((event.target as HTMLInputElement).value);
});

document.body.appendChild(offsetInput);

// Initialize gallery with breathing orb markers
initializeGallery();

// Test cube (optional - comment out if not needed)
// const geo = new THREE.BoxGeometry(1, 1, 1);
// const mat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
// const cube = new THREE.Mesh(geo, mat);
// galleryScene.add(cube);

window.addEventListener("keydown", (event) => {
  if (event.key == "Enter") {
    const markerCount = store.getState().markerState.length;
    index = (index + 1) % markerCount;
    switchToMarker(index);
    store.dispatch(changeState({ index: index, state: "revealing" }));
  }
});

function animate() {
  requestAnimationFrame(animate);
  const dtSeconds = 1 / 60; // Assume 60 FPS for frame delta time
  updateGallery(dtSeconds);
  threeRenderer.render(galleryScene, camera);
  controls.update();
}
animate();
