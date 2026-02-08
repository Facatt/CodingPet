import { CharacterType, EmotionType, PetConfig, VoicePackType } from '../config';

// ====== Extension -> Overlay 消息 ======

export interface ChatResponseMessage {
  type: 'chat_response';
  text: string;
  emotion: EmotionType;
  audioUrl?: string;
}

export interface CodeTipMessage {
  type: 'code_tip';
  text: string;
  emotion: EmotionType;
  audioUrl?: string;
}

export interface ProactiveMessage {
  type: 'proactive_message';
  text: string;
  emotion: EmotionType;
  category: 'health' | 'news' | 'mood' | 'philosophy' | 'fun';
  audioUrl?: string;
}

export interface EmotionChangeMessage {
  type: 'emotion_change';
  emotion: EmotionType;
}

export interface ConfigUpdateMessage {
  type: 'config_update';
  config: Partial<PetConfig>;
}

export interface ChangeCharacterMessage {
  type: 'change_character';
  character: CharacterType;
}

export interface ChangeVoiceMessage {
  type: 'change_voice';
  voice: VoicePackType;
}

export interface StatusMessage {
  type: 'status';
  connected: boolean;
}

export interface AudioDataMessage {
  type: 'audio_data';
  audioBase64: string;
  mimeType: string;
}

// ====== Overlay -> Extension 消息 ======

export interface ChatRequestMessage {
  type: 'chat_request';
  text: string;
}

export interface VoiceInputMessage {
  type: 'voice_input';
  audioData: string; // base64
  mimeType: string;
}

export interface ImageInputMessage {
  type: 'image_input';
  imageData: string; // base64
  mimeType: string;
  text?: string;
}

export interface OverlayReadyMessage {
  type: 'overlay_ready';
}

export interface RequestConfigMessage {
  type: 'request_config';
}

// ====== 联合类型 ======

export type ExtensionToOverlayMessage =
  | ChatResponseMessage
  | CodeTipMessage
  | ProactiveMessage
  | EmotionChangeMessage
  | ConfigUpdateMessage
  | ChangeCharacterMessage
  | ChangeVoiceMessage
  | StatusMessage
  | AudioDataMessage;

export type OverlayToExtensionMessage =
  | ChatRequestMessage
  | VoiceInputMessage
  | ImageInputMessage
  | OverlayReadyMessage
  | RequestConfigMessage;

export type WSMessage = ExtensionToOverlayMessage | OverlayToExtensionMessage;
