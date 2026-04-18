# BACAT VRM Agent Embodiment Plan

## 这份文档解决什么问题

把当前连续多轮讨论收敛成一份可执行计划，回答五个问题：

1. 我们现在到底在做什么产品
2. 这件事准备怎么实现
3. 准备用哪些开源项目、技术和组件
4. 这套方案怎么和当前 KKClaw / ClawVTB 原项目结合
5. 还有哪些困难必须正面解决

这份文档不是宣传文案，也不是空泛蓝图，而是后续实现与取舍的工作底稿。

## 当前讨论结果

### 一句话定义

BACAT 是一个把 Claude Code、Codex 这类代理具身化到桌面的 VRM 执行前台。

它不是只陪你聊天的桌宠，而是把真实电脑任务的授权、执行、风险和结果，转译成可见、可感知、可干预的桌面角色体验。

### 第一阶段对外承诺

第一阶段不应该对外承诺“任何 VRM 零调整都稳定”。

现实可交付承诺应收敛为：

- 用户可以导入自己的 VRM
- 导入后经过一步校准即可稳定开玩
- BACAT 会以桌面角色的形式展示代理执行过程
- 当前优先支持 OpenClaw 主链路，并逐步接入 Claude Code / Codex

### 第一阶段产品重点

当前优先级已经明确成以下顺序：

1. 先让 VRM 真正像桌宠，不只是 3D 模型
2. 先让执行过程可见，不只是回复文本可见
3. 先把审批、风险、状态变成一等交互
4. 再去做更重的多后端无缝切换和全桌面自动化

## 2026 外部样本带来的结论

### VRM / Avatar 产品侧结论

从 VMagicMirror、Animaze、Desktop Mate、ChatVRM、LocalChatVRM 这些样本看，2026 仍然成立的规律是：

- 真正被用户感知的价值，不是“能导入模型”，而是“导入后不翻车”
- 真正的桌宠体验，不是“会说”，而是“会活着”
- 真正的低门槛，不是没有设置，而是只有一步必要校准
- 真正的常驻体验，依赖透明窗口、拖拽、自动启动、恢复机制、低打扰反馈

其中最值得直接吸收的经验是：

- VMagicMirror：透明窗口、拖拽、启动自恢复、模型校准、位置重置、口型与表情配置
- Desktop Mate：桌面角色存在感、鼠标互动、窗口环境中的轻反应、低打扰陪伴
- ChatVRM / LocalChatVRM：three-vrm 路线仍然是 Web / Electron 中最稳的 VRM 运行时主轴

### 代理执行产品侧结论

从 Claude Code、GitHub Copilot、Codex 的 2026 公开信息看，代理产品的共同点已经不是“回答问题”，而是：

- 计划
- 执行
- 权限控制
- 风险边界
- 会话可见性
- 审阅与回滚

这意味着 BACAT 如果要做“代理化身”，不能只消费聊天事件，必须消费任务生命周期事件。

## 当前仓库已经具备的基础

### 已经存在的可复用部分

1. Electron 桌面宿主
   - 主窗口、歌词窗口、托盘、IPC、截图、通知都已存在

2. 原球体桌宠生命感系统
   - 旧版球体已经有情绪状态机、待机微表情、随机动作、桌面存在感

3. VRM 原型运行时
   - 已有 three.js + @pixiv/three-vrm 基础加载链
   - 已支持导入自定义 VRM、看向鼠标、基础 mood、伪口型

4. 统一后端目录层
   - 已有 backend-manager.js
   - 已有 surface routing 初步骨架
   - 已能探测 OpenClaw、Claude Code、Codex、VS Code Copilot

5. Setup Wizard
   - 已经具备新手向导、环境预检、OpenClaw 安装、Copilot/Codex 检测、VRM 选择

6. 语音与歌词链路
   - smart-voice.js、歌词窗口、桌面通知、截图链路都已经联通

### 当前最核心的结构缺口

当前代码里已经有“多后端蓝图”，但还没有真正进入“代理执行语义”。

具体表现为：

- 当前统一事件协议主要只正式覆盖 user-message / assistant-message
- task-progress / task-complete / task-error 还没有成为桌宠主协议的一等事件
- VRM 当前能说、能看、能呼吸，但还不像“代理的化身”
- Claude Code / Codex / Copilot 目前仍然大多是 detected-only，不是 integrated

## 推荐实现路线

## Phase 0: 明确产品边界

这一阶段不改功能，先统一对外和对内说法。

### 对外说法

建议对外使用：

BACAT 是一个可导入 VRM 的桌面代理搭档，它会把 AI 的思考与执行过程变成有存在感的桌面反应。

### 对内说法

对内要更准确：

- BACAT 不是普通桌宠
- BACAT 不是纯聊天壳
- BACAT 是代理执行前台 + VRM embodied shell + 原项目桌面运维外壳

### 第一阶段非目标

第一阶段明确不做：

- VS Code Copilot 全量桥接
- 真正意义上的“任何 VRM 零调整”
- 音频级真实 viseme 驱动
- 全桌面高权限自动化默认开启
- 复杂面捕和手势系统

## Phase 1: 让 VRM 先达到“桌宠及格线”

这是第一阶段最重要的落地点。

### 目标

让 VRM 至少达到原球体的桌宠及格线：

- 有待机生命感
- 有桌面存在感
- 有导入后保底稳定性
- 有基础操作反馈

### 需要新增的能力

1. VRM 安全归一化
   - 导入时自动做尺寸归一化
   - 自动做初始站姿与根节点偏移修正
   - 自动做视线目标与相机 framing 修正
   - 自动检查常用表情键是否缺失，建立 fallback 映射

2. 一步校准流程
   - 不是让用户打开十几个设置页
   - 只保留一页必要校准：尺寸、视线、嘴型强度、默认站位
   - 提供“恢复安全姿态”按钮

3. VRM 待机生命感
   - 把旧球体里的待机概念迁移成 VRM 可执行版本
   - 先做轻量级版本：眨眼、呼吸、头部轻偏移、注视、轻微 body sway、poke 反馈
   - 不急着上重动作库

4. 桌面操作反馈
   - 拖拽反馈
   - 鼠标接近反应
   - 截图成功 / 失败反应
   - 模型切换反应
   - 连接成功 / 失败反应

### 与现有项目结合点

- vrm-runtime.js：继续承担导入、归一化、基础动画、表情 fallback
- index-vrm.js：承担桌宠层交互、一页式校准入口、状态反馈
- index.html：保留为 legacy fallback，不立即删除
- pet-config.js：新增 VRM 校准参数持久化
- setup-wizard.js：在导入 VRM 后加入一步校准或校准提示

## Phase 2: 升级事件协议，进入“代理执行语义”

这是 BACAT 与普通聊天壳拉开差距的关键阶段。

### 目标

把桌宠主语义从“聊天事件”升级为“任务生命周期事件”。

### 协议最小集

第一阶段建议把以下事件真正实现为一等公民：

- user-message
- assistant-message
- backend-status
- approval-request
- approval-result
- task-start
- task-progress
- task-complete
- task-error
- task-rollback
- voice-request
- lyric-request

### 为什么 approval-request 必须进入协议层

因为用户已经明确想让 BACAT 接近全桌面代理，而不是只做工作区内聊天。

这意味着：

- 审批不再是终端里一段文字
- 审批必须成为桌宠前台能理解、能表达、能引导的事件
- 但最终安全边界不能只在角色层，要保留系统级保护

### 与现有项目结合点

- desktop-event-protocol.js：扩展为任务生命周期协议工厂
- main.js：dispatchDesktopEvent 改成真正理解 task-* 和 approval-* 事件
- lyricsWindow：只消费可朗读的 summary，不直接消费全部细粒度事件
- smart-voice.js：只播报用户真正需要感知的节点，不播报低价值日志

## Phase 3: 把 OpenClaw 正式适配器化

### 目标

把当前“OpenClaw 直连主链路”抽成正式 Adapter，作为后续 Claude / Codex 的模板。

### 原因

如果不先把现有主链路 adapter 化，后面接 Claude Code / Codex 只会继续复制分发逻辑。

### 要做的事

1. 新增 OpenClaw Adapter
   - 输入：用户消息 / 控制请求
   - 输出：assistant-message / backend-status / task-progress / task-error 等统一事件

2. 让 backend-send 不再只是 sendMessage 包装器
   - 改成走适配器能力声明

3. 为后续 CLI 型后端统一出接口
   - send
   - observe
   - cancel
   - getSessionState
   - normalizeRisk

### 与现有项目结合点

- backend-manager.js：从 catalog 层进入 adapter registry
- openclaw-client.js：收敛为 OpenClaw Adapter 的 transport 层
- main.js：不再直接假设某条后端一定是聊天接口

## Phase 4: 接入 Claude Code 与 Codex 的最小执行桥

### 推荐顺序

1. Claude Code
2. Codex CLI
3. 最后再评估 VS Code Copilot

### Claude Code 最小桥接方案

优先使用其公开的 CLI / hooks / permissions / settings 体系，做一个“事件观察 + 执行转译”桥。

重点不是复刻 Claude Code UI，而是吸收它的这些原则：

- 权限分级
- hook 事件
- 沙箱边界
- auto mode / deny 记录
- 可审计的执行痕迹

### Codex 最小桥接方案

优先使用 OpenAI 开源的 Codex CLI。

它已经明确了这些表面：

- 本地 CLI
- IDE 接入
- App
- Web

在 BACAT 里，第一阶段只碰 CLI 表面。

### 为什么 VS Code Copilot 放最后

Copilot 是编辑器宿主里的 agent orchestration layer。

如果太早接它，你会很快撞上：

- 会话归属不清
- 审批边界混乱
- 扩展桥接复杂
- 用户不知道到底是谁在做事

## Phase 5: 扩展为“桌面代理搭档”，而不是“聊天模型外壳”

这一阶段才进入更重的执行自动化。

### MVP 推荐控制边界

虽然用户目标最终接近全桌面代理，但工程上不建议第一轮直接放开。

建议分层：

1. 第一层：工作区内
   - 读写项目文件
   - 跑命令
   - 浏览器验证
   - 截图与日志采集

2. 第二层：桌面常见动作
   - 打开指定应用
   - 聚焦窗口
   - 打开文件夹
   - 基础文件浏览

3. 第三层：更广义系统自动化
   - 跨应用深层操作
   - 系统设置变更
   - 高风险批量动作

第三层不应该作为第一阶段默认能力。

## 推荐技术与开源组件

### 继续沿用的主技术栈

1. Electron
   - 继续作为宿主层
   - 原项目已经有完整 IPC、托盘、窗口、截图和运维体系

2. three.js
   - 继续作为 3D 渲染底层

3. @pixiv/three-vrm
   - 继续作为 VRM 运行时主轴
   - 对当前 Electron / Web 架构最匹配

4. VRM / VRMA / UniVRM 生态
   - VRM 作为角色格式
   - VRMA 作为可复用轻动作资产格式
   - UniVRM 作为美术资产与动画处理参考生态

### 代理与执行相关组件

1. Claude Code
   - 不是作为库嵌入
   - 而是作为目标后端与权限模型参考

2. OpenAI Codex CLI
   - 当前公开的本地代理入口
   - 适合做 CLI adapter MVP

3. Playwright CLI / MCP
   - 2026 已明确面向 AI agents
   - 非常适合作为浏览器自动化层
   - 比起桌面全局 UI 自动化，更适合先做“可验证、可回放、可观察”的 MVP

4. PowerShell 7 / Windows PowerShell
   - 适合作为 Windows 常见桌面动作与系统脚本层
   - 与现有 Windows 用户场景天然兼容

### 不建议作为 MVP 主路线的组件

1. WinAppDriver
   - 虽然能做 Windows UI 自动化
   - 但公开 release 长期停留在较旧版本
   - 更像兼容性备用路线，不建议作为第一阶段主能力

2. 重型面捕 / 手势系统
   - 现在会显著抬高复杂度
   - 先不作为 MVP 主线

3. “任何模型零调整”的全自动黑箱适配
   - 工程代价极高
   - 不适合第一阶段承诺

## 与原项目结合方式

### 结合原则

不是推翻原项目重做，而是按“保留稳定主链路 + 增加 embodied agent 层”的方式升级。

### 模块结合图

1. 旧球体继续保留
   - 作为 legacy fallback
   - 也是 VRM 行为对齐的参考基线

2. VRM 页面作为新前台
   - index-vrm.html / index-vrm.js 继续承担 3D embodied shell

3. 主进程继续作为事件总线与安全边界
   - main.js 继续承担窗口、IPC、通知、语音、截图、路由

4. BackendManager 继续作为目录层
   - 但要进化成 adapter registry

5. Setup Wizard 继续作为小白入口
   - 增加 VRM 一步校准
   - 增加代理能力说明与风险说明

### 具体文件映射

- main.js
  - 升级统一协议分发
  - 加入 approval / task 生命周期事件广播

- desktop-event-protocol.js
  - 从聊天协议升级为代理执行协议

- backend-manager.js
  - 从 catalog 层升级到 adapter registry + capability router

- index-vrm.js
  - 增加审批卡片、执行状态提示、风险提示、一步校准入口

- vrm-runtime.js
  - 增加 VRM 归一化、表情 fallback、校准参数、更多桌宠级待机行为

- setup-wizard.js / setup-wizard.html
  - 增加 VRM 导入后一步校准
  - 增加对代理后端能力与风险的明确说明

- smart-voice.js
  - 从“读回复”升级为“读高价值事件 summary”

## 必须解决的困难

### 1. 聊天协议和代理协议不是一回事

当前项目大部分仍然是聊天语义。

如果不把协议升级为任务生命周期，BACAT 最终只能像“会说话的壳”，不像“会干活的代理”。

### 2. 审批体验与安全边界冲突

用户希望角色内审批为主，但真正安全的信任根不能只放在角色层。

这要求我们做双层设计：

- 角色层负责解释、引导、呈现人格
- 系统层负责真正的高风险确认与约束

### 3. VRM 资产差异极大

不同 VRM 在这些方面差异很大：

- 骨架比例
- 表情命名
- lookAt 行为
- spring bone 稳定性
- 贴图和材质性能

这决定了“一步校准”必须成为产品能力，而不是用户自己摸索。

### 4. 全桌面代理非常容易跨过危险边界

一旦涉及：

- 打开应用
- 操作外部窗口
- 读写工作区外文件
- 发起网络请求

就不能再沿用单纯聊天产品的默认信任模型。

### 5. 当前开发环境仍缺 Node / npm

本机当前无法直接运行 node 与 npm。

这意味着：

- 现在可以继续做代码接线、文档、协议设计
- 但 Electron 实机验证仍然受阻

后续要么补 Node 环境，要么在另一台可运行环境中验证。

## 推荐实施顺序

### 第一批

1. 扩展 desktop-event-protocol.js
2. 让 main.js 正式支持 approval / task 生命周期事件
3. 为 VRM 导入增加一步校准和安全回退
4. 把旧球体的桌宠级待机概念迁移到 VRM

### 第二批

1. 抽 OpenClaw Adapter
2. 让 backend-manager.js 进入 adapter registry 模式
3. 用真正 task-progress / task-error 驱动 VRM 和语音

### 第三批

1. 接 Claude Code 最小桥
2. 接 Codex CLI 最小桥
3. 先不碰 Copilot 全桥接

### 第四批

1. 引入浏览器自动化层
2. 再评估 Windows 桌面动作层
3. 最后才评估更接近全桌面代理的高权限动作

## 验收标准

第一阶段完成后，至少满足：

1. 用户导入任意常见 VRM 后，可以通过一步校准稳定开玩
2. BACAT 能把连接、思考、执行、失败、完成至少五类状态表达出来
3. 桌宠看到的不是只有聊天内容，还能看到任务进展摘要
4. OpenClaw 主链路仍然稳定，不因新结构而回归
5. 新手首次启动仍能在 5 分钟内完成“启动 + 导入 VRM + 发第一条消息”

## 最终建议

这件事的正确做法，不是把原项目“从球体替换成 VRM”这么简单。

正确做法是：

- 保留原项目成熟的桌面宿主与运维能力
- 让 VRM 先补齐桌宠生命感与导入稳定性
- 再把聊天事件升级为代理执行事件
- 最后让 Claude Code / Codex 真正成为 BACAT 可见、可控、可审批的后端

如果按这个顺序做，BACAT 才有机会从“桌宠 UI”进化成“代理执行前台”。