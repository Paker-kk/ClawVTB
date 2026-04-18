# PRD: VRM 透明桌宠模式

> 版本: v1.1 | 日期: 2026-04-18
> 决策背景: Dario/Sam 辩论结果 + 用户确认

## 1. 目标

将 VRM 3D 角色从"面板内嵌"模式改为**透明桌宠模式**，实现与球体版本相同的桌面体验：

- 透明背景，角色直接浮在桌面上
- 可拖拽移动、鼠标滚轮缩放
- 单击 = 宠物交互（摸头、表情反应）
- 双击 = 弹出功能菜单
- 无可见 UI 框架/面板/工具栏

## 2. 竞品参考

| 项目 | 技术栈 | 透明方案 | 交互 |
|------|--------|----------|------|
| Mate-Engine | Unity/ShaderLab | DirectX native | 右键菜单 + 拖拽 |
| desktop-homunculus | Bevy/Rust | wgpu native | 类似 |
| clawd-on-desk | Electron/SVG | transparent BrowserWindow | 点击/拖拽 |
| KKClaw 球体版 | Electron/CSS | transparent + no WebGL | 拖拽 + tray |

## 3. 技术方案

### 3.1 渲染层 (vrm-runtime.js)
- `WebGLRenderer({ alpha: true, premultipliedAlpha: false, antialias: true })`
- `renderer.setClearColor(0x000000, 0)` — 透明清除色
- 30fps 帧率限制（`requestAnimationFrame` + delta 节流）
- 场景无背景色 (`scene.background = null`)

### 3.2 窗口层 (main.js)
- `transparent: true` (已有)
- `frame: false` (已有)
- 初始尺寸: 300x400（比球体版大，适配 VRM 全身）
- `resizable: false`（缩放由滚轮控制，不走窗口 resize）
- 滚轮缩放时通过 IPC 调用 `mainWindow.setSize(w, h)` + 3D camera 联动

### 3.3 页面层 (index-vrm.html)
- 移除所有面板 UI（工具栏、标题、连接状态、提示文本）
- body/html `background: transparent`
- canvas 铺满窗口 100vw × 100vh
- 无 scrollbar、无文本选择

### 3.4 交互层 (index-vrm.js)
| 手势 | 动作 | 实现 |
|------|------|------|
| 单击 | 宠物交互（摸头/表情变化） | 200ms timer 区分双击 |
| 双击 | 弹出功能菜单 | IPC → 主进程弹出 Menu |
| 拖拽 | 移动窗口位置 | mousedown+move → IPC `window-drag` |
| 滚轮 | 缩放角色 | IPC → `setSize()` + camera zoom |
| Shift+滚轮 | 旋转角色 Y 轴 | adjustModelRotation → IPC `pet-rotate` → 自动持久化 |

### 3.5 双击菜单内容
- 💬 聊天（弹出输入框）
- 📷 截图
- 🎙️ 语音开关
- 🔄 切换模型
- 📁 导入 VRM
- ↩️ 切回球体模式
- ⚙️ 设置向导
- ❌ 退出

## 4. 不做的事

- 不改变后端系统（OpenClaw、TTS、Gateway 等）
- 不引入新的渲染引擎（保持 three.js + @pixiv/three-vrm）
- 不改变球体版本（index.html 保持不变）
- 不在本阶段实现窗口坐立/任务栏坐立（Mate-Engine 级特性，后续迭代）

## 5. 风险

| 风险 | 缓解 |
|------|------|
| GPU stall (ReadPixels) | 30fps 限制 + 简化后处理 |
| 透明窗口拖拽冲突 | IPC 窗口拖拽，不用 CSS app-region |
| 滚轮缩放跳跃 | 平滑 lerp + 最小/最大尺寸约束 |

## 6. 特性迁移状态 (球体版 → VRM)

| 特性 | 状态 | 说明 |
|------|------|------|
| Step 1: 生命感层 | ✅ | 5 种眨眼变体、深呼吸(20-40s)、脊椎摇摆、眼神游走、微动 |
| Step 2: 38 表情迁移 | ✅ | VRM_EXPR 38 映射 + 12 IDLE_ACTIONS 动作池 + 动态混合系统 |
| Step 3: 14 Mood 映射 | ✅ | EMOTION_MOOD_MAP 扩展 + MOOD_PRESETS 18 项 + rimLight 数据驱动 |
| Step 4: 无聊递进系统 | ✅ | 1min 叹气/张望/歪头，3min 打哈欠/伸懒腰/发呆 |
| 模型朝向修正 | ✅ | 删除多余 Math.PI，遵循 VRM 1.0 标准方向 |
| 模型旋转控制 | ✅ | Shift+滚轮旋转 Y 轴，角度持久化至 pet-config.json |

## 7. 技术细节 — 模型旋转控制

**问题**: VRM 加载后多加了 `Math.PI` 翻转，导致所有模型背面朝用户。

**根因分析**:
- VRM 1.0 标准: 模型面朝 -Z（camera 从 +Z 看去天然正面）
- `VRMUtils.rotateVRM0()` 已处理 0.x→1.0 兼容
- 额外的 `rotation.y += Math.PI` 导致二次翻转

**修复方案**:
1. 删除 `vrm.scene.rotation.y += Math.PI`，改为 `= this.modelBaseRotationY`
2. `modelBaseRotationY` 默认 0，从 pet-config.json 加载保存值
3. Shift+滚轮 → `adjustModelRotation(±0.1 rad)` → IPC `pet-rotate` → 自动存盘
4. 修复 sway 累积 bug：`rotation.y = base + sway`（原来是 `+= sway` 导致漂移）
