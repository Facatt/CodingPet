import * as vscode from 'vscode';
import { getConfig, CharacterType, VoicePackType } from '../config';

export class SettingsPanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'codingpet.settingsPanel';
  private _view?: vscode.WebviewView;

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getHtmlContent();

    webviewView.webview.onDidReceiveMessage(async (message) => {
      const wsConfig = vscode.workspace.getConfiguration('codingpet');
      switch (message.command) {
        case 'updateConfig':
          await wsConfig.update(message.key, message.value, vscode.ConfigurationTarget.Global);
          break;
        case 'selectFile': {
          const fileUri = await vscode.window.showOpenDialog({
            canSelectMany: false,
            filters: message.fileType === 'image'
              ? { 'Images': ['png', 'jpg', 'jpeg', 'gif', 'webp'] }
              : { 'Audio': ['wav', 'mp3', 'ogg', 'flac'] },
          });
          if (fileUri && fileUri[0]) {
            const configKey = message.fileType === 'image' ? 'customCharacterPath' : 'customVoicePath';
            await wsConfig.update(configKey, fileUri[0].fsPath, vscode.ConfigurationTarget.Global);
            webviewView.webview.postMessage({
              command: 'fileSelected',
              fileType: message.fileType,
              path: fileUri[0].fsPath,
            });
          }
          break;
        }
      }
    });
  }

  private getHtmlContent(): string {
    const config = getConfig();

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 12px;
      font-size: 13px;
    }
    .section { margin-bottom: 20px; }
    .section-title {
      font-weight: 600;
      font-size: 14px;
      margin-bottom: 8px;
      color: var(--vscode-textLink-foreground);
    }
    .field { margin-bottom: 12px; }
    .field label {
      display: block;
      margin-bottom: 4px;
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }
    select, input[type="text"], input[type="number"], input[type="password"] {
      width: 100%;
      padding: 6px 8px;
      border: 1px solid var(--vscode-input-border);
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border-radius: 4px;
      font-size: 13px;
      box-sizing: border-box;
    }
    .checkbox-field {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    .checkbox-field input { width: auto; }
    button {
      padding: 6px 14px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    }
    button:hover { background: var(--vscode-button-hoverBackground); }
    .file-path {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-top: 4px;
      word-break: break-all;
    }
  </style>
</head>
<body>
  <div class="section">
    <div class="section-title">\ud83d\udd11 API \u8bbe\u7f6e</div>
    <div class="field">
      <label>OpenAI API Key</label>
      <input type="password" id="apiKey" value="${config.openaiApiKey}" placeholder="sk-..." />
    </div>
    <div class="field">
      <label>OpenAI Base URL</label>
      <input type="text" id="baseUrl" value="${config.openaiBaseUrl}" />
    </div>
  </div>

  <div class="section">
    <div class="section-title">\ud83d\udc3e \u89d2\u8272\u8bbe\u7f6e</div>
    <div class="field">
      <label>\u89d2\u8272\u5f62\u8c61</label>
      <select id="character">
        <option value="cute-girl" ${config.character === 'cute-girl' ? 'selected' : ''}>\u840c\u59b9</option>
        <option value="cat" ${config.character === 'cat' ? 'selected' : ''}>\u5c0f\u732b</option>
        <option value="dog" ${config.character === 'dog' ? 'selected' : ''}>\u5c0f\u72d7</option>
        <option value="custom" ${config.character === 'custom' ? 'selected' : ''}>\u81ea\u5b9a\u4e49</option>
      </select>
    </div>
    <div class="field" id="customCharacterField" style="display:${config.character === 'custom' ? 'block' : 'none'}">
      <button onclick="selectFile('image')">${'\u4e0a\u4f20\u81ea\u5b9a\u4e49\u89d2\u8272\u56fe\u7247'}</button>
      <div class="file-path" id="customCharacterPath">${config.customCharacterPath || '\u672a\u9009\u62e9'}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">\ud83d\udd0a \u8bed\u97f3\u8bbe\u7f6e</div>
    <div class="field">
      <label>\u8bed\u97f3\u5305</label>
      <select id="voicePack">
        <option value="cute-girl" ${config.voicePack === 'cute-girl' ? 'selected' : ''}>\u840c\u59b9</option>
        <option value="mature-woman" ${config.voicePack === 'mature-woman' ? 'selected' : ''}>\u5fa1\u59d0</option>
        <option value="taiwanese" ${config.voicePack === 'taiwanese' ? 'selected' : ''}>\u53f0\u59b9</option>
        <option value="male-smoky" ${config.voicePack === 'male-smoky' ? 'selected' : ''}>\u7537\u70df\u55d3</option>
        <option value="male-bubble" ${config.voicePack === 'male-bubble' ? 'selected' : ''}>\u7537\u6c14\u6ce1\u97f3</option>
        <option value="custom" ${config.voicePack === 'custom' ? 'selected' : ''}>\u81ea\u5b9a\u4e49\u58f0\u7eb9</option>
      </select>
    </div>
    <div class="field">
      <label>TTS \u670d\u52a1</label>
      <select id="ttsProvider">
        <option value="edge-tts" ${config.ttsProvider === 'edge-tts' ? 'selected' : ''}>Edge TTS\uff08\u514d\u8d39\uff09</option>
        <option value="fish-speech" ${config.ttsProvider === 'fish-speech' ? 'selected' : ''}>Fish Speech\uff08\u652f\u6301\u58f0\u7eb9\u514b\u9686\uff09</option>
      </select>
    </div>
    <div class="field" id="fishSpeechField" style="display:${config.ttsProvider === 'fish-speech' ? 'block' : 'none'}">
      <label>Fish Speech API \u5730\u5740</label>
      <input type="text" id="fishSpeechUrl" value="${config.fishSpeechUrl}" />
    </div>
    <div class="field" id="customVoiceField" style="display:${config.voicePack === 'custom' ? 'block' : 'none'}">
      <button onclick="selectFile('audio')">${'\u4e0a\u4f20\u58f0\u7eb9\u53c2\u8003\u97f3\u9891'}</button>
      <div class="file-path" id="customVoicePath">${config.customVoicePath || '\u672a\u9009\u62e9'}</div>
    </div>
    <div class="checkbox-field">
      <input type="checkbox" id="enableVoiceOutput" ${config.enableVoiceOutput ? 'checked' : ''} />
      <label for="enableVoiceOutput">${'\u542f\u7528\u8bed\u97f3\u8f93\u51fa'}</label>
    </div>
  </div>

  <div class="section">
    <div class="section-title">\u2699\ufe0f \u884c\u4e3a\u8bbe\u7f6e</div>
    <div class="field">
      <label>${'\u4e45\u5750\u63d0\u9192\u95f4\u9694\uff08\u5206\u949f\uff09'}</label>
      <input type="number" id="healthReminderInterval" value="${config.healthReminderInterval}" min="10" max="180" />
    </div>
    <div class="checkbox-field">
      <input type="checkbox" id="enableCodeTips" ${config.enableCodeTips ? 'checked' : ''} />
      <label for="enableCodeTips">${'\u542f\u7528\u4ee3\u7801\u7f16\u5199\u63d0\u793a'}</label>
    </div>
    <div class="checkbox-field">
      <input type="checkbox" id="enableNewsBroadcast" ${config.enableNewsBroadcast ? 'checked' : ''} />
      <label for="enableNewsBroadcast">${'\u542f\u7528\u65b0\u95fb\u64ad\u62a5'}</label>
    </div>
    <div class="checkbox-field">
      <input type="checkbox" id="enableProactiveChat" ${config.enableProactiveChat ? 'checked' : ''} />
      <label for="enableProactiveChat">${'\u542f\u7528\u4e3b\u52a8\u804a\u5929'}</label>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    function updateConfig(key, value) {
      vscode.postMessage({ command: 'updateConfig', key, value });
    }

    function selectFile(fileType) {
      vscode.postMessage({ command: 'selectFile', fileType });
    }

    document.getElementById('apiKey').addEventListener('change', (e) => updateConfig('openaiApiKey', e.target.value));
    document.getElementById('baseUrl').addEventListener('change', (e) => updateConfig('openaiBaseUrl', e.target.value));
    document.getElementById('character').addEventListener('change', (e) => {
      updateConfig('character', e.target.value);
      document.getElementById('customCharacterField').style.display = e.target.value === 'custom' ? 'block' : 'none';
    });
    document.getElementById('voicePack').addEventListener('change', (e) => {
      updateConfig('voicePack', e.target.value);
      document.getElementById('customVoiceField').style.display = e.target.value === 'custom' ? 'block' : 'none';
    });
    document.getElementById('ttsProvider').addEventListener('change', (e) => {
      updateConfig('ttsProvider', e.target.value);
      document.getElementById('fishSpeechField').style.display = e.target.value === 'fish-speech' ? 'block' : 'none';
    });
    document.getElementById('fishSpeechUrl').addEventListener('change', (e) => updateConfig('fishSpeechUrl', e.target.value));
    document.getElementById('healthReminderInterval').addEventListener('change', (e) => updateConfig('healthReminderInterval', parseInt(e.target.value)));
    document.getElementById('enableCodeTips').addEventListener('change', (e) => updateConfig('enableCodeTips', e.target.checked));
    document.getElementById('enableNewsBroadcast').addEventListener('change', (e) => updateConfig('enableNewsBroadcast', e.target.checked));
    document.getElementById('enableProactiveChat').addEventListener('change', (e) => updateConfig('enableProactiveChat', e.target.checked));
    document.getElementById('enableVoiceOutput').addEventListener('change', (e) => updateConfig('enableVoiceOutput', e.target.checked));

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.command === 'fileSelected') {
        if (msg.fileType === 'image') {
          document.getElementById('customCharacterPath').textContent = msg.path;
        } else {
          document.getElementById('customVoicePath').textContent = msg.path;
        }
      }
    });
  </script>
</body>
</html>`;
  }
}
