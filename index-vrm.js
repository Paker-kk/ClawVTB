import { AvatarStage } from './vrm-runtime.js';

const electronAPI = window.electronAPI;
const stage = document.getElementById('stage');
const avatarStage = new AvatarStage({ container: stage });
const inputBar = document.getElementById('inputBar');
const inputEl = document.getElementById('chatInput');
const sendButton = document.getElementById('sendButton');
const controls = document.getElementById('vrmControls');
const btnChat = document.getElementById('btnChat');
const btnVoice = document.getElementById('btnVoice');
const btnScreenshot = document.getElementById('btnScreenshot');
const btnModelSwitch = document.getElementById('btnModelSwitch');
const btnImportVrm = document.getElementById('btnImportVrm');
const modelBadge = document.getElementById('modelBadge');

let voiceOn = true;
let isConnected = false;
let clickCount = 0;
let clickTimer = null;

/* ── Mood mapping ── */

const EMOTION_MOOD_MAP = {
  happy: 'happy', surprised: 'surprised', excited: 'excited', love: 'love',
  calm: 'calm', focused: 'focused', thinking: 'thinking',
  sad: 'sad', fearful: 'fearful', angry: 'angry', disgusted: 'angry',
  sleepy: 'sleepy', listening: 'listening', talking: 'talking',
  speaking: 'speaking', error: 'error', offline: 'offline',
};

function mapEmotionToMood(emotion) {
  return EMOTION_MOOD_MAP[String(emotion || '').toLowerCase()] || 'idle';
}

function getMoodRecoveryTime(mood) {
  if (mood === 'thinking') return 8000;
  if (mood === 'error') return 6000;
  if (mood === 'happy') return 5000;
  return 4000;
}

function normalizeStatus(status) {
  const raw = typeof status === 'string' ? status : status?.status || status?.phase || '';
  const value = String(raw).toLowerCase();
  if (value.includes('offline') || value.includes('disconnect')) return 'offline';
  if (value.includes('think')) return 'thinking';
  if (value.includes('talk') || value.includes('speak')) return 'speaking';
  if (value.includes('listen')) return 'listening';
  if (value.includes('error') || value.includes('fail')) return 'error';
  if (value.includes('happy') || value.includes('done')) return 'happy';
  return 'idle';
}

function setTemporaryMood(mood, durationMs = getMoodRecoveryTime(mood)) {
  avatarStage.setMood(mood, durationMs);
}

function updateVoiceButton() {
  btnVoice?.classList.toggle('is-muted', !voiceOn);
  btnVoice?.setAttribute('aria-pressed', String(voiceOn));
}

function updateModelBadge(model) {
  if (!modelBadge || !model) return;
  modelBadge.textContent = model.icon || model.shortName || model.id || 'AI';
  modelBadge.style.color = model.color || '';
}

function flashModelSwitch(color = '#ff8b5e') {
  controls?.classList.add('show');
  stage.style.filter = `drop-shadow(0 0 18px ${color})`;
  setTimeout(() => {
    stage.style.filter = '';
    controls?.classList.remove('show');
  }, 480);
}

function toggleInput() {
  inputBar?.classList.toggle('show');
  controls?.classList.add('show');
  if (inputBar?.classList.contains('show')) {
    inputEl?.focus();
  }
}

async function toggleVoice() {
  voiceOn = !voiceOn;
  updateVoiceButton();
  if (electronAPI) {
    await electronAPI.invoke('set-voice-enabled', voiceOn).catch(() => null);
  }
  setTemporaryMood('happy', 1500);
}

async function cycleModel() {
  if (!electronAPI) return;
  setTemporaryMood('thinking', 3500);
  const raw = await electronAPI.invoke('model-next').catch(() => null);
  const model = raw && typeof raw === 'object' && ('success' in raw || 'model' in raw || 'error' in raw)
    ? (raw.success ? raw.model : null)
    : raw;
  if (model) {
    updateModelBadge(model);
    flashModelSwitch(model.color);
    setTemporaryMood('happy', 2000);
  } else {
    setTemporaryMood('error', 1800);
  }
}

async function screenshot() {
  if (!electronAPI) return;
  setTemporaryMood('thinking', 3500);
  const result = await electronAPI.invoke('take-screenshot', 'manual').catch((error) => ({ success: false, error }));
  setTemporaryMood(result?.success ? 'happy' : 'error', result?.success ? 2200 : 2600);
}

async function importVrm() {
  if (!electronAPI) return;
  setTemporaryMood('thinking', 4000);
  const result = await electronAPI.invoke('avatar-select-vrm').catch((error) => ({ success: false, error }));
  if (result?.success) {
    await applyAvatarState(result);
    setTemporaryMood('happy', 2200);
  } else if (!result?.canceled) {
    setTemporaryMood('error', 2600);
  } else {
    avatarStage.setMood('idle');
  }
}

async function sendMessage() {
  const msg = inputEl?.value.trim();
  if (!msg || !electronAPI) return;
  inputEl.value = '';
  inputBar?.classList.remove('show');
  setTemporaryMood('thinking', 8000);
  const reply = await electronAPI.invoke('openclaw-send', msg).catch(() => null);
  if (reply) setTemporaryMood('happy', 3000);
}

async function showHistory() {
  if (!electronAPI) return;
  await electronAPI.invoke('show-history').catch(() => null);
  avatarStage.setExpression('superHappy', 'fast');
  setTimeout(() => avatarStage.clearExpression(), 1200);
}

async function refreshConnectionStatus() {
  if (!electronAPI) return;
  const status = await electronAPI.invoke('openclaw-status').catch(() => null);
  if (!status) {
    if (isConnected) avatarStage.setMood('offline');
    isConnected = false;
    return;
  }
  const wasConnected = isConnected;
  isConnected = Boolean(status.connected);
  if (!wasConnected && isConnected) {
    setTemporaryMood('happy', 2400);
  } else if (!isConnected) {
    avatarStage.setMood('offline');
  } else if (avatarStage.mood === 'offline') {
    avatarStage.setMood('idle');
  }
}

function handlePetMenuAction(action) {
  switch (action) {
    case 'chat':
      toggleInput();
      break;
    case 'toggle-voice':
      toggleVoice();
      break;
    case 'switch-model':
      cycleModel();
      break;
    case 'screenshot':
      screenshot();
      break;
    case 'import-vrm':
      importVrm();
      break;
    case 'setup-wizard':
      setTemporaryMood('thinking', 1200);
      break;
    default:
      break;
  }
}

/* ── Drag to move window ── */

let dragState = null;

stage.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  dragState = { screenX: e.screenX, screenY: e.screenY, offsetX: e.clientX, offsetY: e.clientY, moved: false };
  // Pause chase during drag
  if (electronAPI) electronAPI.send('chase-pause');
});

document.addEventListener('mousemove', (e) => {
  avatarStage.updatePointer(e.clientX, e.clientY);
  if (!dragState || !electronAPI) return;
  if (Math.abs(e.screenX - dragState.screenX) > 3 || Math.abs(e.screenY - dragState.screenY) > 3) {
    dragState.moved = true;
    electronAPI.send('drag-pet', {
      x: e.screenX,
      y: e.screenY,
      offsetX: dragState.offsetX,
      offsetY: dragState.offsetY
    });
  }
});

document.addEventListener('mouseup', () => {
  const wasDrag = dragState?.moved;
  dragState = null;
  if (wasDrag) {
    stage.dataset.suppressClick = '1';
    setTimeout(() => delete stage.dataset.suppressClick, 50);
    // Resume chase after drag
    if (electronAPI) {
      electronAPI.send('chase-resume');
      electronAPI.send('pet-activity', {
        type: 'pet-dragged',
        details: { description: 'was dragged by the user' }
      });
    }
  }
});

/* ── Single click: poke  |  Double click: context menu ── */

stage.addEventListener('click', () => {
  if (stage.dataset.suppressClick) return;
  clickCount += 1;
  clearTimeout(clickTimer);
  avatarStage.poke();
  if (electronAPI) {
    electronAPI.send('pet-activity', {
      type: 'pet-poked',
      details: { description: 'was poked by the user' }
    });
  }
  if (clickCount >= 3) {
    clickCount = 0;
    showHistory();
    return;
  }
  clickTimer = setTimeout(() => { clickCount = 0; }, 800);
});

stage.addEventListener('dblclick', () => {
  if (electronAPI) electronAPI.send('show-pet-context-menu');
});

/* ── Scroll wheel: resize window | Shift+scroll: rotate model ── */

stage.addEventListener('wheel', (e) => {
  if (!electronAPI) return;
  if (e.shiftKey) {
    const delta = e.deltaY > 0 ? 0.1 : -0.1;
    const newAngle = avatarStage.adjustModelRotation(delta);
    electronAPI.send('pet-rotate', { angle: newAngle });
  } else {
    electronAPI.send('pet-resize', { deltaY: e.deltaY });
  }
}, { passive: true });

for (const element of [inputBar, controls]) {
  element?.addEventListener('mousedown', (e) => e.stopPropagation());
  element?.addEventListener('click', (e) => e.stopPropagation());
  element?.addEventListener('wheel', (e) => e.stopPropagation());
}

btnChat?.addEventListener('click', toggleInput);
btnVoice?.addEventListener('click', toggleVoice);
btnScreenshot?.addEventListener('click', screenshot);
btnModelSwitch?.addEventListener('click', cycleModel);
btnImportVrm?.addEventListener('click', importVrm);
sendButton?.addEventListener('click', sendMessage);
inputEl?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendMessage();
  if (e.key === 'Escape') inputBar?.classList.remove('show');
});

/* ── IPC listeners ── */

if (electronAPI) {
  electronAPI.on('new-message', (msg) => {
    if (msg?.sender === '系统') { avatarStage.setMood('happy', 1000); return; }
    avatarStage.setMood(msg?.sender === '用户' ? 'listening' : 'speaking', 1400);
  });

  electronAPI.on('agent-response', (response) => {
    const mood = mapEmotionToMood(response?.emotion);
    avatarStage.setMood(mood, getMoodRecoveryTime(mood));
  });

  electronAPI.on('model-changed', (model) => {
    updateModelBadge(model);
    flashModelSwitch(model?.color);
    avatarStage.setMood('happy', 1200);
  });

  electronAPI.on('pet-menu-action', handlePetMenuAction);

  electronAPI.on('show-lyric', (payload) => {
    if (!payload?.text) return;
    if (payload.type === 'agent') avatarStage.setMood('speaking', 1400);
    else if (payload.type === 'user') avatarStage.setMood('listening', 1200);
  });

  electronAPI.on('status-update', (status) => {
    const mood = normalizeStatus(status);
    avatarStage.setMood(mood, mood === 'offline' ? 0 : 900);
  });

  // ── Chase state updates from main process ──
  electronAPI.on('chase-state', (chaseState) => {
    if (!chaseState) return;
    avatarStage.setChaseState(chaseState);

    // Map chase mode to expression
    const modeExprMap = {
      IDLE: null,
      CURIOUS: 'curious',
      CHASING: 'happy',
      AGGRESSIVE: 'superHappy',
      TIRED: 'sleepy',
    };
    const expr = modeExprMap[chaseState.mode];
    if (expr) {
      avatarStage.setExpression(expr, 'smooth');
    } else {
      avatarStage.clearExpression();
    }
  });

  // ── Commands from OpenClaw (routed through main process) ──
  electronAPI.on('pet-command', (cmd) => {
    if (!cmd) return;
    switch (cmd.command) {
      case 'do-trick':
        executeTrick(cmd.args?.name || 'wave');
        break;
      case 'say-something':
        showTextBubble(cmd.args?.text || '');
        break;
      default:
        console.log('[Pet] Unknown command:', cmd.command);
    }
  });
}

/* ── Trick animations ── */

function executeTrick(name) {
  const tricks = {
    wave: () => {
      avatarStage.setExpression('superHappy', 'fast');
      setTimeout(() => avatarStage.setExpression('wink', 'fast'), 500);
      setTimeout(() => avatarStage.clearExpression(), 1500);
    },
    spin: () => {
      avatarStage.adjustModelRotation(Math.PI * 2);
    },
    jump: () => {
      avatarStage.poke();
      avatarStage.setExpression('surprised', 'fast');
      setTimeout(() => avatarStage.clearExpression(), 800);
    },
    playDead: () => {
      avatarStage.setExpression('dead', 'slow');
      setTimeout(() => avatarStage.clearExpression(), 3000);
    },
    dance: () => {
      const steps = [
        ['happy', 'fast'], ['superHappy', 'fast'], ['giggle', 'smooth'],
        ['love', 'smooth'], ['superHappy', 'fast'], ['happy', 'smooth']
      ];
      let delay = 0;
      for (const [expr, speed] of steps) {
        setTimeout(() => avatarStage.setExpression(expr, speed), delay);
        delay += 400;
      }
      setTimeout(() => avatarStage.clearExpression(), delay);
    },
    bow: () => {
      avatarStage.setExpression('softSmile', 'smooth');
      avatarStage.setExpression('lookDown', 'smooth');
      setTimeout(() => avatarStage.clearExpression(), 2000);
    },
  };
  const trick = tricks[name];
  if (trick) trick();
}

function showTextBubble(text) {
  let bubble = document.getElementById('pet-speech-bubble');
  if (!bubble) {
    bubble = document.createElement('div');
    bubble.id = 'pet-speech-bubble';
    bubble.style.cssText = `
      position: absolute; top: 5%; left: 50%; transform: translateX(-50%);
      background: rgba(255,255,255,0.92); color: #222; padding: 6px 14px;
      border-radius: 12px; font-size: 13px; max-width: 85%; text-align: center;
      pointer-events: none; z-index: 10; transition: opacity 0.25s;
      white-space: pre-wrap; word-wrap: break-word;
      font-family: -apple-system, BlinkMacSystemFont, 'Microsoft YaHei', sans-serif;
    `;
    document.body.appendChild(bubble);
  }
  bubble.textContent = text;
  bubble.style.opacity = '1';
  clearTimeout(bubble._timeout);
  bubble._timeout = setTimeout(() => {
    bubble.style.opacity = '0';
  }, Math.max(3000, text.length * 80));
}

/* ── Avatar state ── */

async function applyAvatarState(state) {
  if (!state?.activeVrmUrl) {
    avatarStage.clearCustomVrm();
    return;
  }
  try {
    console.log('[VRM] loading:', state.activeVrmUrl);
    await avatarStage.loadVrm(state.activeVrmUrl, { label: state.activeVrmName });
    if (typeof state.modelRotationY === 'number') {
      avatarStage.setModelRotation(state.modelRotationY);
    }
    console.log('[VRM] loaded OK');
  } catch (err) {
    console.error('[VRM] load failed:', err);
    avatarStage.clearCustomVrm();
  }
}

/* ── Bootstrap ── */

async function bootstrap() {
  if (!electronAPI) {
    avatarStage.setMood('offline');
    return;
  }
  const avatarState = await electronAPI.invoke('avatar-state').catch(() => null);
  console.log('[VRM] avatarState:', JSON.stringify(avatarState));
  await applyAvatarState(avatarState);

  voiceOn = await electronAPI.invoke('voice-state').catch(() => true);
  updateVoiceButton();

  const model = await electronAPI.invoke('model-current').catch(() => null);
  updateModelBadge(model);

  avatarStage.setMood('offline');
  setTimeout(refreshConnectionStatus, 900);
  setInterval(refreshConnectionStatus, 10000);
}

bootstrap();
