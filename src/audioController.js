export class AudioController {
    constructor(camera) {
        this.camera = camera;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.sounds = {};
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.5;
        this.masterGain.connect(this.ctx.destination);
    }

    async load() {
        // Load real assets
        try {
            this.sounds['gunshot'] = await this._loadBuf('/sounds/gunshot.wav');
            this.sounds['walk'] = await this._loadBuf('/sounds/walk.wav');
        } catch (e) {
            console.error("Audio Load Error", e);
            // Fallback
            this.sounds['gunshot'] = this._createImpulseBuffer();
            this.sounds['walk'] = this._createNoiseBuffer(0.1);
        }
        
        // Keep procedural defaults/extras
        this.sounds['reload'] = this._createNoiseBuffer(0.5);
        this.sounds['thunder'] = this._createThunderBuffer();
        
        window.addEventListener('lightning-strike', () => {
             // Delay event slightly for distance?
             setTimeout(() => this.play('thunder'), 200 + Math.random() * 500); 
        });
    }
    
    startAmbience() {
        if (!this.ctx || this.ambienceStarted) return;
        this.ambienceStarted = true;
        
        // Dark Drone: 3 Oscillators (Low frequency)
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const osc3 = this.ctx.createOscillator();
        
        osc1.type = 'sawtooth';
        osc1.frequency.value = 50;
        
        osc2.type = 'sine';
        osc2.frequency.value = 52; // Beat freq
        
        osc3.type = 'triangle';
        osc3.frequency.value = 110; 

        // Gain/Mix
        const gain = this.ctx.createGain();
        gain.gain.value = 0.05; // Quiet background
        
        // Filter
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 200; // Muffled
        
        osc1.connect(gain);
        osc2.connect(gain);
        osc3.connect(gain);
        
        gain.connect(filter);
        filter.connect(this.masterGain);
        
        osc1.start();
        osc2.start();
        osc3.start();
    }
    
    playIntro() {
        if (this.introPlayed) return; 
        this.introPlayed = true;
        
        const text = "Welcome to the game.";
        this.speak(text, 1.0, 0.8, true); // Deep-ish
    }
    
    playDoorLocked() {
        const now = performance.now();
        if (this.doorTimer && now - this.doorTimer < 5000) return; 
        this.doorTimer = now;
        
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
        
        const text = "Door is locked. Access denied.";
        this.speak(text, 0.5, 0.8, true);
    }
    
    playLaugh() {
        const now = performance.now();
        if (this.laughTimer && now - this.laughTimer < 10000) return; // 10s cooldown
        this.laughTimer = now;
        
        const text = "Ha ha ha ha...";
        // High pitch female preference
        this.speak(text, 1.8, 0.9, false); 
    }
    
    speak(text, pitch, rate, preferMale) {
        this.showCaption(text);
        
        if ('speechSynthesis' in window) {
            const utter = new SpeechSynthesisUtterance(text);
            utter.pitch = pitch; 
            utter.rate = rate; 
            utter.volume = 1.0;
            
            const voices = window.speechSynthesis.getVoices();
            let voice = null;
            if (preferMale) {
                voice = voices.find(v => v.name.includes("Male") || v.name.includes("Google US English"));
            } else {
                 voice = voices.find(v => v.name.includes("Female") || v.name.includes("Google UK English Female"));
            }
            if (voice) utter.voice = voice;

            window.speechSynthesis.speak(utter);
            
            // Hide caption after duration approx
            setTimeout(() => {
                this.showCaption("");
            }, text.length * 100 + 1000);
        }
    }
    
    showCaption(text) {
        const el = document.getElementById('caption');
        if (el) {
            el.innerText = text;
            el.style.opacity = text ? 1 : 0;
        }
    }

    async _loadBuf(url) {
        const res = await fetch(url);
        const arrayBuf = await res.arrayBuffer();
        return await this.ctx.decodeAudioData(arrayBuf);
    }

    // Procedural sound generation for fallback
    _createImpulseBuffer() {
        const sr = this.ctx.sampleRate;
        const length = sr * 0.2; // 0.2 seconds
        const buffer = this.ctx.createBuffer(1, length, sr);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) {
            // Decaying noise
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 4);
        }
        return buffer;
    }

    _createNoiseBuffer(duration) {
         const sr = this.ctx.sampleRate;
         const length = sr * duration;
         const buffer = this.ctx.createBuffer(1, length, sr);
         const data = buffer.getChannelData(0);
         for (let i = 0; i < length; i++) {
             data[i] = (Math.random() * 2 - 1);
         }
         return buffer;
    }
    
    _createThunderBuffer() {
         const sr = this.ctx.sampleRate;
         const length = sr * 3.0; // 3 seconds rumble
         const buffer = this.ctx.createBuffer(1, length, sr);
         const data = buffer.getChannelData(0);
         for (let i = 0; i < length; i++) {
             // Low frequency noise capability (simple random with smoothing?)
             // Simple: White noise then we'll filter it in the play method or just make 'brown' noise here
             const white = Math.random() * 2 - 1;
             data[i] = white * Math.pow(1 - i / length, 2); // decay
         }
         return buffer;
    }

    play(name) {
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        if (this.sounds[name]) {
            const source = this.ctx.createBufferSource();
            source.buffer = this.sounds[name];
            
            // Create a filter for thunder
            if (name === 'thunder') {
                const filter = this.ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.value = 400;
                source.connect(filter);
                filter.connect(this.masterGain);
            } else {            
                source.connect(this.masterGain);
            }
            
            // Randomized pitch for realism
            source.playbackRate.value = 0.9 + Math.random() * 0.2;
            
            source.start();
        }
    }
}
