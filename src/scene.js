import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let scene, camera, renderer, clock;

export const setupScene = (container) => {
  // 1. Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111111);
  scene.fog = new THREE.FogExp2(0x111111, 0.02); // Reduced fog for better visibility of model

  // 2. Camera
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 1.6, 2); // Start behind character (Third Person)

  // 3. Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  // 4. Clock
  clock = new THREE.Clock();

  // 5. Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // Increased from 0.2
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 2.0); // Increased from 1.5
  dirLight.position.set(5, 10, 5);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 20;
  // Tight shadow box for the room
  dirLight.shadow.camera.left = -10;
  dirLight.shadow.camera.right = 10;
  dirLight.shadow.camera.top = 10;
  dirLight.shadow.camera.bottom = -10;
  dirLight.shadow.bias = -0.0005;
  scene.add(dirLight);

  // Fill lights / Rim lights for cinematic look
  const blueLight = new THREE.PointLight(0x0055ff, 2, 10);
  blueLight.position.set(-4, 3, -4);
  scene.add(blueLight);

  const orangeLight = new THREE.PointLight(0xff5500, 1, 10);
  orangeLight.position.set(4, 2, 4);
  scene.add(orangeLight);
  
  // 7. Lightning Light
  lightningLight = new THREE.PointLight(0xaaddff, 0, 100);
  lightningLight.position.set(0, 5, 0);
  scene.add(lightningLight);

  // 8. Indoor Ceiling Lights (Procedural)
  const ceilingLightColor = 0xffaa77; // Warm Tungsten
  const positions = [
      new THREE.Vector3(0, 3.8, 0),
      new THREE.Vector3(0, 3.8, 3),
      new THREE.Vector3(0, 3.8, -3)
  ];
  
  positions.forEach(pos => {
      // Light
      const pl = new THREE.PointLight(ceilingLightColor, 3.0, 12); 
      pl.position.copy(pos);
      scene.add(pl);
      
      // Visual Bulb
      const bulbGeo = new THREE.SphereGeometry(0.1, 16, 8);
      const bulbMat = new THREE.MeshBasicMaterial({ color: ceilingLightColor });
      const bulb = new THREE.Mesh(bulbGeo, bulbMat);
      bulb.position.copy(pos);
      
      // Setup Breakable Data
      bulb.userData = { 
          type: 'light', 
          linkedLight: pl,
          breakable: true 
      };
      
      scene.add(bulb);
  });
  
  // 9. Procedural Breakable Crates
  const crateGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.9 }); // Wood
  
  const cratePositions = [
      new THREE.Vector3(2, 0.25, 2),
      new THREE.Vector3(-2, 0.25, -2),
      new THREE.Vector3(2.5, 0.25, -1),
      new THREE.Vector3(-1.5, 1.25, -2.5) // Stacked?
  ];
  
  cratePositions.forEach(p => {
      const crate = new THREE.Mesh(crateGeo.clone(), crateMat); // Clone geo for independent destruction
      crate.position.copy(p);
      crate.castShadow = true;
      crate.receiveShadow = true;
      crate.userData = { 
          type: 'crate', 
          breakable: true 
      };
      scene.add(crate);
  });

  // 9. Basic Environment (Shooting Range Shell)
  setupEnvironment(scene);

  return { scene, camera, renderer, clock };
};

let lightningLight;
let lightningTimer = 0;
let lightningDuration = 0;

const setupEnvironment = (scene) => {
  const loader = new GLTFLoader();
  loader.load('/models/room.glb', (gltf) => {
      const room = gltf.scene;
      room.traverse((child) => {
          if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              
              // Enhance material if needed
              if (child.material.map) {
                  child.material.map.anisotropy = 16;
              }
          }
      });
      room.position.set(0, 0, 0);
      scene.add(room);
  }, undefined, (error) => {
      console.error('An error occurred loading the room:', error);
      // Fallback to minimal floor if load fails
      const floorGeo = new THREE.PlaneGeometry(20, 20);
      const floorMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
      const floor = new THREE.Mesh(floorGeo, floorMat);
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      scene.add(floor);
  });
};

export const updateScene = (dt) => {
  // Lightning Logic
  if (lightningDuration > 0) {
      lightningDuration -= dt;
      lightningLight.intensity = Math.random() * 20; // Flicker
      lightningLight.position.x = (Math.random() - 0.5) * 10;
  } else {
      lightningLight.intensity = 0;
      lightningTimer -= dt;
      if (lightningTimer <= 0) {
           // Output event so AudioController can play sound? 
           // For now just visual here, ideally we have an event bus.
           // Trigger Flash
           lightningDuration = 0.1 + Math.random() * 0.2;
           lightningTimer = 3 + Math.random() * 5; // Next flash in 3-8s
           
           // Dispatch event for audio
           window.dispatchEvent(new CustomEvent('lightning-strike'));
      }
  }
};
