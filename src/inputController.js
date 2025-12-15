export class InputController {
  constructor() {
    this.keys = {
      w: false,
      a: false,
      s: false,
      d: false,
      shift: false,
      space: false,
      r: false
    };

    this.mouse = {
      deltaX: 0,
      deltaY: 0,
      leftButton: false,
      rightButton: false,
      locked: false
    };

    this._init();
  }

  _init() {
    document.addEventListener('keydown', (e) => this._onKeyDown(e));
    document.addEventListener('keyup', (e) => this._onKeyUp(e));
    document.addEventListener('mousedown', (e) => this._onMouseDown(e));
    document.addEventListener('mouseup', (e) => this._onMouseUp(e));
    document.addEventListener('mousemove', (e) => this._onMouseMove(e));
    
    // Pointer Lock
    document.addEventListener('click', () => {
      document.body.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', () => {
        this.mouse.locked = document.pointerLockElement === document.body;
    });
  }

  _onKeyDown(e) {
    switch(e.code) {
      case 'KeyW': this.keys.w = true; break;
      case 'KeyA': this.keys.a = true; break;
      case 'KeyS': this.keys.s = true; break;
      case 'KeyD': this.keys.d = true; break;
      case 'ShiftLeft': this.keys.shift = true; break;
      case 'Space': this.keys.space = true; break;
      case 'KeyR': this.keys.r = true; break;
    }
  }

  _onKeyUp(e) {
    switch(e.code) {
      case 'KeyW': this.keys.w = false; break;
      case 'KeyA': this.keys.a = false; break;
      case 'KeyS': this.keys.s = false; break;
      case 'KeyD': this.keys.d = false; break;
      case 'ShiftLeft': this.keys.shift = false; break;
      case 'Space': this.keys.space = false; break;
      case 'KeyR': this.keys.r = false; break;
    }
  }

  _onMouseDown(e) {
    if (e.button === 0) this.mouse.leftButton = true;
    if (e.button === 2) this.mouse.rightButton = true;
  }

  _onMouseUp(e) {
    if (e.button === 0) this.mouse.leftButton = false;
    if (e.button === 2) this.mouse.rightButton = false;
  }

  _onMouseMove(e) {
    if (this.mouse.locked) {
      this.mouse.deltaX = e.movementX || 0;
      this.mouse.deltaY = e.movementY || 0;
    }
  }

  update() {
    // Reset ONE-FRAME triggers if any (not needed for delta mouse, but good practice for "JustPressed")
    // For now, we clear the deltas after the frame consumption is done? 
    // Actually, usually CharacterController consumes them. We'll implement a reset at the end of the frame or let CharacterController handle consumption.
    // A better approach is to let CharacterController read it and then we zero it out here.
    // BUT, if update() is called BEFORE CharacterController reads it, we lose data.
    // So we'll reset deltas at the START of the update loop, essentially "preparing for next frame's inputs".
    // Wait, the event listener adds to the delta? No, standard movementX IS the delta since last event.
    // So we just accumulate them per frame.
  }

  // Called by main loop AFTER game logic has consumed the input
  resetDeltas() {
      this.mouse.deltaX = 0;
      this.mouse.deltaY = 0;
  }
}
