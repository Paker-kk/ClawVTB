import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from './node_modules/@pixiv/three-vrm/lib/three-vrm.module.js';

const MOOD_PRESETS = {
  idle:      { primary: 0xff8b5e, secondary: 0xffc4ad, halo: 0xff9f73, scale: 1.0,  defaultExpr: 'normal' },
  listening: { primary: 0x55d3c5, secondary: 0xb7f0eb, halo: 0x55d3c5, scale: 1.0,  defaultExpr: 'softSmile' },
  thinking:  { primary: 0x7f7cff, secondary: 0xc3c1ff, halo: 0x8b88ff, scale: 1.02, defaultExpr: 'thinking' },
  speaking:  { primary: 0xff6d99, secondary: 0xffb6ca, halo: 0xff7fad, scale: 1.03, defaultExpr: 'talking' },
  happy:     { primary: 0xffc04d, secondary: 0xffe2a7, halo: 0xffc04d, scale: 1.06, defaultExpr: 'happy' },
  error:     { primary: 0xff5f63, secondary: 0xffb1b3, halo: 0xff5f63, scale: 0.98, defaultExpr: 'worried' },
  offline:   { primary: 0x5f6778, secondary: 0xa2a8b7, halo: 0x6a7386, scale: 0.97, defaultExpr: 'sad' },
  // ── New moods from ball version ──
  talking:   { primary: 0xff6d99, secondary: 0xffb6ca, halo: 0xff7fad, scale: 1.0,  defaultExpr: 'talking' },
  sleepy:    { primary: 0xbaa396, secondary: 0xdcc8c0, halo: 0xbaa396, scale: 0.97, defaultExpr: 'sleepy' },
  surprised: { primary: 0xffd700, secondary: 0xffeb99, halo: 0xffa500, scale: 1.06, defaultExpr: 'surprised' },
  sad:       { primary: 0x1e88e5, secondary: 0x90caf9, halo: 0x42a5f5, scale: 0.96, defaultExpr: 'sad' },
  angry:     { primary: 0xd32f2f, secondary: 0xef9a9a, halo: 0xf44336, scale: 1.04, defaultExpr: 'angry' },
  fearful:   { primary: 0x9c27b0, secondary: 0xce93d8, halo: 0x7b1fa2, scale: 0.97, defaultExpr: 'nervous' },
  calm:      { primary: 0x4db6ac, secondary: 0xb2dfdb, halo: 0x00897b, scale: 1.0,  defaultExpr: 'softSmile' },
  excited:   { primary: 0xe91e63, secondary: 0xf48fb1, halo: 0xff4081, scale: 1.08, defaultExpr: 'superHappy' },
  love:      { primary: 0xe53935, secondary: 0xff8a80, halo: 0xff5252, scale: 1.05, defaultExpr: 'love' },
  focused:   { primary: 0x0097a7, secondary: 0x80deea, halo: 0x26a69a, scale: 1.02, defaultExpr: 'focus' },
};

// ── VRM Expression Presets (mapped from ball version's 38 EXPR) ──
// Each preset defines target values for VRM BlendShapes + optional bone overrides.
// VRM 1.0 standard expressions: happy, angry, sad, relaxed, surprised,
// blink, blinkLeft, blinkRight, aa, oh, ee, ih, ou, neutral, lookUp, lookDown, lookLeft, lookRight
const VRM_EXPR = {
  // --- Basic ---
  normal:     { happy: 0, angry: 0, sad: 0, relaxed: 0, surprised: 0 },
  blink:      { blink: 1 },
  halfBlink:  { blink: 0.5 },

  // --- Gaze (via lookAt bones, not blendshapes) ---
  lookLeft:   { _lookX: -0.6, _lookY: 0 },
  lookRight:  { _lookX: 0.6, _lookY: 0 },
  lookUp:     { _lookX: 0, _lookY: 0.5 },
  lookDown:   { _lookX: 0, _lookY: -0.4 },

  // --- Happy family ---
  happy:      { happy: 0.6, relaxed: 0.2 },
  superHappy: { happy: 0.9, relaxed: 0.1, surprised: 0.1, _scale: 1.06 },
  giggle:     { happy: 0.7, blinkLeft: 0.3, aa: 0.15 },
  softSmile:  { happy: 0.35, relaxed: 0.3 },
  content:    { happy: 0.3, relaxed: 0.5 },
  bliss:      { happy: 0.5, relaxed: 0.6, blink: 0.4 },
  flattered:  { happy: 0.4, surprised: 0.3 },

  // --- Surprise family ---
  surprised:  { surprised: 0.7 },
  wow:        { surprised: 0.9, aa: 0.3, _scale: 1.04 },
  sparkle:    { surprised: 0.5, happy: 0.4 },

  // --- Wink ---
  wink:       { blinkLeft: 0.9, happy: 0.2 },
  winkR:      { blinkRight: 0.9, happy: 0.2 },

  // --- Sad family ---
  sad:        { sad: 0.6 },
  worried:    { sad: 0.35, surprised: 0.15 },
  pout:       { sad: 0.3, angry: 0.2 },

  // --- Angry family ---
  angry:      { angry: 0.7, _headRotZ: -0.06 },
  cross:      { angry: 0.5, blink: 0.6 },

  // --- Thinking family ---
  thinking:   { relaxed: 0.25, _lookY: 0.3, _headRotZ: 0.04 },
  hmm:        { relaxed: 0.2, _lookX: 0.3, _lookY: 0.2, _headRotZ: 0.06 },
  curious:    { surprised: 0.25, _lookX: -0.3, _headRotZ: -0.05 },
  confused:   { surprised: 0.2, sad: 0.15, _headRotZ: 0.08 },
  focus:      { relaxed: 0.15, _lookY: -0.1 },
  daydream:   { relaxed: 0.4, _lookY: 0.35 },
  blank:      { relaxed: 0.1 },

  // --- Sleepy family ---
  sleepy:     { blink: 0.7, relaxed: 0.3 },
  drowsy:     { blink: 0.45, relaxed: 0.2 },
  dead:       { blink: 0.9, sad: 0.2 },

  // --- Talk ---
  talking:    { aa: 0.25, oh: 0.1 },
  talkBig:    { aa: 0.5, oh: 0.2, ee: 0.1 },

  // --- Misc ---
  squint:     { blink: 0.55 },
  dizzy:      { surprised: 0.3, _headRotZ: 0.1 },
  nervous:    { sad: 0.15, surprised: 0.2, _scale: 0.97 },
  love:       { happy: 0.6, relaxed: 0.3, _scale: 1.04 },
  smug:       { happy: 0.3, blinkLeft: 0.4, _headRotZ: 0.05 },
  mischief:   { happy: 0.25, surprised: 0.15, _headRotZ: -0.06 },
  sly:        { happy: 0.15, blinkRight: 0.3, _lookX: 0.4 },
  peekL:      { blinkLeft: 0.6, _lookX: -0.5 },
  peekR:      { blinkRight: 0.6, _lookX: 0.5 },
};

// Expression transition speed (seconds for full lerp)
const EXPR_SPEEDS = {
  snap: 0.02, fast: 0.08, normal: 0.18, smooth: 0.3, slow: 0.45, drift: 0.6
};

const BLINK_INTERVAL_RANGE = [2800, 6200];

function lerpColor(material, color, amount = 0.1) {
  if (!material || !material.color) return;
  material.color.lerp(color, amount);
}

function nextBlinkDelay() {
  const [min, max] = BLINK_INTERVAL_RANGE;
  return min + Math.random() * (max - min);
}

// ── Idle Action Pools (12 categories, mapped from ball version's ACT) ──
// Each action is a function(stage) that calls stage.setExpression() with timeouts.
function idleSeq(stage, steps) {
  let delay = 0;
  for (const [expr, speed, dur] of steps) {
    setTimeout(() => stage.setExpression(expr, speed), delay);
    delay += dur;
  }
  setTimeout(() => stage.clearExpression(), delay);
  return delay + 300;
}

const IDLE_ACTIONS = {
  daily: [
    (s) => idleSeq(s, [['lookLeft','fast',500],['lookRight','fast',500],['normal','normal',0]]),
    (s) => idleSeq(s, [['curious','smooth',800]]),
    (s) => idleSeq(s, [['wink','fast',700]]),
    (s) => idleSeq(s, [['winkR','fast',700]]),
    (s) => idleSeq(s, [['hmm','smooth',800]]),
    (s) => idleSeq(s, [['sparkle','fast',500]]),
    (s) => idleSeq(s, [['blink','snap',80],['normal','fast',170],['blink','snap',80]]),
    (s) => idleSeq(s, [['peekL','smooth',700],['blink','snap',100]]),
    (s) => idleSeq(s, [['peekR','smooth',600],['nervous','fast',400]]),
    (s) => idleSeq(s, [['blank','drift',1200],['blink','snap',100],['surprised','fast',300]]),
    (s) => idleSeq(s, [['softSmile','smooth',1000]]),
    (s) => idleSeq(s, [['focus','smooth',800],['curious','smooth',500]]),
  ],
  happy: [
    (s) => idleSeq(s, [['happy','smooth',1000]]),
    (s) => idleSeq(s, [['superHappy','smooth',400],['giggle','smooth',400],['happy','smooth',400]]),
    (s) => idleSeq(s, [['giggle','smooth',800]]),
    (s) => idleSeq(s, [['smug','smooth',700],['giggle','smooth',600]]),
    (s) => idleSeq(s, [['love','smooth',1000],['superHappy','smooth',500]]),
    (s) => idleSeq(s, [['content','slow',600],['softSmile','smooth',800]]),
    (s) => idleSeq(s, [['bliss','slow',1200],['content','smooth',600]]),
    (s) => idleSeq(s, [['flattered','fast',500],['happy','smooth',700]]),
  ],
  shy: [
    (s) => idleSeq(s, [['happy','smooth',1200]]),
    (s) => idleSeq(s, [['squint','fast',400],['lookDown','smooth',600]]),
    (s) => idleSeq(s, [['halfBlink','fast',300],['lookDown','smooth',700]]),
    (s) => idleSeq(s, [['nervous','fast',400],['peekR','smooth',500],['softSmile','smooth',600]]),
    (s) => idleSeq(s, [['flattered','fast',500],['lookDown','smooth',500],['softSmile','smooth',600]]),
  ],
  thinking: [
    (s) => idleSeq(s, [['thinking','smooth',800]]),
    (s) => idleSeq(s, [['hmm','smooth',500],['thinking','smooth',600]]),
    (s) => idleSeq(s, [['curious','smooth',500],['hmm','smooth',600]]),
    (s) => idleSeq(s, [['lookUp','fast',500],['thinking','smooth',700]]),
    (s) => idleSeq(s, [['confused','smooth',600],['thinking','smooth',500],['sparkle','fast',400]]),
    (s) => idleSeq(s, [['thinking','smooth',800],['sparkle','fast',400],['giggle','smooth',500]]),
    (s) => idleSeq(s, [['focus','smooth',800],['confused','smooth',500],['sparkle','fast',400],['happy','smooth',400]]),
    (s) => idleSeq(s, [['daydream','drift',1500],['blink','snap',100],['surprised','fast',300]]),
    (s) => idleSeq(s, [['worried','smooth',600],['thinking','smooth',600],['softSmile','smooth',600]]),
  ],
  surprised: [
    (s) => idleSeq(s, [['surprised','fast',600]]),
    (s) => idleSeq(s, [['wow','fast',500],['curious','smooth',600]]),
    (s) => idleSeq(s, [['flattered','fast',600],['bliss','slow',600],['happy','smooth',500]]),
    (s) => idleSeq(s, [['surprised','fast',400],['worried','smooth',600],['softSmile','smooth',500]]),
  ],
  sleepy: [
    (s) => idleSeq(s, [['drowsy','slow',400],['sleepy','slow',600],['surprised','fast',300]]),
    (s) => idleSeq(s, [['halfBlink','slow',500],['sleepy','slow',700],['halfBlink','slow',500],['drowsy','slow',500]]),
    (s) => idleSeq(s, [['sleepy','slow',1000],['drowsy','slow',400],['surprised','fast',300]]),
    (s) => idleSeq(s, [['sleepy','slow',800],['blink','snap',80],['sleepy','slow',400]]),
    (s) => idleSeq(s, [['drowsy','slow',600],['daydream','drift',1000],['sleepy','slow',800],['blink','snap',100]]),
  ],
  sad: [
    (s) => idleSeq(s, [['sad','smooth',600],['drowsy','slow',400],['happy','smooth',200]]),
    (s) => idleSeq(s, [['sad','smooth',500],['lookDown','smooth',600]]),
    (s) => idleSeq(s, [['confused','smooth',400],['sad','smooth',700]]),
    (s) => idleSeq(s, [['worried','smooth',800],['sad','smooth',700],['blink','snap',100],['softSmile','smooth',500]]),
    (s) => idleSeq(s, [['pout','smooth',600],['lookDown','smooth',800]]),
  ],
  annoyed: [
    (s) => idleSeq(s, [['angry','smooth',600],['hmm','smooth',400]]),
    (s) => idleSeq(s, [['angry','smooth',500],['squint','fast',300],['blink','snap',100]]),
    (s) => idleSeq(s, [['lookUp','fast',300],['lookDown','fast',300],['blink','snap',200]]),
    (s) => idleSeq(s, [['squint','fast',250],['lookLeft','fast',250],['lookRight','fast',250]]),
    (s) => idleSeq(s, [['pout','smooth',500],['lookLeft','fast',250],['lookRight','fast',250],['pout','smooth',400]]),
    (s) => idleSeq(s, [['sly','smooth',600],['angry','smooth',400],['squint','fast',400]]),
  ],
  encourage: [
    (s) => idleSeq(s, [['sparkle','fast',400],['superHappy','smooth',500]]),
    (s) => idleSeq(s, [['happy','smooth',300],['superHappy','smooth',400],['giggle','smooth',500]]),
    (s) => idleSeq(s, [['focus','smooth',500],['sparkle','fast',400],['content','slow',500]]),
  ],
  smug: [
    (s) => idleSeq(s, [['blink','snap',80],['hmm','smooth',600]]),
    (s) => idleSeq(s, [['smug','smooth',600],['giggle','smooth',600]]),
    (s) => idleSeq(s, [['mischief','smooth',500],['sly','smooth',500],['smug','smooth',500]]),
  ],
  dizzy: [
    (s) => idleSeq(s, [['dizzy','fast',600],['halfBlink','fast',300]]),
    (s) => idleSeq(s, [['dead','slow',1500],['blink','snap',100],['surprised','fast',300]]),
    (s) => idleSeq(s, [['cross','fast',400],['dizzy','fast',500],['halfBlink','fast',400]]),
    (s) => idleSeq(s, [['blank','drift',800],['dizzy','fast',500],['blink','snap',100],['confused','smooth',400]]),
  ],
  playful: [
    (s) => idleSeq(s, [['mischief','smooth',600],['wink','fast',400],['giggle','smooth',500]]),
    (s) => idleSeq(s, [['peekL','smooth',800],['surprised','fast',300],['nervous','fast',300],['blink','snap',100]]),
    (s) => idleSeq(s, [['sly','smooth',500],['mischief','smooth',400],['giggle','smooth',400]]),
    (s) => idleSeq(s, [['cross','fast',400],['mischief','smooth',300],['giggle','smooth',400]]),
  ],
  dreamy: [
    (s) => idleSeq(s, [['daydream','drift',1200],['softSmile','smooth',800]]),
    (s) => idleSeq(s, [['blank','drift',800],['daydream','drift',1000],['content','slow',600]]),
    (s) => idleSeq(s, [['bliss','slow',1500],['content','slow',700]]),
    (s) => idleSeq(s, [['lookUp','fast',500],['daydream','drift',1200],['softSmile','smooth',700]]),
  ],
};

// Time-of-day scene weights (same as ball version)
function getTimeScene() {
  const h = new Date().getHours();
  if (h >= 6 && h < 11) return 'morning';
  if (h >= 11 && h < 14) return 'noon';
  if (h >= 14 && h < 18) return 'afternoon';
  if (h >= 18 && h < 23) return 'evening';
  return 'latenight';
}

const SCENE_WEIGHTS = {
  morning:   { sleepy: 4, daily: 3, dreamy: 2, shy: 1, thinking: 1 },
  noon:      { daily: 3, happy: 2, playful: 2, thinking: 1, sleepy: 1 },
  afternoon: { daily: 3, thinking: 2, happy: 1, dreamy: 1, playful: 1, encourage: 1 },
  evening:   { daily: 2, happy: 2, dreamy: 2, shy: 1, sleepy: 2 },
  latenight: { sleepy: 5, dreamy: 2, daily: 1, dizzy: 2, sad: 1 },
};

function pickIdleAction() {
  const scene = getTimeScene();
  const weights = SCENE_WEIGHTS[scene] || SCENE_WEIGHTS.afternoon;
  const entries = [];
  for (const [cat, w] of Object.entries(weights)) {
    if (IDLE_ACTIONS[cat]) for (let i = 0; i < w; i++) entries.push(cat);
  }
  const cat = entries[Math.floor(Math.random() * entries.length)];
  const pool = IDLE_ACTIONS[cat];
  return pool[Math.floor(Math.random() * pool.length)];
}

export class AvatarStage {
  constructor({ container }) {
    this.container = container;
    this.clock = new THREE.Clock();
    this.loader = new GLTFLoader();
    this.loader.register((parser) => new VRMLoaderPlugin(parser));

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
    this.camera.position.set(0, 1.85, 6.8);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      premultipliedAlpha: false
    });
    this.frameInterval = 1 / 30;
    this.frameAccum = 0;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);

    this.pointer = new THREE.Vector2(0, 0);
    this.lookTarget = new THREE.Object3D();
    this.lookTarget.position.set(0, 1.7, 2.6);
    this.scene.add(this.lookTarget);

    this.mood = 'idle';
    this.moodColor = new THREE.Color(MOOD_PRESETS.idle.primary);
    this.secondaryColor = new THREE.Color(MOOD_PRESETS.idle.secondary);
    this.haloColor = new THREE.Color(MOOD_PRESETS.idle.halo);
    this.moodScale = MOOD_PRESETS.idle.scale;
    this.currentVrm = null;
    this.customVrmLabel = '';
    this.customVrmRoot = null;
    this.customVrmBaseScale = 1;
    this.customVrmBasePosition = new THREE.Vector3();
    this.nextBlinkAt = performance.now() + nextBlinkDelay();
    this.blinkLeft = 0;
    this.blinkRight = 0;
    this.blinkQueue = [];
    this.moodResetTimer = null;
    this.pokeEnergy = 0;

    // Life-feel state
    this.deepBreathPhase = 0;
    this.nextDeepBreathAt = performance.now() + 20000 + Math.random() * 20000;
    this.fidgetSeed = Math.random() * 100;
    this.lastInteractionAt = performance.now();
    this.wanderOffsetX = 0;
    this.wanderOffsetY = 0;
    this.wanderTargetX = 0;
    this.wanderTargetY = 0;
    this.nextWanderAt = performance.now() + 5000 + Math.random() * 5000;
    this.isUserPointing = false;

    // Expression system state
    this.exprTarget = {}; // current target blendshape values from setExpression()
    this.exprCurrent = {}; // smoothly interpolated current values
    this.exprSpeed = EXPR_SPEEDS.smooth;

    // Idle action timer
    this.nextIdleActionAt = performance.now() + 5000 + Math.random() * 3000;
    this.nextBoredomAt = performance.now() + 10000;
    this.modelBaseRotationY = 0;
    this.userPointerTimeout = null;

    // Chase state (Desktop Goose visual feedback)
    this.chaseState = {
      active: false,
      mode: 'IDLE',
      directionX: 0,
      directionY: 0,
      speed: 0,
      distance: 0,
    };
    this.chaseLeanTarget = { x: 0, z: 0 };
    this.chaseLeanCurrent = { x: 0, z: 0 };

    this.createLighting();
    this.createStageDecor();
    this.placeholder = this.createPlaceholderMascot();
    this.scene.add(this.placeholder.group);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
    this.resize();

    this.animate = this.animate.bind(this);
    this.renderer.setAnimationLoop(this.animate);
  }

  createLighting() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.8));

    this.keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
    this.keyLight.position.set(2.8, 5.4, 5.5);
    this.scene.add(this.keyLight);

    this.fillLight = new THREE.DirectionalLight(0xa8d8ff, 0.65);
    this.fillLight.position.set(-3.4, 2.6, 2.8);
    this.scene.add(this.fillLight);

    this.rimLight = new THREE.PointLight(0xffaa78, 1.3, 18, 2);
    this.rimLight.position.set(0, 2.8, -2.4);
    this.scene.add(this.rimLight);
  }

  createStageDecor() {
    // Transparent pet mode: no halo or floor decorations
  }

  createPlaceholderMascot() {
    const group = new THREE.Group();
    const pivot = new THREE.Group();
    const headPivot = new THREE.Group();

    const bodyMaterial = new THREE.MeshToonMaterial({ color: MOOD_PRESETS.idle.primary });
    const accentMaterial = new THREE.MeshToonMaterial({ color: MOOD_PRESETS.idle.secondary });
    const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilMaterial = new THREE.MeshBasicMaterial({ color: 0x0f1117 });

    const body = new THREE.Mesh(new THREE.SphereGeometry(1.05, 40, 40), bodyMaterial);
    body.position.set(0, 1.05, 0);
    body.scale.set(1.0, 1.08, 0.92);
    pivot.add(body);

    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.82, 32, 32), accentMaterial);
    chest.position.set(0, 0.94, 0.48);
    chest.scale.set(0.88, 0.92, 0.44);
    pivot.add(chest);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.88, 40, 40), bodyMaterial);
    head.position.set(0, 0, 0);
    head.scale.set(1.0, 0.96, 0.98);
    headPivot.position.set(0, 2.1, 0.12);
    headPivot.add(head);

    const earGeometry = new THREE.ConeGeometry(0.24, 0.55, 20);
    const leftEar = new THREE.Mesh(earGeometry, bodyMaterial);
    leftEar.position.set(-0.42, 0.72, 0.02);
    leftEar.rotation.z = 0.18;
    leftEar.rotation.x = -0.08;
    headPivot.add(leftEar);

    const rightEar = new THREE.Mesh(earGeometry, bodyMaterial);
    rightEar.position.set(0.42, 0.72, 0.02);
    rightEar.rotation.z = -0.18;
    rightEar.rotation.x = -0.08;
    headPivot.add(rightEar);

    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 24), accentMaterial);
    snout.position.set(0, -0.18, 0.7);
    snout.scale.set(1.05, 0.78, 0.65);
    headPivot.add(snout);

    const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.16, 18, 18), eyeMaterial);
    leftEye.position.set(-0.26, 0.08, 0.72);
    leftEye.scale.z = 0.42;
    headPivot.add(leftEye);

    const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.16, 18, 18), eyeMaterial);
    rightEye.position.set(0.26, 0.08, 0.72);
    rightEye.scale.z = 0.42;
    headPivot.add(rightEye);

    const leftPupil = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 12), pupilMaterial);
    leftPupil.position.set(-0.26, 0.05, 0.84);
    headPivot.add(leftPupil);

    const rightPupil = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 12), pupilMaterial);
    rightPupil.position.set(0.26, 0.05, 0.84);
    headPivot.add(rightPupil);

    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), pupilMaterial);
    nose.position.set(0, -0.1, 0.93);
    nose.scale.set(1.0, 0.8, 1.2);
    headPivot.add(nose);

    const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 1.0, 5, 10), bodyMaterial);
    tail.position.set(0.95, 1.15, -0.4);
    tail.rotation.z = -0.9;
    tail.rotation.x = 0.45;
    pivot.add(tail);

    const leftPaw = new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 18), accentMaterial);
    leftPaw.position.set(-0.42, 0.18, 0.46);
    leftPaw.scale.set(1.0, 0.7, 1.15);
    pivot.add(leftPaw);

    const rightPaw = new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 18), accentMaterial);
    rightPaw.position.set(0.42, 0.18, 0.46);
    rightPaw.scale.set(1.0, 0.7, 1.15);
    pivot.add(rightPaw);

    group.add(pivot);
    group.add(headPivot);

    return {
      group,
      pivot,
      headPivot,
      bodyMaterial,
      accentMaterial,
      leftEye,
      rightEye,
      leftPupil,
      rightPupil,
      tail
    };
  }

  resize() {
    const width = Math.max(this.container.clientWidth, 1);
    const height = Math.max(this.container.clientHeight, 1);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  setMood(mood, durationMs = 0) {
    this.mood = MOOD_PRESETS[mood] ? mood : 'idle';
    clearTimeout(this.moodResetTimer);

    // Apply mood's default expression
    const preset = MOOD_PRESETS[this.mood];
    if (preset?.defaultExpr) {
      this.setExpression(preset.defaultExpr, 'smooth');
    }

    if (durationMs > 0) {
      this.moodResetTimer = setTimeout(() => {
        this.setMood('idle');
      }, durationMs);
    }
  }

  /**
   * Set a VRM expression by name (from VRM_EXPR map).
   * @param {string} name - Expression key from VRM_EXPR
   * @param {string} [speed='smooth'] - Transition speed category
   */
  setExpression(name, speed = 'smooth') {
    const preset = VRM_EXPR[name];
    if (!preset) return;
    this.exprTarget = { ...preset };
    this.exprSpeed = EXPR_SPEEDS[speed] || EXPR_SPEEDS.smooth;
  }

  /** Clear expression back to neutral. */
  clearExpression(speed = 'smooth') {
    this.setExpression('normal', speed);
  }

  /** Set absolute model Y rotation (radians). */
  setModelRotation(angleY) {
    this.modelBaseRotationY = angleY;
    if (this.currentVrm) {
      this.currentVrm.scene.rotation.y = angleY;
    }
  }

  /** Adjust model Y rotation by a delta (radians). Returns new angle. */
  adjustModelRotation(delta) {
    this.modelBaseRotationY += delta;
    return this.modelBaseRotationY;
  }

  updatePointer(clientX, clientY) {
    const rect = this.container.getBoundingClientRect();
    const nx = ((clientX - rect.left) / rect.width - 0.5) * 2;
    const ny = -((clientY - rect.top) / rect.height - 0.5) * 2;
    this.pointer.set(THREE.MathUtils.clamp(nx, -1, 1), THREE.MathUtils.clamp(ny, -1, 1));
    this.isUserPointing = true;
    this.lastInteractionAt = performance.now();
    clearTimeout(this.userPointerTimeout);
    this.userPointerTimeout = setTimeout(() => { this.isUserPointing = false; }, 3000);
  }

  poke() {
    this.pokeEnergy = 1;
    this.lastInteractionAt = performance.now();
    this.setMood('happy', 1100);
  }

  /**
   * Set the current chase state for Desktop Goose visual feedback.
   * @param {{ mode: string, directionX: number, directionY: number, speed: number, distance: number }} state
   */
  setChaseState(state) {
    if (!state) return;
    Object.assign(this.chaseState, state);
    this.chaseState.active = state.mode !== 'IDLE';

    // Convert movement direction (-1..1) to body lean targets
    const leanScale = Math.min(1, (state.speed || 0) / 5);
    this.chaseLeanTarget.x = (state.directionX || 0) * 0.12 * leanScale;
    this.chaseLeanTarget.z = (state.directionY || 0) * 0.06 * leanScale;
  }

  scheduleBlink() {
    const r = Math.random();
    if (r < 0.5) {
      // Normal fast blink (50%)
      this.blinkQueue.push(
        { left: 1, right: 1, duration: 0.06 },
        { left: 0, right: 0, duration: 0.08 }
      );
    } else if (r < 0.65) {
      // Double blink (15%)
      this.blinkQueue.push(
        { left: 1, right: 1, duration: 0.06 },
        { left: 0, right: 0, duration: 0.1 },
        { left: 1, right: 1, duration: 0.06 },
        { left: 0, right: 0, duration: 0.08 }
      );
    } else if (r < 0.8) {
      // Half blink then full (15%)
      this.blinkQueue.push(
        { left: 0.5, right: 0.5, duration: 0.1 },
        { left: 1, right: 1, duration: 0.06 },
        { left: 0, right: 0, duration: 0.12 }
      );
    } else if (r < 0.9) {
      // Slow dreamy blink (10%)
      this.blinkQueue.push(
        { left: 0.5, right: 0.5, duration: 0.12 },
        { left: 1, right: 1, duration: 0.2 },
        { left: 0.5, right: 0.5, duration: 0.25 },
        { left: 0, right: 0, duration: 0.3 }
      );
    } else {
      // Wink (10%)
      const winkL = Math.random() < 0.5;
      this.blinkQueue.push(
        { left: winkL ? 1 : 0, right: winkL ? 0 : 1, duration: 0.08 },
        { left: 0, right: 0, duration: 0.1 }
      );
    }
  }

  advanceBlinkQueue(delta) {
    if (this.blinkQueue.length === 0) {
      this.blinkLeft = THREE.MathUtils.lerp(this.blinkLeft, 0, 0.25);
      this.blinkRight = THREE.MathUtils.lerp(this.blinkRight, 0, 0.25);
      return;
    }
    const frame = this.blinkQueue[0];
    if (!frame._elapsed) frame._elapsed = 0;
    frame._elapsed += delta;
    const t = Math.min(frame._elapsed / frame.duration, 1);
    this.blinkLeft = THREE.MathUtils.lerp(this.blinkLeft, frame.left, t > 0.5 ? 0.5 : 0.3);
    this.blinkRight = THREE.MathUtils.lerp(this.blinkRight, frame.right, t > 0.5 ? 0.5 : 0.3);
    if (frame._elapsed >= frame.duration) {
      this.blinkLeft = frame.left;
      this.blinkRight = frame.right;
      this.blinkQueue.shift();
    }
  }

  clearCustomVrm() {
    if (this.customVrmRoot) {
      this.scene.remove(this.customVrmRoot);
      if (VRMUtils.deepDispose) {
        VRMUtils.deepDispose(this.customVrmRoot);
      }
    }

    this.customVrmRoot = null;
    this.currentVrm = null;
    this.customVrmLabel = '';
    this.customVrmBaseScale = 1;
    this.customVrmBasePosition.set(0, 0, 0);
    this.placeholder.group.visible = true;
  }

  async loadVrm(fileUrl, { label = '' } = {}) {
    if (!fileUrl) {
      this.clearCustomVrm();
      return { success: false, reason: 'empty-url' };
    }

    this.clearCustomVrm();

    return new Promise((resolve, reject) => {
      this.loader.load(
        fileUrl,
        (gltf) => {
          try {
            const vrm = gltf.userData.vrm;
            if (!vrm) {
              throw new Error('未检测到 VRM 数据');
            }

            if (VRMUtils.removeUnnecessaryVertices) {
              VRMUtils.removeUnnecessaryVertices(gltf.scene);
            }
            if (VRMUtils.removeUnnecessaryJoints) {
              VRMUtils.removeUnnecessaryJoints(gltf.scene);
            }
            if (VRMUtils.rotateVRM0) {
              VRMUtils.rotateVRM0(vrm);
            }

            const box = new THREE.Box3().setFromObject(vrm.scene);
            const size = new THREE.Vector3();
            const center = new THREE.Vector3();
            box.getSize(size);
            box.getCenter(center);

            const targetHeight = 3.2;
            const scale = size.y > 0 ? targetHeight / size.y : 1.0;

            this.customVrmBasePosition.set(-center.x * scale, -box.min.y * scale, -center.z * scale);

            vrm.scene.position.copy(this.customVrmBasePosition);
            vrm.scene.scale.setScalar(scale);
            vrm.scene.rotation.y = this.modelBaseRotationY;
            vrm.scene.traverse((obj) => {
              obj.frustumCulled = false;
            });

            if (vrm.lookAt) {
              vrm.lookAt.target = this.lookTarget;
            }

            this.currentVrm = vrm;
            this.customVrmRoot = vrm.scene;
            this.customVrmLabel = label;
            this.customVrmBaseScale = scale;
            this.placeholder.group.visible = false;
            this.scene.add(vrm.scene);
            resolve({ success: true, label });
          } catch (error) {
            this.clearCustomVrm();
            reject(error);
          }
        },
        undefined,
        (error) => {
          this.clearCustomVrm();
          reject(error);
        }
      );
    });
  }

  updatePlaceholder(delta, elapsed) {
    const preset = MOOD_PRESETS[this.mood] || MOOD_PRESETS.idle;
    const bodyColor = new THREE.Color(preset.primary);
    const accentColor = new THREE.Color(preset.secondary);
    const haloColor = new THREE.Color(preset.halo);

    lerpColor(this.placeholder.bodyMaterial, bodyColor, 0.08);
    lerpColor(this.placeholder.accentMaterial, accentColor, 0.08);

    // Multi-frequency bob with deep breath
    const bob = Math.sin(elapsed * 1.7) * 0.05
      + Math.sin(elapsed * 0.7) * 0.025
      + Math.sin(elapsed * 2.3) * 0.008
      + (this.deepBreathPhase > 0 ? Math.sin(this.deepBreathPhase) * 0.03 : 0);

    // Fidget: subtle weight shift
    const fidgetX = Math.sin(elapsed * 0.23 + this.fidgetSeed) * 0.012;
    const fidgetR = Math.sin(elapsed * 0.17 + this.fidgetSeed * 2) * 0.006;

    const tailWave = Math.sin(elapsed * 2.4) * 0.12 + Math.sin(elapsed * 1.1) * 0.04;

    // Head target with eye wander (biased toward chase direction during chasing)
    const chaseBiasX = this.chaseState.active ? this.chaseState.directionX * 0.3 : 0;
    const chaseBiasY = this.chaseState.active ? this.chaseState.directionY * 0.15 : 0;
    const wanderX = this.isUserPointing ? 0 : (this.wanderOffsetX + chaseBiasX);
    const wanderY = this.isUserPointing ? 0 : (this.wanderOffsetY + chaseBiasY);
    const targetHeadY = this.pointer.x * 0.28 + wanderX * 0.4;
    const targetHeadX = this.pointer.y * 0.14 + wanderY * 0.3;
    const speakingPulse = this.mood === 'speaking' ? (Math.sin(elapsed * 12.0) * 0.5 + 0.5) * 0.16 : 0;

    this.placeholder.pivot.position.y = THREE.MathUtils.lerp(this.placeholder.pivot.position.y, bob + this.pokeEnergy * 0.06, 0.1);
    this.placeholder.pivot.position.x = THREE.MathUtils.lerp(this.placeholder.pivot.position.x || 0, fidgetX, 0.05);
    this.placeholder.pivot.rotation.z = THREE.MathUtils.lerp(this.placeholder.pivot.rotation.z || 0, fidgetR, 0.04);
    this.placeholder.pivot.scale.setScalar(THREE.MathUtils.lerp(this.placeholder.pivot.scale.x, preset.scale + this.pokeEnergy * 0.04, 0.1));

    // Chase movement lean for placeholder mascot
    if (this.chaseState.active) {
      this.chaseLeanCurrent.x = THREE.MathUtils.lerp(this.chaseLeanCurrent.x || 0, this.chaseLeanTarget.x || 0, 0.12);
      this.chaseLeanCurrent.z = THREE.MathUtils.lerp(this.chaseLeanCurrent.z || 0, this.chaseLeanTarget.z || 0, 0.12);
      this.placeholder.pivot.rotation.z += this.chaseLeanCurrent.x * 0.5;
      this.placeholder.pivot.rotation.x += this.chaseLeanCurrent.z * 0.5;
      // Chase speed adds to bob amplitude
      const chaseBob = this.chaseState.speed * 0.015;
      this.placeholder.pivot.position.y += chaseBob;
    }

    this.placeholder.headPivot.rotation.y = THREE.MathUtils.lerp(this.placeholder.headPivot.rotation.y, targetHeadY, 0.1);
    this.placeholder.headPivot.rotation.x = THREE.MathUtils.lerp(this.placeholder.headPivot.rotation.x, targetHeadX + speakingPulse * 0.12, 0.12);
    this.placeholder.tail.rotation.y = THREE.MathUtils.lerp(this.placeholder.tail.rotation.y, tailWave, 0.12);

    // Enhanced blink (asymmetric support)
    const leftBlinkScale = 1 - this.blinkLeft * 0.88;
    const rightBlinkScale = 1 - this.blinkRight * 0.88;
    const eyeOpenL = Math.max(0.12, leftBlinkScale - speakingPulse * 0.25);
    const eyeOpenR = Math.max(0.12, rightBlinkScale - speakingPulse * 0.25);
    this.placeholder.leftEye.scale.y = THREE.MathUtils.lerp(this.placeholder.leftEye.scale.y, eyeOpenL, 0.3);
    this.placeholder.rightEye.scale.y = THREE.MathUtils.lerp(this.placeholder.rightEye.scale.y, eyeOpenR, 0.3);

    // Pupil with wander offset
    const pupilOffsetX = this.pointer.x * 0.05 + wanderX * 0.06;
    const pupilOffsetY = this.pointer.y * 0.04 + wanderY * 0.05;
    this.placeholder.leftPupil.position.x = THREE.MathUtils.lerp(this.placeholder.leftPupil.position.x, -0.26 + pupilOffsetX, 0.15);
    this.placeholder.leftPupil.position.y = THREE.MathUtils.lerp(this.placeholder.leftPupil.position.y, 0.05 + pupilOffsetY, 0.15);
    this.placeholder.rightPupil.position.x = THREE.MathUtils.lerp(this.placeholder.rightPupil.position.x, 0.26 + pupilOffsetX, 0.15);
    this.placeholder.rightPupil.position.y = THREE.MathUtils.lerp(this.placeholder.rightPupil.position.y, 0.05 + pupilOffsetY, 0.15);
  }

  updateVrm(delta, elapsed) {
    if (!this.currentVrm) return;

    const preset = MOOD_PRESETS[this.mood] || MOOD_PRESETS.idle;

    // Look target with eye wander offset
    const wanderX = this.isUserPointing ? 0 : this.wanderOffsetX;
    const wanderY = this.isUserPointing ? 0 : this.wanderOffsetY;
    this.lookTarget.position.x = THREE.MathUtils.lerp(
      this.lookTarget.position.x, this.pointer.x * 1.35 + wanderX * 2.0, 0.08
    );
    this.lookTarget.position.y = THREE.MathUtils.lerp(
      this.lookTarget.position.y, 1.6 + this.pointer.y * 0.85 + wanderY * 1.5, 0.08
    );

    // Multi-frequency breathing
    const breathBase = Math.sin(elapsed * 1.8) * 0.008 + Math.sin(elapsed * 0.7) * 0.004;
    const deepBreathBoost = this.deepBreathPhase > 0 ? Math.sin(this.deepBreathPhase) * 0.018 : 0;
    const breathing = 1 + breathBase + deepBreathBoost;

    this.currentVrm.scene.scale.setScalar(this.customVrmBaseScale * breathing * preset.scale);

    // Multi-frequency body sway
    const swayY = Math.sin(elapsed * 0.35) * 0.0008 + Math.sin(elapsed * 0.17 + this.fidgetSeed) * 0.0004;
    this.currentVrm.scene.rotation.y = this.modelBaseRotationY + swayY;

    // Multi-frequency vertical float
    const floatY = Math.sin(elapsed * 1.35) * 0.02 + Math.sin(elapsed * 0.6) * 0.01;
    this.currentVrm.scene.position.x = this.customVrmBasePosition.x;
    this.currentVrm.scene.position.z = this.customVrmBasePosition.z;
    this.currentVrm.scene.position.y = THREE.MathUtils.lerp(
      this.currentVrm.scene.position.y,
      this.customVrmBasePosition.y + floatY + this.pokeEnergy * 0.05,
      0.08
    );

    // Bone micro-animations (spine sway + breathing lean + chase lean)
    const humanoid = this.currentVrm.humanoid;
    if (humanoid) {
      const spineBone = humanoid.getNormalizedBoneNode('spine');
      if (spineBone) {
        const boneSwayZ = Math.sin(elapsed * 0.23 + this.fidgetSeed) * 0.008;
        const boneLeanX = Math.sin(elapsed * 0.31 + this.fidgetSeed * 2) * 0.005
          + (this.deepBreathPhase > 0 ? Math.sin(this.deepBreathPhase) * 0.012 : 0);
        spineBone.rotation.z = THREE.MathUtils.lerp(spineBone.rotation.z, boneSwayZ, 0.04);
        spineBone.rotation.x = THREE.MathUtils.lerp(spineBone.rotation.x, boneLeanX, 0.04);

        // Chase movement lean (Desktop Goose)
        if (this.chaseState.active) {
          this.chaseLeanCurrent.x = THREE.MathUtils.lerp(this.chaseLeanCurrent.x, this.chaseLeanTarget.x, 0.12);
          this.chaseLeanCurrent.z = THREE.MathUtils.lerp(this.chaseLeanCurrent.z, this.chaseLeanTarget.z, 0.12);
          spineBone.rotation.z += this.chaseLeanCurrent.x;
          spineBone.rotation.x += this.chaseLeanCurrent.z;
        }
      }
    }

    // Chase movement: whole model lean
    if (this.chaseState.active) {
      const leanAmount = this.chaseState.speed * 0.06;
      this.currentVrm.scene.rotation.z = THREE.MathUtils.lerp(
        this.currentVrm.scene.rotation.z || 0,
        this.chaseState.directionX * leanAmount,
        0.1
      );
    }

    // ── Expression system: merge mood defaults, setExpression() overrides, blink, and speech ──
    const expressionManager = this.currentVrm.expressionManager;
    if (expressionManager) {
      const speech = this.mood === 'speaking' ? (Math.sin(elapsed * 11.5) * 0.5 + 0.5) * 0.7 : 0;

      // Mood-based default expression targets
      const moodDefaults = {
        happy: this.mood === 'happy' ? 0.55 : 0,
        relaxed: (this.mood === 'thinking' || this.mood === 'listening') ? 0.28 : 0,
        sad: (this.mood === 'error' || this.mood === 'offline') ? 0.25 : 0,
        angry: this.mood === 'error' ? 0.15 : 0,
        surprised: this.pokeEnergy > 0.3 ? this.pokeEnergy * 0.5 : 0,
      };

      // Merge: exprTarget from setExpression() overrides mood defaults
      const hasExpr = Object.keys(this.exprTarget).length > 0;
      const targets = hasExpr ? { ...moodDefaults, ...this.exprTarget } : moodDefaults;

      // Lerp speed: use expression speed if active, otherwise default
      const lerpRate = hasExpr ? Math.min(1, delta / Math.max(0.02, this.exprSpeed)) : 0.08;

      // Standard blendshapes
      const blendNames = ['happy', 'angry', 'sad', 'relaxed', 'surprised', 'blink', 'blinkLeft', 'blinkRight', 'aa', 'oh', 'ee', 'ih', 'ou'];
      for (const name of blendNames) {
        let target = targets[name] || 0;

        // Layer blink from blink system (additive with expression blink)
        if (name === 'blink') target = Math.max(target, Math.max(this.blinkLeft, this.blinkRight));
        if (name === 'blinkLeft') target = Math.max(target, this.blinkLeft);
        if (name === 'blinkRight') target = Math.max(target, this.blinkRight);

        // Layer speech vowels (additive)
        if (name === 'aa') target = Math.max(target, speech * 0.8);
        if (name === 'oh') target = Math.max(target, speech * 0.35);
        if (name === 'ee') target = Math.max(target, speech * 0.2);
        if (name === 'ih') target = Math.max(target, speech * 0.15);
        if (name === 'ou') target = Math.max(target, speech * 0.1);

        // Smooth interpolation
        const current = this.exprCurrent[name] || 0;
        const next = THREE.MathUtils.lerp(current, target, lerpRate);
        this.exprCurrent[name] = next;
        expressionManager.setValue(name, THREE.MathUtils.clamp(next, 0, 1));
      }

      // Head rotation override from expression (_headRotZ)
      if (targets._headRotZ !== undefined && humanoid) {
        const headBone = humanoid.getNormalizedBoneNode('head');
        if (headBone) {
          headBone.rotation.z = THREE.MathUtils.lerp(headBone.rotation.z, targets._headRotZ, lerpRate);
        }
      }

      // Scale override from expression (_scale)
      if (targets._scale !== undefined) {
        this.currentVrm.scene.scale.setScalar(this.customVrmBaseScale * breathing * targets._scale);
      }
    }

    // Rim lighting
    this.rimLight.color.lerp(new THREE.Color(preset.primary), 0.08);
    const intensityMap = { offline: 0.7, happy: 1.6, excited: 1.6, love: 1.5, angry: 1.5, sleepy: 0.8, sad: 0.9, calm: 1.0 };
    this.rimLight.intensity = THREE.MathUtils.lerp(
      this.rimLight.intensity,
      intensityMap[this.mood] ?? 1.2,
      0.08
    );

    this.currentVrm.update(delta * breathing);
  }

  animate() {
    const rawDelta = this.clock.getDelta();
    this.frameAccum += rawDelta;
    if (this.frameAccum < this.frameInterval) return;
    const delta = this.frameAccum;
    this.frameAccum = 0;
    const elapsed = this.clock.elapsedTime;
    const now = performance.now();

    // Enhanced blink system with variants
    if (now >= this.nextBlinkAt && this.blinkQueue.length === 0) {
      this.scheduleBlink();
      const base = Math.random() < 0.2 ? 800 + Math.random() * 1500 : 2500 + Math.random() * 5000;
      this.nextBlinkAt = now + base;
    }
    this.advanceBlinkQueue(delta);

    // Deep breath trigger (20-40s cycle)
    if (now >= this.nextDeepBreathAt && this.mood !== 'speaking') {
      if (Math.random() < 0.5) this.deepBreathPhase = 0.01;
      this.nextDeepBreathAt = now + 20000 + Math.random() * 20000;
    }
    if (this.deepBreathPhase > 0) {
      this.deepBreathPhase += delta * 2.5;
      if (this.deepBreathPhase > Math.PI) this.deepBreathPhase = 0;
    }

    // Eye wander (only in idle, when user isn't actively pointing)
    if (now >= this.nextWanderAt && this.mood === 'idle' && !this.isUserPointing) {
      if (Math.random() < 0.35) {
        this.wanderTargetX = (Math.random() - 0.5) * 0.6;
        this.wanderTargetY = (Math.random() - 0.5) * 0.4;
        setTimeout(() => { this.wanderTargetX = 0; this.wanderTargetY = 0; }, 1500 + Math.random() * 2000);
      }
      this.nextWanderAt = now + 5000 + Math.random() * 5000;
    }
    this.wanderOffsetX = THREE.MathUtils.lerp(this.wanderOffsetX, this.wanderTargetX, 0.03);
    this.wanderOffsetY = THREE.MathUtils.lerp(this.wanderOffsetY, this.wanderTargetY, 0.03);

    // === Boredom progression system ===
    if (this.currentVrm && this.mood === 'idle') {
      const idleSec = (now - this.lastInteractionAt) / 1000;

      // 3min+: yawn / stretch / zone-out (25% per check)
      if (idleSec > 180 && now >= this.nextBoredomAt && Math.random() < 0.25) {
        this.nextBoredomAt = now + 4000;
        const r = Math.random();
        if (r < 0.4) {
          // Yawn: mouth open → sleepy eyes → drowsy
          this.setExpression('wow', 'fast');
          setTimeout(() => this.setExpression('sleepy', 'normal'), 800);
          setTimeout(() => this.setExpression('drowsy', 'smooth'), 1500);
          setTimeout(() => this.clearExpression(), 2500);
        } else if (r < 0.7) {
          // Stretch: sleepy → surprised snap → normal
          this.setExpression('sleepy', 'normal');
          setTimeout(() => this.setExpression('surprised', 'fast'), 900);
          setTimeout(() => this.clearExpression(), 1400);
        } else {
          // Zone-out: drowsy → half-blink → curious → normal
          this.setExpression('drowsy', 'smooth');
          setTimeout(() => this.setExpression('halfBlink', 'normal'), 1200);
          setTimeout(() => this.setExpression('curious', 'fast'), 2200);
          setTimeout(() => this.clearExpression(), 2800);
        }
      }
      // 1min+: sigh / look around / bored tilt (30% per check)
      else if (idleSec > 60 && now >= this.nextBoredomAt && Math.random() < 0.3) {
        this.nextBoredomAt = now + 3000;
        const r = Math.random();
        if (r < 0.3) {
          // Sigh: half-blink
          this.setExpression('halfBlink', 'smooth');
          setTimeout(() => this.clearExpression(), 1500);
        } else if (r < 0.6) {
          // Look around
          this.setExpression('lookLeft', 'normal');
          setTimeout(() => this.setExpression('lookUp', 'normal'), 500);
          setTimeout(() => this.setExpression('lookRight', 'normal'), 1000);
          setTimeout(() => this.setExpression('hmm', 'smooth'), 1500);
          setTimeout(() => this.clearExpression(), 2200);
        } else {
          // Bored head tilt
          this.setExpression('hmm', 'smooth');
          setTimeout(() => this.setExpression('blink', 'fast'), 1000);
          setTimeout(() => this.clearExpression(), 1300);
        }
      }
    }

    // Idle micro-expression actions (every ~4s when idle, 30% trigger)
    if (this.currentVrm && this.mood === 'idle' && now >= this.nextIdleActionAt) {
      if (Math.random() < 0.3) {
        const action = pickIdleAction();
        action(this);
      }
      this.nextIdleActionAt = now + 3500 + Math.random() * 1500;
    }

    this.pokeEnergy = THREE.MathUtils.lerp(this.pokeEnergy, 0, 0.08);
    this.keyLight.position.x = THREE.MathUtils.lerp(this.keyLight.position.x, 2.8 + this.pointer.x * 0.35, 0.04);
    this.fillLight.position.y = THREE.MathUtils.lerp(this.fillLight.position.y, 2.6 + this.pointer.y * 0.2, 0.04);

    if (this.currentVrm) {
      this.updateVrm(delta, elapsed);
    } else {
      this.updatePlaceholder(delta, elapsed);
    }

    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    clearTimeout(this.moodResetTimer);
    clearTimeout(this.userPointerTimeout);
    this.resizeObserver.disconnect();
    this.renderer.setAnimationLoop(null);
    this.clearCustomVrm();
    this.renderer.dispose();
    this.container.innerHTML = '';
  }
}
