# Hyster - Cinematic Browser Shooter Demo

**Hyster** is a hyper-realistic, browser-based 3D shooter tech demo built with **Three.js** and **Vite**. It features high-end cinematic rendering, procedural audio atmospheres, and arcade-style shooting mechanics.

## 🌟 Key Features

### 🎥 Cinematic Rendering

- **ACES Filmic Tone Mapping**: Industry-standard color grading for photorealistic lighting.
- **Soft Shadows**: PCF Soft Shadow mapping for realistic depth.
- **Volumetric-Style Fog**: Atmospheric depth using `FogExp2`.
- **Dynamic Lighting**: Procedural thunderstorms with synchronized visual flashes.

### 🎮 Gameplay Mechanics

- **Third-Person Controller**: Smooth WASD movement with gravity and jumping physics.
- **Dynamic Aim System**:
  - **Right-Click Zoom**: Tightens FOV (60 -> 30) and shifts camera for precision.
  - **Variable Accuracy**: Movement increases bullet spread; aiming eliminates it.
  - **Recoil**: Procedural camera and spine recoil on firing.
- **Visual Ballistics**: Glowing orange bullet tracers and muzzle flashes.
- **Impact System**: Procedurally generated bullet decals (scorched holes) and spark particles on all surfaces.

### 🔊 Immersive Audio

- **Procedural Atmosphere**: Generates a runtime "Dark Drone" ambience using Web Audio Oscillators (Saw/Sine/Triangle).
- **Spatial 3D Sound**: Gunshots and footsteps are positioned in 3D space.
- **Text-to-Speech Intro**: System voice "Welcome" message generated via Web Speech API.
- **Thunder System**: Randomized thunder cracks synced with lighting flashes.

## 🕹️ Controls

| Key                    | Action                      |
| :--------------------- | :-------------------------- |
| **W, A, S, D**         | Move Character              |
| **SPACE**              | Jump                        |
| **MOUSE**              | Look / rotate Camera        |
| **LEFT CLICK**         | Fire Weapon                 |
| **RIGHT CLICK (Hold)** | Aim Down Sights (Zoom)      |
| **CLICK SCREEN**       | Capture Mouse / Start Audio |

## 🚀 Installation & Running

1.  **Clone / Open the project**

    ```bash
    cd "Fpv Shooter Demo"
    ```

2.  **Install Dependencies**

    ```bash
    npm install
    ```

3.  **Run Development Server**

    ```bash
    npm run dev
    ```

4.  **Play**
    - Open the URL shown (usually `http://localhost:5173`).
    - Click anywhere on the screen to initialize the Audio Context and Pointer Lock.

## 📁 Project Structure

```
/public
  /models       # .glb assets (Soldier, Gun, Room)
  /sounds       # .wav assets (Gunshot, Walk)
/src
  main.js       # Entry point, Game Loop, Event Listeners
  scene.js      # Three.js Setup, Lighting, Post-Processing
  characterController.js # Movement, Physics, Shooting, Animations
  inputController.js     # Keyboard/Mouse state management
  animationController.js # GLTF Animation mixing (Idle/Walk/Aim)
  audioController.js     # Web Audio API engine (Ambience, SFX)
```

## 🛠️ Customization

- **Adjust Lighting**: Edit `scene.js` to change light colors or intensity.
- **Tweak Physics**: Edit `GRAVITY` and `SPEED` in `characterController.js`.
- **Change Audio**: Replace files in `/public/sounds/` or edit the oscillator frequencies in `audioController.js`.

---

_Built with Three.js_
