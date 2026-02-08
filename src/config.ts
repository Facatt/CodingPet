import * as vscode from 'vscode';

export type CharacterType = 'cute-girl' | 'cat' | 'dog' | 'custom';
export type VoicePackType = 'cute-girl' | 'mature-woman' | 'taiwanese' | 'male-smoky' | 'male-bubble' | 'custom';
export type TTSProvider = 'edge-tts' | 'fish-speech';
export type EmotionType = 'happy' | 'worried' | 'calm' | 'angry' | 'excited' | 'thinking';

export interface PetConfig {
  openaiApiKey: string;
  openaiBaseUrl: string;
  character: CharacterType;
  voicePack: VoicePackType;
  ttsProvider: TTSProvider;
  fishSpeechUrl: string;
  healthReminderInterval: number;
  enableCodeTips: boolean;
  enableNewsBroadcast: boolean;
  enableProactiveChat: boolean;
  enableVoiceOutput: boolean;
  customCharacterPath: string;
  customVoicePath: string;
}

export function getConfig(): PetConfig {
  const config = vscode.workspace.getConfiguration('codingpet');
  return {
    openaiApiKey: config.get<string>('openaiApiKey', ''),
    openaiBaseUrl: config.get<string>('openaiBaseUrl', 'https://api.openai.com/v1'),
    character: config.get<CharacterType>('character', 'cute-girl'),
    voicePack: config.get<VoicePackType>('voicePack', 'cute-girl'),
    ttsProvider: config.get<TTSProvider>('ttsProvider', 'edge-tts'),
    fishSpeechUrl: config.get<string>('fishSpeechUrl', 'http://localhost:8080'),
    healthReminderInterval: config.get<number>('healthReminderInterval', 45),
    enableCodeTips: config.get<boolean>('enableCodeTips', true),
    enableNewsBroadcast: config.get<boolean>('enableNewsBroadcast', true),
    enableProactiveChat: config.get<boolean>('enableProactiveChat', true),
    enableVoiceOutput: config.get<boolean>('enableVoiceOutput', true),
    customCharacterPath: config.get<string>('customCharacterPath', ''),
    customVoicePath: config.get<string>('customVoicePath', ''),
  };
}

export function onConfigChange(callback: (config: PetConfig) => void): vscode.Disposable {
  return vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration('codingpet')) {
      callback(getConfig());
    }
  });
}
