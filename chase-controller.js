// Desktop Goose chase controller — makes the VRM pet chase the mouse cursor
const { screen } = require('electron');
const EventEmitter = require('events');

const STATES = Object.freeze({
  IDLE: 'IDLE',
  CURIOUS: 'CURIOUS',
  CHASING: 'CHASING',
  AGGRESSIVE: 'AGGRESSIVE',
  TIRED: 'TIRED',
});

const PREVIOUS_STATE_KEY = Symbol('previous');

class ChaseController extends EventEmitter {
  constructor({ mainWindow, petConfig, lyricsWindow, clampToScreen }) {
    super();
    this.window = mainWindow;
    this.petConfig = petConfig;
    this.lyricsWindow = lyricsWindow;
    this.clampToScreen = clampToScreen;

    // Personality — randomized per session
    this.seed = Math.random();
    this.orbitDir = this.seed > 0.5 ? 1 : -1;
    this.jitterFreqOffset = this.seed * 3;
    this.speedMultiplier = 0.85 + this.seed * 0.3;
    this.curiosityThreshold = 350 + this.seed * 100;   // 350-450px
    this.chaseThreshold = 180 + this.seed * 40;         // 180-220px
    this.aggressiveThreshold = 70 + this.seed * 20;      // 70-90px
    this.tiredThreshold = 40000 + this.seed * 20000;     // 40-60s
    this.recoveryTime = 10000 + this.seed * 5000;        // 10-15s

    // State
    this._mode = STATES.IDLE;
    this._paused = false;
    this._resumeAt = 0;
    this._pauseSafetyTimer = null;
    this._intervalId = null;
    this._chaseStartTime = 0;
    this._tiredRecoverAt = 0;
    this._cursorNearSince = 0;
    this._cursorCloseSince = 0;
    this._cursorVeryCloseSince = 0;
    this._cursorStillSince = 0;

    // Cursor history ring buffer (last 8 positions with timestamps)
    this._cursorHistory = [];
    this._maxHistory = 8;

    // Movement physics
    this._position = { x: 0, y: 0 };
    this._velocity = { x: 0, y: 0 };
    this._orbitAngle = Math.random() * Math.PI * 2;
    this._pauseTimer = 0;
    this._lastDirectionX = 0;
    this._lastDirectionY = 0;

    // GO_TO transient mode
    this._goToTarget = null;
    this._goToPrevMode = null;
  }

  start() {
    if (this._intervalId) return;
    const tickRate = 1000 / 60;
    this._intervalId = setInterval(() => this._tick(), tickRate);
    // Read initial position from window
    const bounds = this.window.getBounds();
    this._position = { x: bounds.x, y: bounds.y };
  }

  stop() {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
    clearTimeout(this._pauseSafetyTimer);
  }

  pause() {
    this._paused = true;
    this._transitionTo(STATES.IDLE);
    // Safety: auto-resume after 5s if renderer never sends resume
    clearTimeout(this._pauseSafetyTimer);
    this._pauseSafetyTimer = setTimeout(() => {
      if (this._paused) this.resume();
    }, 5000);
  }

  resume() {
    this._paused = false;
    this._resumeAt = Date.now() + 1500; // 1.5s cooldown
    this._cursorNearSince = 0; // Reset proximity tracking
    this._cursorCloseSince = 0;
    this._cursorVeryCloseSince = 0;
    clearTimeout(this._pauseSafetyTimer);
    this._transitionTo(STATES.IDLE);
  }

  setMode(mode) {
    if (!STATES[mode]) return;
    this._resumeAt = 0;
    this._paused = false;
    this._chaseStartTime = 0;
    this._tiredRecoverAt = 0;
    this._goToTarget = null;
    this._transitionTo(mode);
  }

  setEnabled(enabled) {
    if (!enabled) {
      this.pause();
    } else {
      this.resume();
    }
  }

  goToPosition(x, y) {
    this._goToTarget = { x, y };
    this._goToPrevMode = this._mode;
    this._paused = false;
    this._resumeAt = 0;
    this._velocity = { x: 0, y: 0 };
  }

  getState() {
    const cursorPos = screen.getCursorScreenPoint();
    const bounds = this.window.getBounds();
    const cx = bounds.x + bounds.width / 2;
    const cy = bounds.y + bounds.height / 2;
    const dx = cursorPos.x - cx;
    const dy = cursorPos.y - cy;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const speed = Math.sqrt(this._velocity.x ** 2 + this._velocity.y ** 2);

    return {
      mode: this._mode,
      distanceToCursor: Math.round(distance),
      speed: Math.round(speed * 10) / 10,
      directionX: distance > 0 ? dx / distance : 0,
      directionY: distance > 0 ? dy / distance : 0,
      isPaused: this._paused,
      cursorX: cursorPos.x,
      cursorY: cursorPos.y,
      positionX: bounds.x,
      positionY: bounds.y,
    };
  }

  // ── Internal ──

  _transitionTo(newMode) {
    if (this._mode === newMode) return;
    const prev = this._mode;
    this[PREVIOUS_STATE_KEY] = prev;
    this._mode = newMode;

    this.emit('state-changed', {
      mode: newMode,
      previousMode: prev,
      directionX: this._lastDirectionX,
      directionY: this._lastDirectionY,
      speed: Math.sqrt(this._velocity.x ** 2 + this._velocity.y ** 2),
    });

    if (newMode !== STATES.IDLE && prev === STATES.IDLE) {
      this._chaseStartTime = Date.now();
      this.emit('activity', {
        type: 'chase-started',
        details: { mode: newMode, description: 'started chasing the cursor' },
      });
    }

    if (newMode === STATES.IDLE && prev !== STATES.IDLE && prev !== undefined) {
      this.emit('activity', {
        type: 'chase-stopped',
        details: { previousMode: prev, description: 'stopped chasing the cursor' },
      });
    }

    if (newMode !== prev && prev && prev !== STATES.IDLE) {
      this.emit('activity', {
        type: 'chase-mode-changed',
        details: { mode: newMode, previousMode: prev, description: `entered ${newMode.toLowerCase()} mode` },
      });
    }
  }

  _tick() {
    // GO_TO transient mode — animate to target position, then revert
    if (this._goToTarget) {
      const bounds = this.window.getBounds();
      const cx = bounds.x + bounds.width / 2;
      const cy = bounds.y + bounds.height / 2;
      const dx = this._goToTarget.x - cx;
      const dy = this._goToTarget.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 5) {
        // Arrived
        this._goToTarget = null;
        if (this._goToPrevMode) {
          this._transitionTo(this._goToPrevMode);
          this._goToPrevMode = null;
        }
        return;
      }

      // Spring toward target
      const stiffness = 6;
      const damping = 0.78;
      this._velocity.x += dx * stiffness * 0.016;
      this._velocity.y += dy * stiffness * 0.016;
      this._velocity.x *= Math.pow(damping, 0.016 * 60);
      this._velocity.y *= Math.pow(damping, 0.016 * 60);

      const newX = bounds.x + this._velocity.x * 0.016 * 60;
      const newY = bounds.y + this._velocity.y * 0.016 * 60;
      this._lastDirectionX = Math.sign(this._velocity.x) * Math.min(1, Math.abs(this._velocity.x) / 8);
      this._lastDirectionY = Math.sign(this._velocity.y) * Math.min(1, Math.abs(this._velocity.y) / 8);
      this._moveWindow(newX, newY);
      return;
    }

    // Skip if paused or in cooldown
    if (this._paused || Date.now() < this._resumeAt) return;

    // Skip if window not visible
    if (!this.window.isVisible()) return;

    // TIRED recovery
    if (this._mode === STATES.TIRED && Date.now() > this._tiredRecoverAt) {
      this._transitionTo(STATES.IDLE);
    }

    // Get cursor position
    const cursorPos = screen.getCursorScreenPoint();
    const now = Date.now();

    // Update cursor history
    this._cursorHistory.push({ x: cursorPos.x, y: cursorPos.y, t: now });
    if (this._cursorHistory.length > this._maxHistory) {
      this._cursorHistory.shift();
    }

    // Window center position
    const bounds = this.window.getBounds();
    const winW = bounds.width;
    const winH = bounds.height;
    const cx = bounds.x + winW / 2;
    const cy = bounds.y + winH / 2;

    // Distance to cursor
    const dx = cursorPos.x - cx;
    const dy = cursorPos.y - cy;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Compute cursor velocity (from history)
    let cursorVx = 0;
    let cursorVy = 0;
    if (this._cursorHistory.length >= 3) {
      const recent = this._cursorHistory.slice(-3);
      const dt = (recent[2].t - recent[0].t) / 1000 || 0.016;
      cursorVx = (recent[2].x - recent[0].x) / dt;
      cursorVy = (recent[2].y - recent[0].y) / dt;
    }

    // Compute cursor stillness
    if (this._cursorHistory.length >= 4) {
      const prev = this._cursorHistory[this._cursorHistory.length - 4];
      const moved = Math.abs(cursorPos.x - prev.x) + Math.abs(cursorPos.y - prev.y);
      if (moved < 3) {
        this._cursorStillSince = this._cursorStillSince || now;
      } else {
        this._cursorStillSince = 0;
      }
    }

    // ── State Machine ──
    this._evaluateState(distance, now);

    // ── Compute target position with personality ──
    if (this._mode === STATES.IDLE || this._mode === STATES.TIRED) {
      // Decay velocity
      this._velocity.x *= 0.85;
      this._velocity.y *= 0.85;
      return;
    }

    const target = this._computeTarget(cursorPos, cursorVx, cursorVy, distance, now);

    // ── Apply movement physics ──
    this._applyPhysics(target, bounds, distance, now);

    // ── Move window ──
    const newX = bounds.x + this._velocity.x * 0.016 * 60;
    const newY = bounds.y + this._velocity.y * 0.016 * 60;
    this._lastDirectionX = this._velocity.x / 8;
    this._lastDirectionY = this._velocity.y / 8;
    this._moveWindow(newX, newY);

    // Emit tick for renderer
    this.emit('tick', this.getState());
  }

  _evaluateState(distance, now) {
    if (this._mode === STATES.TIRED) return; // Wait for recovery timer

    // Check chase duration → TIRED
    if (this._chaseStartTime > 0 && (now - this._chaseStartTime) > this.tiredThreshold) {
      this._tiredRecoverAt = now + this.recoveryTime;
      this._chaseStartTime = 0;
      this._transitionTo(STATES.TIRED);
      return;
    }

    // Distance thresholds
    if (distance > 500) {
      // Too far — go idle
      this._cursorNearSince = 0;
      this._cursorCloseSince = 0;
      this._cursorVeryCloseSince = 0;
      if (this._mode !== STATES.IDLE) {
        this._transitionTo(STATES.IDLE);
      }
      return;
    }

    if (distance <= this.aggressiveThreshold) {
      this._cursorVeryCloseSince = this._cursorVeryCloseSince || now;
    } else {
      this._cursorVeryCloseSince = 0;
    }

    if (distance <= this.chaseThreshold) {
      this._cursorCloseSince = this._cursorCloseSince || now;
    } else {
      this._cursorCloseSince = 0;
    }

    if (distance <= this.curiosityThreshold) {
      this._cursorNearSince = this._cursorNearSince || now;
    } else {
      this._cursorNearSince = 0;
    }

    // State transitions
    if (this._cursorVeryCloseSince > 0 && (now - this._cursorVeryCloseSince) > 800) {
      if (this._mode !== STATES.AGGRESSIVE) this._transitionTo(STATES.AGGRESSIVE);
    } else if (this._cursorCloseSince > 0 && (now - this._cursorCloseSince) > 1200) {
      if (this._mode !== STATES.CHASING && this._mode !== STATES.AGGRESSIVE) {
        this._transitionTo(STATES.CHASING);
      }
    } else if (this._cursorNearSince > 0 && (now - this._cursorNearSince) > 2000) {
      if (this._mode === STATES.IDLE) {
        this._transitionTo(STATES.CURIOUS);
      }
    }
  }

  _computeTarget(cursorPos, cursorVx, cursorVy, distance, now) {
    const target = { x: cursorPos.x, y: cursorPos.y };
    const state = this._mode;

    // Layer 1: Predictive tracking
    const predictFactors = { AGGRESSIVE: 0.25, CHASING: 0.15, CURIOUS: 0.05 };
    const predictFactor = predictFactors[state] || 0;
    target.x += cursorVx * predictFactor / 60;
    target.y += cursorVy * predictFactor / 60;

    // Layer 2: Orbital offset
    if (state === STATES.CURIOUS || (state === STATES.CHASING && distance > 80)) {
      const orbitSpeed = 0.8 + Math.sin((now / 1000) * 0.3) * 0.4;
      this._orbitAngle += orbitSpeed * this.orbitDir * 0.016;
      const orbitRadius = 45 + Math.sin((now / 1000) * 0.7) * 25;
      target.x += Math.cos(this._orbitAngle) * orbitRadius;
      target.y += Math.sin(this._orbitAngle) * orbitRadius * 0.6;
    }

    // Layer 3: Jitter
    const jitterAmount = state === STATES.AGGRESSIVE ? 4 : state === STATES.CHASING ? 2.5 : 1.5;
    const t = now / 1000;
    target.x += (Math.sin(t * 1.731 + this.jitterFreqOffset) * 2.3
              + Math.sin(t * 3.147 + this.jitterFreqOffset * 2) * 1.7) * jitterAmount;
    target.y += (Math.sin(t * 2.147 + this.jitterFreqOffset) * 2.1
              + Math.sin(t * 4.231 + this.jitterFreqOffset * 3) * 1.3) * jitterAmount;

    return target;
  }

  _applyPhysics(target, bounds, distance, now) {
    const state = this._mode;
    const dt = 0.016;
    const cx = bounds.x + bounds.width / 2;
    const cy = bounds.y + bounds.height / 2;
    const dx = target.x - cx;
    const dy = target.y - cy;

    switch (state) {
      case STATES.CURIOUS: {
        // Slow lerp with random pauses
        if (Math.random() < 0.3 * dt) {
          this._pauseTimer = 0.8 + Math.random() * 1.5;
        }
        if (this._pauseTimer > 0) {
          this._pauseTimer -= dt;
          this._velocity.x *= 0.9;
          this._velocity.y *= 0.9;
          return;
        }
        const speed = (2.5 + Math.random() * 1.5) * this.speedMultiplier;
        this._velocity.x = dx * speed * 0.04;
        this._velocity.y = dy * speed * 0.04;
        break;
      }

      case STATES.CHASING: {
        // Eased follow
        const t = Math.min(1, 0.08 * this.speedMultiplier);
        this._velocity.x += dx * t;
        this._velocity.y += dy * t;
        this._velocity.x *= 0.88;
        this._velocity.y *= 0.88;
        break;
      }

      case STATES.AGGRESSIVE: {
        // Spring-mass-damper (bouncy overshoot)
        const stiffness = 10.0 * this.speedMultiplier;
        const damping = 0.82;
        this._velocity.x += dx * stiffness * dt;
        this._velocity.y += dy * stiffness * dt;
        this._velocity.x *= Math.pow(damping, dt * 60);
        this._velocity.y *= Math.pow(damping, dt * 60);

        // Catch cursor event
        if (distance < 30) {
          this.emit('activity', {
            type: 'pet-caught-cursor',
            details: { description: 'caught up to the cursor' },
          });
        }
        break;
      }

      case STATES.TIRED: {
        // Very slow, frequent frame skips
        if (Math.random() < 0.6 * dt) return;
        const t = Math.min(1, 0.02 * dt * 60);
        this._velocity.x += dx * t;
        this._velocity.y += dy * t;
        this._velocity.x *= 0.92;
        this._velocity.y *= 0.92;
        break;
      }
    }
  }

  _moveWindow(newX, newY) {
    const bounds = this.window.getBounds();
    const winW = bounds.width;
    const winH = bounds.height;

    // Apply window bounds clamping
    let clampedX = newX;
    let clampedY = newY;

    if (this.clampToScreen) {
      const clamped = this.clampToScreen(newX, newY, winW, winH);
      clampedX = clamped.x;
      clampedY = clamped.y;
    }

    // Only move if position changed meaningfully
    if (Math.abs(clampedX - bounds.x) < 0.5 && Math.abs(clampedY - bounds.y) < 0.5) return;

    this.window.setPosition(Math.round(clampedX), Math.round(clampedY));

    // Sync lyrics window if present
    if (this.lyricsWindow && !this.lyricsWindow.isDestroyed()) {
      this.lyricsWindow.setPosition(
        Math.round(clampedX - 100),
        Math.round(clampedY - 110)
      );
    }

    // Save position
    if (this.petConfig) {
      this.petConfig.set('position', { x: Math.round(clampedX), y: Math.round(clampedY) });
    }

    this._position = { x: clampedX, y: clampedY };
  }
}

module.exports = { ChaseController, STATES };
