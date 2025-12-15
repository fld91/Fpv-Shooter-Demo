import "./style.css";
import * as THREE from "three";
import { setupScene, updateScene } from "./scene.js";
import { InputController } from "./inputController.js";
import { CharacterController } from "./characterController.js";

// --- Initialization ---
const init = async () => {
  const container = document.body; // or a specific div

  // 1. Setup Scene (Renderer, Camera, Scene, Lights, Environment)
  const { scene, camera, renderer, clock } = setupScene(container);

  // 2. Setup Input
  const inputController = new InputController();

  // 3. Setup Character
  const characterController = new CharacterController(
    scene,
    camera,
    inputController
  );
  await characterController.load(); // Load assets

  // 4. Game Loop
  const animate = () => {
    requestAnimationFrame(animate);

    const dt = clock.getDelta();

    // Update Systems
    inputController.update(); // Poll inputs if needed
    characterController.update(dt);
    updateScene(dt);

    renderer.render(scene, camera);
  };

  animate();

  // Handle Resize
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  });
};

init();
