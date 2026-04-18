const EventEmitter = require('events');
const backendTooling = require('./utils/backend-tooling');

const BACKEND_IDS = Object.freeze({
  OPENCLAW: 'openclaw',
  CLAUDE_CODE: 'claude-code',
  CODEX_CLI: 'codex-cli',
  VSCODE_COPILOT: 'vscode-copilot'
});

const INTEGRATED_LEVELS = new Set(['native', 'adapter']);

const DEFAULT_ROUTING = Object.freeze({
  strategy: 'current-surface',
  fallbackBackendId: BACKEND_IDS.OPENCLAW,
  surfaceBindings: Object.freeze({
    'desktop-pet': BACKEND_IDS.OPENCLAW,
    desktop: BACKEND_IDS.OPENCLAW,
    gateway: BACKEND_IDS.OPENCLAW,
    terminal: BACKEND_IDS.CLAUDE_CODE,
    vscode: BACKEND_IDS.VSCODE_COPILOT,
    web: BACKEND_IDS.CLAUDE_CODE
  })
});

const SURFACE_ALIASES = Object.freeze({
  pet: 'desktop-pet',
  avatar: 'desktop-pet',
  desktop: 'desktop',
  'desktop-pet': 'desktop-pet',
  gateway: 'gateway',
  terminal: 'terminal',
  cli: 'terminal',
  shell: 'terminal',
  vscode: 'vscode',
  editor: 'vscode',
  ide: 'vscode',
  web: 'web',
  browser: 'web'
});

class BackendManager extends EventEmitter {
  constructor({ petConfig, openclawClient, homeDir }) {
    super();
    this.petConfig = petConfig;
    this.openclawClient = openclawClient;
    this.homeDir = homeDir || process.env.HOME || process.env.USERPROFILE || process.cwd();
  }

  getKnownBackendIds() {
    return Object.values(BACKEND_IDS);
  }

  getActiveBackendId() {
    const saved = this.petConfig?.get('activeBackendId');
    return this.getKnownBackendIds().includes(saved) ? saved : BACKEND_IDS.OPENCLAW;
  }

  getRoutingConfig() {
    const saved = this.petConfig?.get('backendRouting') || {};
    const fallbackBackendId = this.getKnownBackendIds().includes(saved.fallbackBackendId)
      ? saved.fallbackBackendId
      : this.getActiveBackendId();

    return {
      strategy: saved.strategy || DEFAULT_ROUTING.strategy,
      fallbackBackendId,
      surfaceBindings: {
        ...DEFAULT_ROUTING.surfaceBindings,
        ...(saved.surfaceBindings || {})
      }
    };
  }

  normalizeSurface(surface) {
    if (!surface) return 'desktop-pet';
    const normalized = String(surface).trim().toLowerCase();
    return SURFACE_ALIASES[normalized] || normalized;
  }

  _saveRoutingConfig(routing) {
    this.petConfig.set('backendRouting', routing);
    return routing;
  }

  async setActiveBackend(backendId, options = {}) {
    if (!this.getKnownBackendIds().includes(backendId)) {
      return { success: false, error: 'unknown_backend', backendId };
    }

    const routing = this.getRoutingConfig();
    const surface = options?.surface ? this.normalizeSurface(options.surface) : null;

    if (surface) {
      routing.surfaceBindings[surface] = backendId;
    } else {
      this.petConfig.set('activeBackendId', backendId);
      routing.fallbackBackendId = backendId;
    }

    this._saveRoutingConfig(routing);

    const status = await this.getActiveBackendStatus({ surface });
    this.emit('backend-changed', status);
    return { success: true, ...status };
  }

  _createCatalog(activeBackendId, tooling, openclawConnected) {
    return [
      {
        id: BACKEND_IDS.OPENCLAW,
        label: 'OpenClaw Gateway',
        provider: 'OpenClaw',
        category: 'gateway',
        integrationLevel: 'native',
        isActive: activeBackendId === BACKEND_IDS.OPENCLAW,
        available: true,
        connected: openclawConnected,
        launchSurface: ['desktop-pet', 'gateway'],
        capabilities: ['chat', 'voice', 'lyrics', 'desktop-notify'],
        note: '当前桌宠主链路'
      },
      {
        id: BACKEND_IDS.CLAUDE_CODE,
        label: 'Claude Code',
        provider: 'Anthropic',
        category: 'cli-agent',
        integrationLevel: 'detected',
        isActive: activeBackendId === BACKEND_IDS.CLAUDE_CODE,
        available: tooling.claudeCode.ok,
        connected: null,
        launchSurface: ['terminal', 'vscode', 'desktop', 'web'],
        capabilities: ['coding', 'cli', 'mcp', 'hooks', 'memory'],
        path: tooling.claudeCode.path,
        version: tooling.claudeCode.version,
        note: tooling.claudeCode.ok ? '已检测到 CLI，尚未接入桌宠消息总线' : tooling.claudeCode.error
      },
      {
        id: BACKEND_IDS.CODEX_CLI,
        label: 'Codex CLI',
        provider: 'OpenAI',
        category: 'cli-agent',
        integrationLevel: 'detected',
        isActive: activeBackendId === BACKEND_IDS.CODEX_CLI,
        available: tooling.codex.ok,
        connected: null,
        launchSurface: ['terminal', 'vscode'],
        capabilities: ['coding', 'cli', 'local-agent'],
        path: tooling.codex.path,
        version: tooling.codex.version,
        note: tooling.codex.ok ? '已检测到 CLI，尚未接入桌宠消息总线' : tooling.codex.error
      },
      {
        id: BACKEND_IDS.VSCODE_COPILOT,
        label: 'VS Code Copilot',
        provider: 'GitHub',
        category: 'editor-agent',
        integrationLevel: 'detected',
        isActive: activeBackendId === BACKEND_IDS.VSCODE_COPILOT,
        available: Boolean(tooling.vscode.ok && tooling.copilot.ok),
        connected: null,
        launchSurface: ['vscode', 'cloud'],
        capabilities: ['editor-agent', 'third-party-agent', 'mcp', 'background-agent'],
        path: tooling.vscode.path,
        note: tooling.vscode.ok && tooling.copilot.ok
          ? '已检测到 VS Code 与 Copilot，尚未接入桌宠消息总线'
          : tooling.vscode.ok
            ? tooling.copilot.error
            : tooling.vscode.error
      }
    ].map((backend) => ({
      ...backend,
      routeEligible: backend.available && INTEGRATED_LEVELS.has(backend.integrationLevel)
    }));
  }

  _resolveRoute(catalog, context = {}) {
    const routing = this.getRoutingConfig();
    const surface = this.normalizeSurface(context.surface);
    const requestedBackendId = this.getKnownBackendIds().includes(context.backendId)
      ? context.backendId
      : null;
    const preferredBackendId = requestedBackendId
      || routing.surfaceBindings[surface]
      || routing.fallbackBackendId
      || this.getActiveBackendId();
    const fallbackBackendId = routing.fallbackBackendId || this.getActiveBackendId();

    const preferredBackend = catalog.find((backend) => backend.id === preferredBackendId) || null;
    const fallbackBackend = catalog.find((backend) => backend.id === fallbackBackendId) || null;
    const firstEligibleBackend = catalog.find((backend) => backend.routeEligible) || null;

    let resolvedBackend = null;
    let resolutionSource = 'unresolved';

    if (preferredBackend?.routeEligible) {
      resolvedBackend = preferredBackend;
      resolutionSource = requestedBackendId ? 'manual-request' : 'surface-binding';
    } else if (fallbackBackend?.routeEligible) {
      resolvedBackend = fallbackBackend;
      resolutionSource = 'fallback-backend';
    } else if (firstEligibleBackend) {
      resolvedBackend = firstEligibleBackend;
      resolutionSource = 'first-eligible';
    } else {
      resolvedBackend = preferredBackend || fallbackBackend || catalog[0] || null;
      resolutionSource = 'catalog-default';
    }

    return {
      surface,
      strategy: routing.strategy,
      requestedBackendId,
      preferredBackendId,
      fallbackBackendId,
      resolvedBackendId: resolvedBackend?.id || null,
      resolvedLabel: resolvedBackend?.label || '',
      fallbackApplied: Boolean(resolvedBackend && preferredBackendId && resolvedBackend.id !== preferredBackendId),
      resolutionSource
    };
  }

  async getCatalog(context = {}) {
    const tooling = await backendTooling.getToolingStatus(this.homeDir);
    const activeBackendId = this.getActiveBackendId();
    const openclawConnected = await this.openclawClient.checkConnection().catch(() => false);
    const catalog = this._createCatalog(activeBackendId, tooling, openclawConnected);
    const route = this._resolveRoute(catalog, context);

    return catalog.map((backend) => ({
      ...backend,
      isPreferredForSurface: backend.id === route.preferredBackendId,
      isResolvedForSurface: backend.id === route.resolvedBackendId,
      route
    }));
  }

  async getActiveBackendStatus(context = {}) {
    const tooling = await backendTooling.getToolingStatus(this.homeDir);
    const activeBackendId = this.getActiveBackendId();
    const openclawConnected = await this.openclawClient.checkConnection().catch(() => false);
    const catalog = this._createCatalog(activeBackendId, tooling, openclawConnected);
    const route = this._resolveRoute(catalog, context);
    const resolvedBackend = catalog.find((backend) => backend.id === route.resolvedBackendId) || catalog[0] || null;

    if (!resolvedBackend) {
      return null;
    }

    return {
      ...resolvedBackend,
      route,
      personaLabel: 'BACAT',
      routeNote: route.fallbackApplied
        ? `${route.surface} 当前已回退到 ${resolvedBackend.label}`
        : `${route.surface} 当前路由到 ${resolvedBackend.label}`
    };
  }

  async sendViaActiveBackend(message, context = {}) {
    const status = await this.getActiveBackendStatus(context);
    const activeBackendId = status?.id || this.getActiveBackendId();

    if (activeBackendId === BACKEND_IDS.OPENCLAW) {
      const reply = await this.openclawClient.sendMessage(message);
      const failed = typeof reply === 'string' && /请求失败|连接失败|错误/.test(reply);

      return {
        success: !failed,
        backendId: activeBackendId,
        backendLabel: status?.label || 'OpenClaw Gateway',
        response: reply,
        error: failed ? reply : null,
        route: status?.route || null
      };
    }

    return {
      success: false,
      backendId: activeBackendId,
      backendLabel: status?.label || activeBackendId,
      error: 'backend_not_integrated',
      message: '该后端已纳入目录，但当前版本尚未接入桌宠消息总线',
      route: status?.route || null
    };
  }
}

BackendManager.BACKEND_IDS = BACKEND_IDS;

module.exports = BackendManager;