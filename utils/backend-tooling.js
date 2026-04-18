const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

function getVsCodeCliCandidates(homeDir) {
  const localAppData = process.env.LOCALAPPDATA || path.join(homeDir, 'AppData', 'Local');
  const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

  return [
    path.join(localAppData, 'Programs', 'Microsoft VS Code', 'bin', 'code.cmd'),
    path.join(localAppData, 'Programs', 'Microsoft VS Code Insiders', 'bin', 'code-insiders.cmd'),
    path.join(programFiles, 'Microsoft VS Code', 'bin', 'code.cmd'),
    path.join(programFilesX86, 'Microsoft VS Code', 'bin', 'code.cmd')
  ];
}

async function findCommand(names, fallbackPaths = []) {
  const locator = process.platform === 'win32' ? 'where' : 'which';

  for (const name of names) {
    try {
      const { stdout } = await execAsync(`${locator} ${name}`, { windowsHide: true, timeout: 5000 });
      const found = stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line && fs.existsSync(line));

      if (found) {
        return path.normalize(found);
      }
    } catch {
      // ignore and continue
    }
  }

  const fallback = fallbackPaths.find((candidate) => fs.existsSync(candidate));
  return fallback ? path.normalize(fallback) : '';
}

function detectCopilotExtensions(homeDir) {
  const extensionDirs = [
    path.join(homeDir, '.vscode', 'extensions'),
    path.join(homeDir, '.vscode-insiders', 'extensions')
  ];

  let hasCopilot = false;
  let hasCopilotChat = false;
  let hasCodexExtension = false;

  for (const dir of extensionDirs) {
    if (!fs.existsSync(dir)) continue;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const name = entry.name.toLowerCase();
      if (name.startsWith('github.copilot-')) hasCopilot = true;
      if (name.startsWith('github.copilot-chat-')) hasCopilotChat = true;
      if (name.startsWith('openai.chatgpt-')) hasCodexExtension = true;
    }
  }

  return {
    ok: hasCopilot && hasCopilotChat,
    hasCopilot,
    hasCopilotChat,
    hasCodexExtension
  };
}

async function readCommandVersion(commandPath) {
  if (!commandPath) return '';

  try {
    const { stdout, stderr } = await execAsync(`"${commandPath}" --version`, {
      windowsHide: true,
      timeout: 5000
    });

    return (stdout || stderr).trim().split(/\r?\n/)[0] || '';
  } catch {
    return '';
  }
}

async function getToolingStatus(homeDir) {
  const vscodePath = await findCommand(['code', 'code-insiders'], getVsCodeCliCandidates(homeDir));
  const codexPath = await findCommand(['codex']);
  const claudePath = await findCommand(['claude']);
  const copilot = detectCopilotExtensions(homeDir);

  const [codexVersion, claudeVersion] = await Promise.all([
    readCommandVersion(codexPath),
    readCommandVersion(claudePath)
  ]);

  return {
    vscode: {
      ok: Boolean(vscodePath),
      path: vscodePath,
      canInstallExtensions: Boolean(vscodePath),
      error: vscodePath ? '' : '未检测到 VS Code 命令行入口'
    },
    copilot: {
      ...copilot,
      error: copilot.ok ? '' : '未检测到 GitHub Copilot 与 Copilot Chat 扩展'
    },
    codex: {
      ok: Boolean(codexPath),
      path: codexPath,
      version: codexVersion,
      error: codexPath ? '' : '未检测到 Codex CLI'
    },
    claudeCode: {
      ok: Boolean(claudePath),
      path: claudePath,
      version: claudeVersion,
      error: claudePath ? '' : '未检测到 Claude Code CLI'
    }
  };
}

module.exports = {
  findCommand,
  getToolingStatus,
  detectCopilotExtensions,
  getVsCodeCliCandidates,
  readCommandVersion
};