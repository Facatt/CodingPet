import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ChildProcess, spawn } from 'child_process';
import { getConfig, onConfigChange, PetConfig } from './config';
import { WSServer } from './ipc/ws-server';
import { AIService } from './core/ai-service';
import { CodeContextService } from './core/code-context';
import { ConversationManager } from './core/conversation-manager';
import { EmotionAnalyzer } from './core/emotion-analyzer';
import { TTSManager } from './tts/tts-manager';
import { ProactiveScheduler } from './proactive/scheduler';
import { SettingsPanelProvider } from './webview/settings-panel';

let overlayProcess: ChildProcess | null = null;
let wsServer: WSServer;
let aiService: AIService;
let codeContextService: CodeContextService;
let conversationManager: ConversationManager;
let emotionAnalyzer: EmotionAnalyzer;
let ttsManager: TTSManager;
let proactiveScheduler: ProactiveScheduler;

export async function activate(context: vscode.ExtensionContext) {
  console.log('[CodingPet] Extension activating...');

  // 初始化服务
  conversationManager = new ConversationManager(context);
  aiService = new AIService(conversationManager);
  codeContextService = new CodeContextService();
  emotionAnalyzer = new EmotionAnalyzer();
  ttsManager = new TTSManager();
  wsServer = new WSServer();

  // 启动 WebSocket 服务器
  let wsPort: number;
  try {
    wsPort = await wsServer.start();
    console.log(`[CodingPet] WebSocket server started on port ${wsPort}`);
  } catch (error) {
    vscode.window.showErrorMessage(`CodingPet: WebSocket 服务启动失败 - ${error}`);
    return;
  }

  // 初始化主动交互调度器
  proactiveScheduler = new ProactiveScheduler(aiService, ttsManager, wsServer, codeContextService);

  // 处理来自 overlay 的消息
  wsServer.onMessage(async (msg) => {
    switch (msg.type) {
      case 'chat_request':
        await handleChatRequest(msg.text);
        break;
      case 'voice_input':
        await handleVoiceInput(msg.audioData, msg.mimeType);
        break;
      case 'image_input':
        await handleImageInput(msg.imageData, msg.mimeType, msg.text);
        break;
      case 'overlay_ready':
        handleOverlayReady();
        break;
      case 'request_config':
        wsServer.send({
          type: 'config_update',
          config: getConfig(),
        });
        break;
    }
  });

  wsServer.onConnection(() => {
    console.log('[CodingPet] Overlay connected, sending initial config');
    wsServer.send({
      type: 'config_update',
      config: getConfig(),
    });
    wsServer.send({
      type: 'status',
      connected: true,
    });
  });

  wsServer.onDisconnection(() => {
    console.log('[CodingPet] Overlay disconnected');
  });

  // 启动 Electron overlay
  launchOverlay(context, wsPort);

  // 启动主动交互
  proactiveScheduler.start();

  // 注册命令
  context.subscriptions.push(
    vscode.commands.registerCommand('codingpet.activate', () => {
      if (!overlayProcess) {
        launchOverlay(context, wsPort);
        vscode.window.showInformationMessage('CodingPet: 陪伴师已启动！');
      } else {
        vscode.window.showInformationMessage('CodingPet: 陪伴师已经在运行了哦~');
      }
    }),

    vscode.commands.registerCommand('codingpet.deactivate', () => {
      if (overlayProcess) {
        overlayProcess.kill();
        overlayProcess = null;
        vscode.window.showInformationMessage('CodingPet: 陪伴师已关闭，下次见~');
      }
    }),

    vscode.commands.registerCommand('codingpet.openChat', () => {
      if (wsServer.isConnected()) {
        wsServer.send({ type: 'status', connected: true });
      } else {
        vscode.window.showWarningMessage('CodingPet: 陪伴师还没有启动，请先启动！');
      }
    }),

    vscode.commands.registerCommand('codingpet.changeCharacter', async () => {
      const choice = await vscode.window.showQuickPick(
        [
          { label: '🧑‍🦰 萌妹', value: 'cute-girl' },
          { label: '🐱 小猫', value: 'cat' },
          { label: '🐶 小狗', value: 'dog' },
          { label: '📁 自定义', value: 'custom' },
        ],
        { placeHolder: '选择陪伴师角色形象' }
      );

      if (choice) {
        const config = vscode.workspace.getConfiguration('codingpet');
        await config.update('character', choice.value, vscode.ConfigurationTarget.Global);
        wsServer.send({ type: 'change_character', character: choice.value as any });
      }
    }),

    vscode.commands.registerCommand('codingpet.changeVoice', async () => {
      const choice = await vscode.window.showQuickPick(
        [
          { label: '💕 萌妹', value: 'cute-girl' },
          { label: '👩 御姐', value: 'mature-woman' },
          { label: '🌸 台妹', value: 'taiwanese' },
          { label: '🎸 男烟嗓', value: 'male-smoky' },
          { label: '🫧 男气泡音', value: 'male-bubble' },
          { label: '🎤 自定义声纹', value: 'custom' },
        ],
        { placeHolder: '选择语音包' }
      );

      if (choice) {
        const config = vscode.workspace.getConfiguration('codingpet');
        await config.update('voicePack', choice.value, vscode.ConfigurationTarget.Global);
        wsServer.send({ type: 'change_voice', voice: choice.value as any });
      }
    }),

    vscode.commands.registerCommand('codingpet.settings', () => {
      vscode.commands.executeCommand('workbench.action.openSettings', 'codingpet');
    })
  );

  // 注册设置面板
  const settingsProvider = new SettingsPanelProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(SettingsPanelProvider.viewType, settingsProvider)
  );

  // 监听编辑器事件
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      codeContextService.recordChange(event);
      proactiveScheduler.recordActivity();
      proactiveScheduler.getCodeWatcher().recordChange(event);
    }),

    vscode.window.onDidChangeActiveTextEditor(() => {
      proactiveScheduler.recordActivity();
    }),

    vscode.window.onDidChangeTextEditorSelection(() => {
      proactiveScheduler.recordActivity();
    })
  );

  // 监听配置变更
  context.subscriptions.push(
    onConfigChange((newConfig) => {
      aiService.refreshClient();
      if (wsServer.isConnected()) {
        wsServer.send({
          type: 'config_update',
          config: newConfig,
        });
      }
    })
  );

  // 定期清理临时音频文件
  const cleanupTimer = setInterval(() => {
    ttsManager.cleanupOldFiles();
  }, 30 * 60 * 1000);

  context.subscriptions.push({
    dispose: () => clearInterval(cleanupTimer),
  });

  console.log('[CodingPet] Extension activated successfully!');
  vscode.window.showInformationMessage('CodingPet: 你的程序员陪伴师已就绪！ 🐾');
}

async function handleChatRequest(text: string): Promise<void> {
  const codeContext = codeContextService.buildContextPrompt();
  const aiResponse = await aiService.chat(text, codeContext);

  emotionAnalyzer.setEmotion(aiResponse.emotion);

  wsServer.send({
    type: 'chat_response',
    text: aiResponse.text,
    emotion: aiResponse.emotion,
  });

  if (aiResponse.shouldSpeak) {
    const ttsResult = await ttsManager.synthesize(aiResponse.text);
    if (ttsResult) {
      const audioBuffer = fs.readFileSync(ttsResult.audioPath);
      const audioBase64 = audioBuffer.toString('base64');
      wsServer.send({
        type: 'audio_data',
        audioBase64,
        mimeType: 'audio/mp3',
      });
    }
  }

  emotionAnalyzer.scheduleCalm(15000);
}

async function handleVoiceInput(audioData: string, mimeType: string): Promise<void> {
  try {
    const audioBuffer = Buffer.from(audioData, 'base64');
    const text = await aiService.transcribeAudio(audioBuffer, mimeType);

    if (text) {
      await handleChatRequest(text);
    } else {
      wsServer.send({
        type: 'chat_response',
        text: '没听清你说什么，再说一遍好吗？',
        emotion: 'thinking',
      });
    }
  } catch (error) {
    console.error('[CodingPet] Voice input processing error:', error);
    wsServer.send({
      type: 'chat_response',
      text: '语音识别出了点问题，试试文字输入吧~',
      emotion: 'worried',
    });
  }
}

async function handleImageInput(imageData: string, mimeType: string, text?: string): Promise<void> {
  const prompt = text || '请描述一下这张图片，如果是代码截图请分析其中的代码。';
  const codeContext = codeContextService.buildContextPrompt();

  const aiResponse = await aiService.chat(
    `[用户发送了一张图片] ${prompt}`,
    codeContext
  );

  emotionAnalyzer.setEmotion(aiResponse.emotion);

  wsServer.send({
    type: 'chat_response',
    text: aiResponse.text,
    emotion: aiResponse.emotion,
  });

  if (aiResponse.shouldSpeak) {
    const ttsResult = await ttsManager.synthesize(aiResponse.text);
    if (ttsResult) {
      const audioBuffer = fs.readFileSync(ttsResult.audioPath);
      const audioBase64 = audioBuffer.toString('base64');
      wsServer.send({
        type: 'audio_data',
        audioBase64,
        mimeType: 'audio/mp3',
      });
    }
  }
}

function handleOverlayReady(): void {
  console.log('[CodingPet] Overlay is ready');
  wsServer.send({
    type: 'config_update',
    config: getConfig(),
  });
}

function launchOverlay(context: vscode.ExtensionContext, wsPort: number): void {
  const overlayDir = path.join(context.extensionPath, 'overlay');
  const electronPath = getElectronPath(overlayDir);
  const mainScript = path.join(overlayDir, 'dist', 'main.js');

  if (!fs.existsSync(mainScript)) {
    const tsMainScript = path.join(overlayDir, 'main.ts');
    if (!fs.existsSync(tsMainScript)) {
      vscode.window.showErrorMessage('CodingPet: 桌面宠物程序未找到，请先构建 overlay');
      return;
    }
  }

  const scriptToRun = fs.existsSync(mainScript) ? mainScript : path.join(overlayDir, 'main.ts');

  try {
    overlayProcess = spawn(electronPath, [scriptToRun, `--ws-port=${wsPort}`], {
      cwd: overlayDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        CODINGPET_WS_PORT: wsPort.toString(),
        ELECTRON_NO_ATTACH_CONSOLE: '1',
      },
    });

    overlayProcess.stdout?.on('data', (data) => {
      console.log(`[CodingPet Overlay] ${data.toString().trim()}`);
    });

    overlayProcess.stderr?.on('data', (data) => {
      console.error(`[CodingPet Overlay Error] ${data.toString().trim()}`);
    });

    overlayProcess.on('exit', (code) => {
      console.log(`[CodingPet] Overlay process exited with code ${code}`);
      overlayProcess = null;
    });

    overlayProcess.on('error', (err) => {
      console.error('[CodingPet] Failed to launch overlay:', err);
      vscode.window.showErrorMessage(
        `CodingPet: 无法启动桌面宠物。请确保已安装 Electron: cd overlay && npm install`
      );
      overlayProcess = null;
    });

    console.log('[CodingPet] Overlay process launched');
  } catch (error) {
    console.error('[CodingPet] Overlay launch error:', error);
    vscode.window.showErrorMessage(`CodingPet: 启动桌面宠物失败 - ${error}`);
  }
}

function getElectronPath(overlayDir: string): string {
  const possiblePaths = [
    path.join(overlayDir, 'node_modules', '.bin', 'electron'),
    path.join(overlayDir, 'node_modules', '.bin', 'electron.cmd'),
    path.join(overlayDir, 'node_modules', 'electron', 'dist', 'electron.exe'),
    path.join(overlayDir, 'node_modules', 'electron', 'dist', 'electron'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  return process.platform === 'win32' ? 'electron.cmd' : 'electron';
}

export function deactivate() {
  console.log('[CodingPet] Extension deactivating...');

  proactiveScheduler?.stop();
  ttsManager?.dispose();
  wsServer?.stop();

  if (overlayProcess) {
    overlayProcess.kill();
    overlayProcess = null;
  }
}
