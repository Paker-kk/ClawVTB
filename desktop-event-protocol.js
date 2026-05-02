function stripTtsPauseMarkers(text) {
  return String(text || '').replace(/<#[\d.]+#>/g, '').trim();
}

function estimateLyricDuration(text) {
  const clean = stripTtsPauseMarkers(text);
  return Math.max(6000, clean.length * 180 + 2000);
}

function createUserMessageEvent(payload = {}) {
  const content = String(payload.content || '').trim();

  return {
    kind: 'user-message',
    sender: payload.sender || '用户',
    channel: payload.channel || 'desktop',
    source: payload.source || 'unknown',
    rawContent: content,
    displayContent: content,
    createdAt: Date.now()
  };
}

function createAssistantMessageEvent(payload = {}) {
  const rawContent = String(payload.content || '').trim();
  const displayContent = stripTtsPauseMarkers(rawContent);

  return {
    kind: 'assistant-message',
    sender: payload.sender || '小K',
    source: payload.source || 'unknown',
    emotion: payload.emotion || 'happy',
    rawContent,
    displayContent,
    duration: payload.duration || estimateLyricDuration(displayContent),
    createdAt: Date.now()
  };
}

// ── Pet activity types for bidirectional OpenClaw communication ──

const PET_ACTIVITY_TYPES = Object.freeze({
  CHASE_STARTED:       'chase-started',
  CHASE_STOPPED:       'chase-stopped',
  CHASE_MODE_CHANGED:  'chase-mode-changed',
  PET_POKED:           'pet-poked',
  PET_BORED:           'pet-bored',
  PET_CAUGHT_CURSOR:   'pet-caught-cursor',
  PET_DRAGGED:         'pet-dragged',
  PET_MOOD_CHANGED:    'pet-mood-changed',
});

function createPetActivity(activityType, details = {}) {
  const descriptions = {
    [PET_ACTIVITY_TYPES.CHASE_STARTED]:      'started chasing the cursor',
    [PET_ACTIVITY_TYPES.CHASE_STOPPED]:      'stopped chasing the cursor',
    [PET_ACTIVITY_TYPES.CHASE_MODE_CHANGED]: `entered ${details.mode || 'unknown'} mode`,
    [PET_ACTIVITY_TYPES.PET_POKED]:          'was poked by the user',
    [PET_ACTIVITY_TYPES.PET_BORED]:          'is bored (idle too long)',
    [PET_ACTIVITY_TYPES.PET_CAUGHT_CURSOR]:  'caught up to the cursor',
    [PET_ACTIVITY_TYPES.PET_DRAGGED]:        'was dragged by the user',
    [PET_ACTIVITY_TYPES.PET_MOOD_CHANGED]:   `mood changed to ${details.mood || 'unknown'}`,
  };

  return {
    type: activityType,
    description: descriptions[activityType] || activityType,
    details,
    timestamp: Date.now(),
  };
}

module.exports = {
  stripTtsPauseMarkers,
  estimateLyricDuration,
  createUserMessageEvent,
  createAssistantMessageEvent,
  PET_ACTIVITY_TYPES,
  createPetActivity,
};