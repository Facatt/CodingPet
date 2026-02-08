import { PetConfig } from '../config';
import { TTSResult } from './tts-manager';
import * as fs from 'fs';
import * as path from 'path';

interface FishSpeechRequest {
  text: string;
  reference_audio?: string;
  reference_text?: string;
  format?: string;
  streaming?: boolean;
}

export class FishSpeechProvider {
  async synthesize(text: string, outputPath: string, config: PetConfig): Promise<TTSResult> {
    const apiUrl = config.fishSpeechUrl || 'http://localhost:8080';

    const requestBody: FishSpeechRequest = {
      text,
      format: 'mp3',
      streaming: false,
    };

    if (config.customVoicePath && fs.existsSync(config.customVoicePath)) {
      const audioBuffer = fs.readFileSync(config.customVoicePath);
      requestBody.reference_audio = audioBuffer.toString('base64');
      requestBody.reference_text = '';
    }

    try {
      const fetch = require('node-fetch');
      const response = await fetch(`${apiUrl}/v1/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Fish Speech API error: ${response.status} ${response.statusText}`);
      }

      const audioBuffer = await response.buffer();
      fs.writeFileSync(outputPath, audioBuffer);

      return { audioPath: outputPath };
    } catch (error: any) {
      throw new Error(`Fish Speech synthesis failed: ${error.message}`);
    }
  }

  async checkHealth(apiUrl: string): Promise<boolean> {
    try {
      const fetch = require('node-fetch');
      const response = await fetch(`${apiUrl}/health`, {
        method: 'GET',
        timeout: 5000,
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async uploadReferenceAudio(
    apiUrl: string,
    audioPath: string,
    referenceText: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const fetch = require('node-fetch');
      const audioBuffer = fs.readFileSync(audioPath);

      const response = await fetch(`${apiUrl}/v1/models/voice-clone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audio: audioBuffer.toString('base64'),
          text: referenceText,
        }),
      });

      if (!response.ok) {
        return { success: false, message: `\u4e0a\u4f20\u5931\u8d25: ${response.statusText}` };
      }

      return { success: true, message: '\u58f0\u7eb9\u5b66\u4e60\u5b8c\u6210\uff01' };
    } catch (error: any) {
      return { success: false, message: `\u8fde\u63a5 Fish Speech \u670d\u52a1\u5931\u8d25: ${error.message}` };
    }
  }
}
