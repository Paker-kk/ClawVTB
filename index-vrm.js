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
  }
});

/* ── Single click: poke  |  Double click: context menu ── */

stage.addEventListener('click', () => {
  if (stage.dataset.suppressClick) return;
  avatarStage.poke();
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