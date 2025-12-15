import * as THREE from 'three';

export class AnimationController {
    constructor(model) {
        this.model = model;
        this.mixer = null;
        this.actions = {};
        this.activeAction = null;
        
        // Check if model has animations
        if (model && model.animations && model.animations.length > 0) {
            this.mixer = new THREE.AnimationMixer(model.scene || model);
            
            // Map animations (Naming convention assumption)
            model.animations.forEach(clip => {
                const action = this.mixer.clipAction(clip);
                this.actions[clip.name.toLowerCase()] = action;
            });
        }
    }

    play(name) {
        if (!this.mixer) return;

        const action = this.actions[name.toLowerCase()];
        if (!action) return;

        if (this.activeAction !== action) {
             if (this.activeAction) {
                 this.activeAction.fadeOut(0.2);
             }
             action.reset().fadeIn(0.2).play();
             this.activeAction = action;
        }
    }

    update(dt) {
        if (this.mixer) {
            this.mixer.update(dt);
        }
    }
}
