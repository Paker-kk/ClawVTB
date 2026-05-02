const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const main = read('main.js');
const preload = read('preload.js');
const vrm = read('index-vrm.js');
const vrmHtml = read('index-vrm.html');
const vrmRuntime = read('vrm-runtime.js');
const config = read('pet-config.js');
const pkg = JSON.parse(read('package.json'));

assert.ok(!fs.existsSync(path.join(root, 'index.html')), 'legacy sphere index.html should be removed');
assert.match(config, /avatarMode:\s*'vrm-prototype'/, 'default avatar mode should be VRM');
assert.doesNotMatch(main, /loadFile\(['"]index\.html['"]\)/, 'main process must not load legacy sphere');
assert.doesNotMatch(main, /AVATAR_MODES\.LEGACY|['"]legacy['"]/, 'legacy avatar mode should not remain in main process');
assert.doesNotMatch(`${main}\n${preload}\n${vrm}`, /avatar-set-mode|btnAvatarMode|switchToAvatarMode/, 'mode-switching API should be removed');
assert.match(main, /getMainWindowEntry\(\)[\s\S]*index-vrm\.html/, 'main process should always load the VRM entry');
assert.match(preload, /'pet-menu-action'/, 'VRM renderer should receive context menu actions');
assert.doesNotMatch(`${vrmHtml}\n${vrmRuntime}`, /https:\/\/cdn\.jsdelivr\.net/, 'VRM runtime should not depend on CDN for beta builds');
assert.ok(pkg.dependencies?.three, 'three should be packaged as a local dependency');
assert.ok(pkg.dependencies?.['@pixiv/three-vrm'], '@pixiv/three-vrm should be packaged as a local dependency');

for (const required of [
  'toggleInput',
  'toggleVoice',
  'cycleModel',
  'screenshot',
  'sendMessage',
  'show-history',
  'openclaw-status',
  'pet-menu-action',
  'avatar-select-vrm',
]) {
  assert.ok(vrm.includes(required), `index-vrm.js should include ${required}`);
}

console.log('vrm shell parity checks passed');
