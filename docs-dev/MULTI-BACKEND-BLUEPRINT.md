# 多后端统一架构蓝图

## 这份文档解决什么问题

当前项目已经具备一个桌宠外壳，但真正稳定的主链路仍然高度绑定 OpenClaw。

用户的新目标不是只让桌宠继续调一个 Gateway，而是让它逐步兼容：

- OpenClaw
- Claude Code
- Codex
- VS Code Copilot

问题不在于“多加几个按钮”，而在于这些产品在 2026 已经分成了完全不同的运行模型。

## 2026 官方信息带来的结论

### VS Code Copilot

官方文档已经把 agent 体系明确拆成：

- Local agent
- Copilot CLI
- Cloud agent
- Third-party agent
- MCP tools / servers

这意味着 Copilot 不再只是补全插件，而是一套会话管理和工具编排壳。

### OpenAI Codex

公开信息显示 Codex 至少存在两条主线：

- 本地终端 CLI
- VS Code 中的第三方 agent / IDE 接入

它既可以是终端里的本地 agent，也可以是 VS Code 会话中的 partner agent。

### Claude Code

Claude Code 官方已经明确是多表面统一引擎：

- Terminal
- VS Code
- Desktop
- Web
- MCP
- Hooks
- Agent teams

这说明 Claude Code 不是简单的命令行壳，而是一套以会话、记忆、MCP、hooks 为核心的 agent 平台。

## 首个必须承认的现实

这四个后端不是同一种东西：

- OpenClaw 更像独立 Gateway 服务
- Codex CLI 更像本地终端 agent
- Claude Code 更像跨表面的 agent runtime
- VS Code Copilot 更像编辑器宿主里的 agent orchestration layer

如果强行给它们套一层“统一 sendMessage() 就完了”的接口，后面一定返工。

## 当前代码库已经有什么

现有项目其实已经存在统一事件总线雏形：

- 用户消息事件
- agent 回复事件
- 歌词事件
- 语音播报事件
- 状态更新事件
- 桌面通知事件

当前的问题不是“没有事件模型”，而是：

- 入口被 OpenClaw 和桌面通知端口绑死
- 后端状态与 UI 状态没有彻底解耦
- 还没有后端目录和能力模型

## 推荐的统一抽象

### 第一层：Backend Catalog

只负责回答四个问题：

1. 有哪些后端
2. 它们各自是什么类别
3. 当前是否可用
4. 当前是否已接入桌宠消息总线

示例类别：

- gateway
- cli-agent
- editor-agent
- cloud-agent

### 第二层：Backend Capability Model

每个后端不只是一串名字，而要声明能力：

- chat
- coding
- voice-progress
- lyrics
- local-session
- cloud-session
- mcp
- hooks
- background-agent

这样 UI 和产品层才能知道：

- 这个后端适不适合桌宠常驻互动
- 这个后端更适合终端模式还是编辑器模式
- 这个后端能不能承载语音和歌词同步

### 第三层：Unified Event Bus

桌宠真正应该统一的不是“请求函数”，而是事件。

推荐最小事件集合：

- user-message
- assistant-message
- backend-status
- task-progress
- task-complete
- task-error
- voice-request
- lyric-request

桌宠只消费这些事件，不直接理解某个后端的私有协议。

### 第三点五层：Surface Routing

这轮产品决策已经明确：

- 前台始终只保留一个 BACAT 人格
- 自动路由优先按当前工作表面判断
- 首发 KPI 不是“功能最全”，而是 5 分钟开玩成功率

所以这里不能再只保留一个全局 activeBackendId。

最小可行方案应该是：

- desktop-pet 默认走 OpenClaw
- terminal 默认优先 Claude Code
- vscode 默认优先 VS Code Copilot
- 当目标表面后端尚未真正接入桌宠消息总线时，自动回退到全局 fallback backend

这样做的核心价值不是“显得更高级”，而是保证：

- 表面感知是对的
- BACAT 人格不分裂
- 新手第一次启动时不会因为未接通某个高级后端直接卡死

### 第四层：Backend Adapter

适配器负责把后端自己的协议翻译成统一事件。

例如：

- OpenClaw Adapter：HTTP / Gateway -> unified events
- Claude Code Adapter：CLI / hooks / session files -> unified events
- Codex Adapter：CLI / IDE session -> unified events
- VS Code Copilot Adapter：editor session / extension bridge / MCP -> unified events

## 当前阶段应该怎么落

### 已完成

- 新增共享工具探测模块
- 新增 BackendManager
- 新增 activeBackendId 作为全局回退位
- 新增按工作表面的 backendRouting 默认配置
- 主进程新增 backend catalog / status / set-active / send IPC

### 下一步不该急着做的

- 不要马上把现有 openclaw-send 全量替换成统一 backend-send
- 不要在还没定义清楚会话模型之前做 UI 级一键切换
- 不要承诺“Copilot / Codex / Claude Code 已经完全可当桌宠聊天内核”

### 下一步应该优先做的

1. 定义统一事件协议
2. 抽 OpenClaw Adapter 作为第一条正式适配器
3. 为 Claude Code 设计最小桥接方案
4. 为 Codex 设计最小桥接方案
5. 最后再碰 VS Code Copilot 桥接

## 为什么 VS Code Copilot 应该放最后

因为它最容易被误判。

Copilot 在 2026 已经很强，但它的自然宿主仍然是 VS Code 会话本身，而不是你的 Electron 进程。

如果要把它接到桌宠里，你大概率需要：

- VS Code extension bridge
- MCP or session observation layer
- 安全边界和权限解释

这比接 CLI 型后端更重。

## Dario 式硬问题

下面这些问题现在不答清楚，后面会直接返工：

### 交互问题

1. 桌宠到底是“统一聊天入口”，还是“多个 agent 的状态观测器”？
2. 当 Claude Code 和 Codex 同时在线时，用户是要选择一个主脑，还是让桌宠自动路由？
3. 用户看到的应该是“你正在跟 BACAT 说话”，还是“你正在驱动某个后端 agent”？

### 技术问题

1. 统一的是消息协议，还是统一的是任务协议？
2. CLI 型后端和编辑器型后端的会话 ID 怎么统一？
3. 谁来产出进度事件，谁来决定语音播报的颗粒度？

### 产品问题

1. 首批主卖点到底是陪伴感，还是 coding flow 的陪伴感？
2. 你卖的是“会说话的桌宠”，还是“多 agent 可视化壳”？
3. 如果用户根本不用 OpenClaw，只想拿 Copilot + Codex + Claude Code，你还要不要保留 Gateway 核心位？

### 市场问题

1. 目标用户是纯开发者，还是“想把 AI 做成宠物”的泛创作者？
2. 你要打的是下载即玩，还是高阶可定制？
3. 如果一句话介绍产品，你到底要用户记住哪句：

- 一个能换 VRM 身体的 AI 桌宠
- 一个会陪你 coding 的 agent companion
- 一个统一管理 Claude、Codex、Copilot、OpenClaw 的桌面代理壳

这三句不是一回事。

## 当前建议

短期定义建议收敛成一句：

BACAT 是一个会陪你 coding 的桌面 companion，支持 VRM 身体，并逐步接入多个 agent 后端。

这句话至少不会自相矛盾。