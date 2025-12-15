import * as THREE from 'three';
import { AudioController } from './audioController.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { AnimationController } from './animationController.js';

export class CharacterController {
  constructor(scene, camera, input) {
    this.scene = scene;
    this.camera = camera;
    this.input = input;
    
    this.audio = new AudioController(camera);
    
    // State
    this.position = new THREE.Vector3(0, 0, 0);
    this.velocity = new THREE.Vector3();
    this.isGrounded = true;
    
    // Camera settings
    this.cameraOffset = new THREE.Vector3(0.5, 1.7, 1.5); // Right shoulder
    this.cameraLookAt = new THREE.Vector3(0, 1.7, -10);
    this.yaw = 0;
    this.pitch = 0;

    // Movement
    this.speed = 3.0; // Walk speed
    
    // Weapon logic
    this.lastShotTime = 0;
    this.fireRate = 0.15; // 150ms
    this.recoil = { x: 0, y: 0 };
    this.currentRecoil = { x: 0, y: 0 };
    this.stepTimer = 0;

    this.characterGroup = new THREE.Group();
    
    this.animationController = null;
    this.muzzle = null;
  }

  async load() {
    await this.audio.load();
    const loader = new GLTFLoader();

        // Load Soldier
    try {
        const soldierGltf = await new Promise((resolve, reject) => loader.load('/models/soldier.glb', resolve, undefined, reject));
        const soldier = soldierGltf.scene;
        
        // Fix Orientation: Rotate 180 degrees to face away from camera if it faces screen
        soldier.rotation.y = Math.PI; 
        
        soldier.traverse(c => {
           if(c.isMesh) { c.castShadow = true; c.receiveShadow = true; } 
        });
        
        this.characterGroup.add(soldier);

        // Setup Animations
        console.log("Animations found:", soldierGltf.animations.map(a => a.name)); // DEBUG LOG
        this.animationController = new AnimationController(soldierGltf);
        
        // Try to play *anything* first if specific names fail, or just list them.
        const animNames = soldierGltf.animations.map(a => a.name.toLowerCase());
        
        // Heuristic to find Idle/Walk
        const idleAnim = animNames.find(n => n.includes('idle')) || animNames[0]; // Fallback to first
        const walkAnim = animNames.find(n => n.includes('walk') || n.includes('run'));
        const aimAnim = animNames.find(n => n.includes('aim'));
        
        // Store mapped names in controller for usage in update
        this.animMap = {
            idle: idleAnim,
            walk: walkAnim || idleAnim,
            aim: aimAnim || idleAnim
        };

        this.animationController.play(this.animMap.idle);

        // Load Gun
        const gunGltf = await new Promise((resolve, reject) => loader.load('/models/gun.glb', resolve, undefined, reject));
        const gun = gunGltf.scene;
        gun.traverse(c => {
           if(c.isMesh) { c.castShadow = true; c.receiveShadow = true; } 
        });

        // Attach Gun to Right Hand
        // Broad search for "Hand" or "RightHand" or "mixamorigRightHand"
        let rightHand = null;
        soldier.traverse((child) => {
            if (child.isBone && (child.name.includes('RightHand') || child.name.includes('Hand.R'))) {
                rightHand = child;
            }
        });

        if (rightHand) {
            rightHand.add(gun);
            gun.position.set(0, 0, 0); 
            gun.rotation.set(0, 0, 0);
        } else {
            console.warn('RightHand bone not found, attaching gun to body');
            gun.position.set(0.2, 1.5, 0.4);
            this.characterGroup.add(gun);
        }
        
        // Find Spine for Recoil
        this.spine = null;
        soldier.traverse((child) => {
             if (child.isBone && (child.name.includes('Spine') || child.name.includes('Spine1'))) {
                 this.spine = child;
             }
        });
        
        this.gunMesh = gun; // For muzzle flash reference
        
        // Muzzle position (approx, relative to gun)
        this.muzzle = new THREE.Object3D();
        this.muzzle.position.set(0, 0.1, -1); // Check gltf forward axis
        this.gunMesh.add(this.muzzle);

    } catch (e) {
        console.error("Failed to load assets, using placeholder", e);
        this._createPlaceholderCharacter();
    }

    this.scene.add(this.characterGroup);
  }
  
  _createPlaceholderCharacter() {
      // Simple capsule-like shape
      const mat = new THREE.MeshStandardMaterial({ color: 0x445566, roughness: 0.8 });
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 1, 4, 8), mat);
      body.position.y = 0.9;
      this.characterGroup.add(body);

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.25), mat);
      head.position.y = 1.6;
      this.characterGroup.add(head);

      // Gun
      const gunGeo = new THREE.BoxGeometry(0.1, 0.1, 0.6);
      const gunMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
      this.gunMesh = new THREE.Mesh(gunGeo, gunMat);
      this.gunMesh.position.set(0.3, 1.5, 0.4);
      this.characterGroup.add(this.gunMesh);
      
      this.muzzle = new THREE.Object3D();
      this.muzzle.position.set(0, 0, -0.3); // End of gun barrel
      this.gunMesh.add(this.muzzle);
  }

  update(dt) {
      if (!this.characterGroup) return;

      if (this.animationController && this.animMap) {
          // ... animation logic ...
          if (this.input.mouse.rightButton) {
              this.animationController.play(this.animMap.aim);
          } else if (this.input.keys.w || this.input.keys.s || this.input.keys.a || this.input.keys.d) {
              this.animationController.play(this.animMap.walk); 
          } else {
              this.animationController.play(this.animMap.idle);
          }
          
          this.animationController.update(dt);
      }
      
      // Procedural Spine Recoil Update
      if (this.spine) {
          // Lerp back to neutral (0,0,0 relative to parent usually, but safer to add diff)
          // We'll actually dampen a separate "recoilRotation" vector and apply it on top of existing rotation if possible,
          // but altering the bone directly is easier for now.
          // CAUTION: AnimationMixer overwrites bone rotations every frame. 
          // Solution: Modify AFTER mixer.update() (which we do above).
          
          // Apply dampening to current recoil force
           this.recoil.x = THREE.MathUtils.lerp(this.recoil.x, 0, dt * 15); // Pitch return
           this.recoil.y = THREE.MathUtils.lerp(this.recoil.y, 0, dt * 15); // Yaw jitter return
           
           // Apply to spine (Cumulative to animation)
           // Rotating X axis usually curls spine forward/back
           this.spine.rotation.x += this.recoil.x;
           this.spine.rotation.y += this.recoil.y;
      }

      this._handleMouseLook(dt);
      this._handleMovement(dt);
      this._handleWeapon(dt);
      
      // Sync Camera
      this._updateCamera();

      // Reset input deltas for next frame handling (consumed)
      this.input.resetDeltas();
  }

  _handleMouseLook(dt) {
      let sensitivity = 0.002;
      if (this.input.mouse.rightButton) {
          sensitivity = 0.0005; // Slower when aiming
      }
      
      this.yaw -= this.input.mouse.deltaX * sensitivity;
      this.pitch -= this.input.mouse.deltaY * sensitivity;

      // Clamp pitch
      this.pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this.pitch));
  }
  
  _handleMovement(dt) {
      if (!this.characterGroup) return; 

      const forward = new THREE.Vector3(0, 0, -1);
      const right = new THREE.Vector3(1, 0, 0);
      
      forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
      right.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
      
      const moveDir = new THREE.Vector3();
      if (this.input.keys.w) moveDir.add(forward);
      if (this.input.keys.s) moveDir.sub(forward);
      if (this.input.keys.d) moveDir.add(right);
      if (this.input.keys.a) moveDir.sub(right);
      
      if (moveDir.length() > 0) moveDir.normalize();

      // --- Vertical Physics (Simple Gravity) ---
      const GRAVITY = 20.0;
      const JUMP_FORCE = 8.0;
      
      this.velocity.y -= GRAVITY * dt;
      
      // Jump
      if (this.input.keys.space && this.isGrounded) {
          this.velocity.y = JUMP_FORCE;
          this.isGrounded = false;
      }
      
      this.position.y += this.velocity.y * dt;
      
      // Simple Ground Collison (Floor at Y=0)
      if (this.position.y <= 0) {
          this.position.y = 0;
          this.velocity.y = 0;
          this.isGrounded = true;
      } else {
          this.isGrounded = false;
      }

      // --- Horizontal Movement (Simple Bounds) ---
      // Reverting to box bounds to save FPS
      const potentialPos = this.position.clone().addScaledVector(moveDir, this.speed * dt);
      
      // Box Room Bounds (-3.5 to 3.5) - Tightened Further
      const bound = 3.5;
      
      // Check Door (Z Axis Ends)
      if (Math.abs(potentialPos.x) > bound || Math.abs(potentialPos.z) > bound) {
          console.log("Wall Hit Detected at", potentialPos); 
          hitWall = true;
          this.audio.playDoorLocked();
      }
      
      // Check Photo Corner (Back Right: X > 2, Z < -2)
      if (potentialPos.x > 2.0 && potentialPos.z < -2.0) {
          this.audio.playLaugh();
      }
      
      // Clamp
      potentialPos.x = Math.max(-bound, Math.min(bound, potentialPos.x));
      potentialPos.z = Math.max(-bound, Math.min(bound, potentialPos.z));  
      
      this.position.x = potentialPos.x;
      this.position.z = potentialPos.z;

      // Footsteps
      if (moveDir.length() > 0 && this.isGrounded) {
          this.stepTimer -= dt;
          if (this.stepTimer <= 0) {
              this.audio.play('walk');
              this.stepTimer = 0.5; 
          }
      } else {
          this.stepTimer = 0; 
      }
      
      // Update character transform
      this.characterGroup.rotation.y = this.yaw;
      this.characterGroup.position.copy(this.position);
  }
  
  _handleWeapon(dt) {
      // Recoil recovery
      this.currentRecoil.x = THREE.MathUtils.lerp(this.currentRecoil.x, 0, dt * 10);
      this.currentRecoil.y = THREE.MathUtils.lerp(this.currentRecoil.y, 0, dt * 10);

      // Fire
      if (this.input.mouse.leftButton) {
          const now = performance.now() / 1000;
          if (now - this.lastShotTime > this.fireRate) {
              this._fire();
              this.lastShotTime = now;
          }
      }
  }
  
  _fire() {
      // Play Sound
      this.audio.play('gunshot');
      
      const isAiming = this.input.mouse.rightButton;
      const isMoving = this.input.keys.w || this.input.keys.s || this.input.keys.a || this.input.keys.d; // Simple check
      
      // Calculate Spread
      let spreadAmount = 0.05; // Base hip fire spread
      if (isAiming) spreadAmount = 0.005; // Tight spread when aiming
      if (isMoving) spreadAmount += 0.05; // Penalty for moving
      
      // Apply Recoil
      this.currentRecoil.x += (Math.random() - 0.5) * 0.1; 
      this.currentRecoil.y += 0.05 + Math.random() * 0.02; 
      
      // Raycast Setup
      const raycaster = new THREE.Raycaster();
      
      // Spread Logic: Perturb the center screen vector
      const xSpread = (Math.random() - 0.5) * spreadAmount;
      const ySpread = (Math.random() - 0.5) * spreadAmount;
      
      raycaster.setFromCamera(new THREE.Vector2(xSpread, ySpread), this.camera);
      
      const intersects = raycaster.intersectObjects(this.scene.children, true);
      
      let targetPoint = raycaster.ray.at(100, new THREE.Vector3()); // Default far point
      let hitObject = null;
      let hitNormal = null;

      // Filter out self
      const validHits = intersects.filter(hit => {
         let obj = hit.object;
         while(obj) {
             if (obj === this.characterGroup) return false;
             obj = obj.parent;
         }
         return true;
      });

      if (validHits.length > 0) {
          targetPoint = validHits[0].point;
          hitObject = validHits[0].object;
          hitNormal = validHits[0].face ? validHits[0].face.normal : new THREE.Vector3(0, 1, 0);
      }
      
      // Visuals
      // Muzzle Position global
      const muzzlePos = new THREE.Vector3();
      if (this.muzzle) {
          this.muzzle.getWorldPosition(muzzlePos);
      } else {
          // Fallback if muzzle not ready
          muzzlePos.copy(this.position).add(new THREE.Vector3(0, 1.5, 0));
      }
      
      // Tracer
      this._createTracer(muzzlePos, targetPoint);
      this._createMuzzleFlash();
      
      // Impact 
      if (hitObject) {
          if (hitObject.userData && hitObject.userData.breakable) {
              this._breakObject(hitObject, targetPoint);
          } else {
              this._createImpactEffect(targetPoint, hitNormal);
          }
      }
  }
  
  _breakObject(obj, pos) {
      if (obj.userData.type === 'light') {
          // Break Light
          this.scene.remove(obj); // Remove bulb
          if (obj.userData.linkedLight) {
              obj.userData.linkedLight.intensity = 0.1; // Dim active, or remove
              this.scene.remove(obj.userData.linkedLight);
          }
          
          // Glass shards effect
          for(let i=0; i<10; i++) {
              this._createDebris(pos, 0xffeeaa, 0.05);
          }
          this._createImpactEffect(pos, new THREE.Vector3(0, -1, 0)); // Sparks
          
      } else if (obj.userData.type === 'crate') {
          // Break Crate
          this.scene.remove(obj);
          obj.geometry.dispose();
          obj.material.dispose();
          
          // Wood debris
          for(let i=0; i<8; i++) {
              this._createDebris(pos, 0x8b4513, 0.15);
          }
          // Remove from collision check list if we had one (Using scene.children currently so auto-updates)
      }
  }
  
  _createDebris(pos, color, size) {
      const geo = new THREE.BoxGeometry(size, size, size);
      const mat = new THREE.MeshBasicMaterial({ color: color });
      const mesh = new THREE.Mesh(geo, mat);
      
      mesh.position.copy(pos);
      // Random velocity spread
      mesh.position.x += (Math.random() - 0.5) * 0.5;
      mesh.position.y += (Math.random() - 0.5) * 0.5;
      mesh.position.z += (Math.random() - 0.5) * 0.5;
      
      this.scene.add(mesh);
      
      // Simple physics animation for debris
      const velocity = new THREE.Vector3(
          (Math.random() - 0.5) * 4,
          Math.random() * 4,
          (Math.random() - 0.5) * 4
      );
      
      let life = 1.0;
      const animate = () => {
          life -= 0.02;
          velocity.y -= 0.2; // Gravity
          mesh.position.addScaledVector(velocity, 0.016);
          mesh.rotation.x += 0.1;
          
          if (life <= 0 || mesh.position.y < 0) {
              this.scene.remove(mesh);
              geo.dispose();
              mat.dispose();
          } else {
              requestAnimationFrame(animate);
          }
      };
      animate();
  }

  
  _createTracer(start, end) {
      // Glowing Line
      const material = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.8 });
      const vec = new THREE.Vector3().subVectors(end, start);
      const len = vec.length();
      const geo = new THREE.CylinderGeometry(0.01, 0.01, len, 6); // Thin
      geo.rotateX(-Math.PI / 2); // Align with Z
      geo.translate(0, 0, len / 2); // Pivot at start
      
      const mesh = new THREE.Mesh(geo, material);
      mesh.position.copy(start);
      mesh.lookAt(end);
      
      this.scene.add(mesh);
      
      let life = 1.0;
      const animateTracer = () => {
          life -= 0.15;
          material.opacity = life;
          if (life <= 0) {
              this.scene.remove(mesh);
              geo.dispose();
              material.dispose();
          } else {
              requestAnimationFrame(animateTracer);
          }
      };
      animateTracer();
  }
  
  _createMuzzleFlash() {
      if (!this.gunMesh) return;
      const flashGeo = new THREE.PlaneGeometry(0.3, 0.3);
      const flashMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, side: THREE.DoubleSide });
      const flash = new THREE.Mesh(flashGeo, flashMat);
      flash.position.set(0, 0, -0.4);
      flash.rotation.z = Math.random() * Math.PI;
      this.gunMesh.add(flash);
      
      setTimeout(() => {
          this.gunMesh.remove(flash);
          flashGeo.dispose();
          flashMat.dispose();
      }, 50);
  }
  
  _createImpactEffect(pos, normal) {
      // 1. Spark Effect
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0,0,0]), 3));
      const mat = new THREE.PointsMaterial({ color: 0xffff00, size: 0.1 });
      const spark = new THREE.Points(geo, mat);
      spark.position.copy(pos);
      this.scene.add(spark);
       setTimeout(() => {
          this.scene.remove(spark);
          geo.dispose();
          mat.dispose();
      }, 200);
      
      // 2. Bullet Decal (Mark on wall)
      this._createDecal(pos, normal);
  }
  
  _createDecal(pos, normal) {
      if (!this.decalMaterial) {
          this.decalMaterial = new THREE.MeshBasicMaterial({ 
              map: this._createDecalTexture(), 
              transparent: true, 
              depthTest: true,
              depthWrite: false, 
              polygonOffset: true,
              polygonOffsetFactor: -4 // Pull forward to avoid z-fighting
          });
          this.decals = [];
      }
      
      const size = 0.15 + Math.random() * 0.1;
      const decalGeo = new THREE.PlaneGeometry(size, size);
      const decal = new THREE.Mesh(decalGeo, this.decalMaterial);
      
      decal.position.copy(pos);
      
      // Orient to normal
      const target = pos.clone().add(normal);
      decal.lookAt(target);
      
      // Random rotation
      decal.rotation.z = Math.random() * Math.PI * 2;
      
      this.scene.add(decal);
      this.decals.push(decal);
      
      // Limit count
      if (this.decals.length > 50) {
          const old = this.decals.shift();
          this.scene.remove(old);
          old.geometry.dispose();
      }
  }
  
  _createDecalTexture() {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      
      // Dark Core
        ctx.fillStyle = '#111111';
      ctx.beginPath();
      ctx.arc(32, 32, 16, 0, Math.PI * 2);
      ctx.fill();
      
      // Outer Scorching
      const grad = ctx.createRadialGradient(32, 32, 16, 32, 32, 30);
      grad.addColorStop(0, 'rgba(0,0,0,0.8)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(32, 32, 30, 0, Math.PI * 2);
      ctx.fill();
      
      const tex = new THREE.CanvasTexture(canvas);
      tex.needsUpdate = true;
      return tex;
  }


  _updateCamera() {
      // Third Person Logic
      const pivot = new THREE.Vector3().copy(this.position);
      pivot.y += 1.6; // Eye level
      
      // Aming Logic
      const isAiming = this.input.mouse.rightButton;
      const targetFov = isAiming ? 30 : 60; // Zoom in
      const defaultOffset = new THREE.Vector3(0.5, 0.5, 2.5);
      const aimOffset = new THREE.Vector3(0.4, 0.4, 1.0); // Closer and tighter
      
      // Smooth FOV
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 0.1);
      this.camera.updateProjectionMatrix();

      // Smooth Offset Transition
      if (!this.currentCameraOffset) this.currentCameraOffset = defaultOffset.clone();
      this.currentCameraOffset.lerp(isAiming ? aimOffset : defaultOffset, 0.1);
      
      // Calculate rotation
      const quat = new THREE.Quaternion();
      quat.setFromEuler(new THREE.Euler(this.pitch + this.currentRecoil.y, this.yaw + this.currentRecoil.x, 0, 'YXZ'));
      
      const finalOffset = this.currentCameraOffset.clone().applyQuaternion(quat);
      const finalPos = pivot.clone().add(finalOffset);
      
      this.camera.position.lerp(finalPos, 0.2); // Smooth follow
      this.camera.lookAt(pivot.clone().add(new THREE.Vector3(0, 0, -10).applyQuaternion(quat))); 
  }
}
