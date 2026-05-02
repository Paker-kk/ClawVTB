import { AvatarStage } from './vrm-runtime.js';

const electronAPI = window.electronAPI;
const stage = document.getElementById('stage');
const avatarStage = new AvatarStage({ container: stage });

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
  avatarStage.poke();
  if (electronAPI) {
    electronAPI.send('pet-activity', {
      type: 'pet-poked',
      details: { description: 'was poked by the user' }
    });
  }
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

  electronAPI.on('model-changed', () => {
    avatarStage.setMood('happy', 1200);
  });

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
}

bootstrap();