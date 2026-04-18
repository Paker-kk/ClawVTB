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

module.exports = {
  stripTtsPauseMarkers,
  estimateLyricDuration,
  createUserMessageEvent,
  createAssistantMessageEvent
};