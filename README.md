# CodingPet - 程序员陪伴师 🐾

一个 VSCode 桌面宠物插件，内置多模态大模型（GPT-4o），以可爱的卡通形象陪伴你写代码、聊天、提醒休息。

![VSCode](https://img.shields.io/badge/VSCode-^1.85.0-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)
![Electron](https://img.shields.io/badge/Electron-28-blue)
![License](https://img.shields.io/badge/License-MIT-green)

---

## 功能概览

### 🐾 桌面宠物

- **独立悬浮窗**：宠物以透明无边框窗口悬浮在桌面上，始终置顶，不遮挡操作
- **鼠标拖拽移动**：拖拽宠物到屏幕任意位置，关闭后记忆位置
- **3 种内置角色**：萌妹、小猫、小狗，均为 Canvas 实时绘制的卡通形象
- **自定义角色**：支持上传本地图片作为宠物形象
- **表情动画**：6 种情绪状态（开心、担心、平静、生气、兴奋、思考），根据对话内容自动切换

### 💬 智能对话

- **多模态大模型**：基于 OpenAI GPT-4o，支持文本、语音、图像三种输入
- **代码上下文感知**：自动读取当前打开的文件、光标位置、最近修改、诊断信息，对话时无需手动粘贴代码
- **陪伴师人设**：温暖、幽默、专业的编程伙伴，不只是冷冰冰的 AI 助手
- **对话历史记忆**：跨会话保存聊天记录

### 🔊 语音系统

- **5 种内置语音包**：
  | 语音包 | 风格 | 微软语音引擎 |
  |--------|------|-------------|
  | 萌妹 | 甜美可爱 | 晓晓 (XiaoxiaoNeural) |
  | 御姐 | 成熟优雅 | 晓颜 (XiaoyanNeural) |
  | 台妹 | 温柔台湾腔 | 曉臻 (HsiaoChenNeural) |
  | 男烟嗓 | 低沉磁性 | 云希 (YunxiNeural) |
  | 男气泡音 | 活力青春 | 云健 (YunjianNeural) |
- **Edge TTS**：默认语音合成引擎，免费无需 API Key
- **Fish Speech 声纹克隆**：可选接入本地 Fish Speech 服务，上传一段参考音频即可克隆声纹
- **语音输入**：按住麦克风按钮录音，通过 OpenAI Whisper API 转文字

### 🤖 主动交互

- **代码编写提示**：监听你的代码变更，在合适的时机给出建议（潜在 bug、命名改进、逻辑疑问等）
- **久坐提醒**：记录连续编码时间，定时提醒你起来活动（默认 45 分钟，可自定义）
- **新闻播报**：定时获取 Hacker News 等科技新闻，由 AI 总结后播报
- **随机聊天**：偶尔问问你心情怎样、分享人生哲理、编程冷知识、趣味小故事

---

## 架构设计

```
┌─────────────────────────┐    WebSocket     ┌──────────────────────────┐
│   VSCode Extension Host │ ◄──(localhost)──► │  Electron Desktop Overlay│
│                         │                   │                          │
│  ├─ AI Service (GPT-4o) │                   │  ├─ Pet Canvas Renderer  │
│  ├─ Code Context Service│                   │  ├─ Chat Panel UI        │
│  ├─ TTS Manager         │                   │  ├─ Emotion Engine       │
│  ├─ Proactive Scheduler │                   │  ├─ Voice Input/Output   │
│  └─ WebSocket Server    │                   │  └─ WebSocket Client     │
└─────────────────────────┘                   └──────────────────────────┘
         │                                              │
         ▼                                              ▼
  ┌──────────────┐                              ┌──────────────┐
  │  OpenAI API  │                              │  Audio Player │
  │  Edge TTS    │                              │  (Web Audio)  │
  │  Fish Speech │                              └──────────────┘
  │  News RSS    │
  └──────────────┘
```

**通信方式**：VSCode 插件与桌面宠物窗口之间通过 WebSocket（localhost 随机端口）双向实时通信。

---

## 安装与使用

### 前置要求

- **Node.js** >= 18
- **VSCode** >= 1.85.0
- **OpenAI API Key**（用于 GPT-4o 对话和 Whisper 语音识别）

### 安装步骤

```bash
# 1. 克隆项目
git clone https://github.com/Facatt/CodingPet.git
cd CodingPet

# 2. 安装主插件依赖
npm install

# 3. 安装 Electron overlay 依赖
cd overlay
npm install
cd ..

# 4. 构建主插件
npm run build

# 5. 构建桌面宠物 overlay
node scripts/build-overlay.js
```

### 开发调试

```bash
# 方式一：在 VSCode 中按 F5 启动插件开发宿主机
# 方式二：使用 watch 模式
npm run watch        # 监听主插件源码变更
cd overlay && npm run dev  # 监听 overlay 源码变更
```

### 配置 API Key

插件启动后，通过以下任一方式配置：

1. **命令面板**：`Ctrl+Shift+P` → 输入 `CodingPet: 设置`
2. **VSCode 设置**：搜索 `codingpet` → 填写 `OpenAI API Key`
3. **settings.json**：
   ```json
   {
     "codingpet.openaiApiKey": "sk-your-key-here",
     "codingpet.openaiBaseUrl": "https://api.openai.com/v1"
   }
   ```

> 支持配置自定义 Base URL，可接入 OpenAI 代理或兼容 API。

---

## 命令列表

| 命令 | 说明 |
|------|------|
| `CodingPet: 启动陪伴师` | 启动桌面宠物 |
| `CodingPet: 关闭陪伴师` | 关闭桌面宠物 |
| `CodingPet: 打开聊天` | 打开聊天面板 |
| `CodingPet: 切换角色` | 选择萌妹/小猫/小狗/自定义 |
| `CodingPet: 切换语音包` | 选择语音风格 |
| `CodingPet: 设置` | 打开插件设置 |

---

## 配置项

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `codingpet.openaiApiKey` | string | `""` | OpenAI API Key |
| `codingpet.openaiBaseUrl` | string | `https://api.openai.com/v1` | API 地址（支持代理） |
| `codingpet.character` | enum | `cute-girl` | 角色：cute-girl / cat / dog / custom |
| `codingpet.voicePack` | enum | `cute-girl` | 语音包 |
| `codingpet.ttsProvider` | enum | `edge-tts` | TTS 引擎：edge-tts / fish-speech |
| `codingpet.fishSpeechUrl` | string | `http://localhost:8080` | Fish Speech 服务地址 |
| `codingpet.healthReminderInterval` | number | `45` | 久坐提醒间隔（分钟） |
| `codingpet.enableCodeTips` | boolean | `true` | 启用代码编写提示 |
| `codingpet.enableNewsBroadcast` | boolean | `true` | 启用新闻播报 |
| `codingpet.enableProactiveChat` | boolean | `true` | 启用主动聊天 |
| `codingpet.enableVoiceOutput` | boolean | `true` | 启用语音输出 |
| `codingpet.customCharacterPath` | string | `""` | 自定义角色图片路径 |
| `codingpet.customVoicePath` | string | `""` | 声纹参考音频路径 |

---

## 声纹克隆（可选）

如果想使用自定义声音，可以接入 [Fish Speech](https://github.com/fishaudio/fish-speech) 本地服务：

```bash
# 1. 安装 Fish Speech（参考官方文档）
# 2. 启动服务
python -m fish_speech.serve --listen 0.0.0.0:8080

# 3. 在 CodingPet 设置中配置
# codingpet.ttsProvider → fish-speech
# codingpet.fishSpeechUrl → http://localhost:8080
# codingpet.customVoicePath → 选择一段 5-10 秒的参考音频文件
```

---

## 项目结构

```
CodingPet/
├── package.json                 # VSCode 插件清单
├── tsconfig.json                # TypeScript 配置
├── webpack.config.js            # Webpack 打包配置
├── src/                         # 插件源码
│   ├── extension.ts             # 入口：激活/停用/事件绑定
│   ├── config.ts                # 配置管理
│   ├── core/
│   │   ├── ai-service.ts        # OpenAI GPT-4o 多模态调用
│   │   ├── code-context.ts      # 编辑器代码上下文提取
│   │   ├── conversation-manager.ts  # 对话历史管理
│   │   ├── emotion-analyzer.ts  # 情绪分析
│   │   └── prompt-builder.ts    # 系统提示词与情绪解析
│   ├── tts/
│   │   ├── tts-manager.ts       # TTS 调度（自动降级）
│   │   ├── edge-tts-provider.ts # Edge TTS 封装
│   │   └── fish-speech-provider.ts  # Fish Speech 封装
│   ├── proactive/
│   │   ├── scheduler.ts         # 主动交互统一调度
│   │   ├── code-watcher.ts      # 代码变更监听
│   │   ├── health-reminder.ts   # 久坐提醒
│   │   └── news-fetcher.ts      # 新闻获取
│   ├── ipc/
│   │   ├── ws-server.ts         # WebSocket 服务端
│   │   └── messages.ts          # IPC 消息类型定义
│   └── webview/
│       └── settings-panel.ts    # 设置面板
├── overlay/                     # Electron 桌面宠物
│   ├── main.ts                  # 主进程（透明窗口）
│   ├── preload.ts               # 预加载（IPC 桥接）
│   └── renderer/
│       ├── index.html           # 页面结构
│       ├── app.js               # 渲染逻辑（角色/聊天/语音/动画）
│       └── styles/              # CSS 样式
├── assets/                      # 静态资源
└── scripts/                     # 构建脚本
```

---

## 技术栈

| 组件 | 技术 |
|------|------|
| VSCode 插件 | TypeScript + Webpack |
| 桌面宠物窗口 | Electron（透明无边框置顶窗口） |
| 角色绘制 | HTML5 Canvas 2D 实时绘制 |
| 进程通信 | WebSocket (localhost) |
| AI 对话 | OpenAI GPT-4o |
| 语音识别 | OpenAI Whisper |
| 语音合成 | Edge TTS (node-edge-tts) + Fish Speech |
| 语音录入 | Web MediaRecorder API |
| 音频播放 | Web Audio API |

---

## 常见问题

**Q: 宠物窗口没有出现？**
> 确保 overlay 已构建（`node scripts/build-overlay.js`），且 `overlay/node_modules` 中安装了 Electron。

**Q: 提示 API Key 未配置？**
> 在 VSCode 设置中搜索 `codingpet.openaiApiKey` 填入你的 OpenAI Key。支持配置代理 Base URL。

**Q: Edge TTS 语音不工作？**
> Edge TTS 需要网络连接（调用微软在线服务）。如果网络受限，可以安装 Python 版 `pip install edge-tts` 作为 CLI 降级方案。

**Q: 如何关闭主动打扰功能？**
> 在设置中关闭对应开关：`codingpet.enableCodeTips`、`codingpet.enableNewsBroadcast`、`codingpet.enableProactiveChat`。

**Q: 支持哪些 OpenAI 兼容 API？**
> 任何兼容 OpenAI Chat Completions API 格式的服务均可使用，修改 `codingpet.openaiBaseUrl` 即可。

---

## License

MIT
