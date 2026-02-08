import { getConfig, VoicePackType, TTSProvider } from '../config';
import { EdgeTTSProvider } from './edge-tts-provider';
import { FishSpeechProvider } from './fish-speech-provider';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

export interface TTSResult {
  audioPath: string;
  duration?: number;
}

export class TTSManager {
  private edgeTTS: EdgeTTSProvider;
  private fishSpeech: FishSpeechProvider;
  private tempDir: string;

  constructor() {
    this.edgeTTS = new EdgeTTSProvider();
    this.fishSpeech = new FishSpeechProvider();
    this.tempDir = path.join(os.tmpdir(), 'codingpet-audio');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async synthesize(text: string): Promise<TTSResult | null> {
    const config = getConfig();

    if (!config.enableVoiceOutput || !text.trim()) {
      return null;
    }

    const outputPath = path.join(this.tempDir, `tts_${Date.now()}.mp3`);

    try {
      if (config.ttsProvider === 'fish-speech') {
        return await this.fishSpeech.synthesize(text, outputPath, config);
      } else {
        return await this.edgeTTS.synthesize(text, outputPath, config.voicePack);
      }
    } catch (error) {
      console.error('[CodingPet] TTS synthesis error:', error);
      if (config.ttsProvider === 'fish-speech') {
        console.log('[CodingPet] Falling back to Edge TTS');
        try {
          return await this.edgeTTS.synthesize(text, outputPath, config.voicePack);
        } catch (fallbackError) {
          console.error('[CodingPet] Edge TTS fallback also failed:', fallbackError);
        }
      }
      return null;
    }
  }

  cleanupOldFiles(maxAgeMs: number = 3600000): void {
    try {
      const files = fs.readdirSync(this.tempDir);
      const now = Date.now();
      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const stat = fs.statSync(filePath);
        if (now - stat.mtimeMs > maxAgeMs) {
          fs.unlinkSync(filePath);
        }
      }
    } catch (e) {
      // ignore cleanup errors
    }
  }

  dispose(): void {
    this.cleanupOldFiles(0);
  }
}
