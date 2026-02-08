import { VoicePackType } from '../config';
import { TTSResult } from './tts-manager';
import * as path from 'path';

const VOICE_MAP: Record<VoicePackType, string> = {
  'cute-girl': 'zh-CN-XiaoxiaoNeural',
  'mature-woman': 'zh-CN-XiaoyanNeural',
  'taiwanese': 'zh-TW-HsiaoChenNeural',
  'male-smoky': 'zh-CN-YunxiNeural',
  'male-bubble': 'zh-CN-YunjianNeural',
  'custom': 'zh-CN-XiaoxiaoNeural',
};

const OUTPUT_FORMATS = {
  MP3: 'audio-24khz-96kbitrate-mono-mp3',
  WEBM: 'webm-24khz-16bit-mono-opus',
};

export class EdgeTTSProvider {
  async synthesize(text: string, outputPath: string, voicePack: VoicePackType): Promise<TTSResult> {
    const voice = VOICE_MAP[voicePack] || VOICE_MAP['cute-girl'];

    try {
      const { MsEdgeTTS, OUTPUT_FORMAT } = require('node-edge-tts');
      const tts = new MsEdgeTTS();
      await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);

      const outputDir = path.dirname(outputPath);
      const result = await tts.toFile(outputDir, text);

      const fs = require('fs');
      if (result.audioFilePath && result.audioFilePath !== outputPath) {
        if (fs.existsSync(result.audioFilePath)) {
          fs.renameSync(result.audioFilePath, outputPath);
        }
      }

      return { audioPath: outputPath };
    } catch (e: any) {
      console.error('[CodingPet] node-edge-tts failed:', e.message);
      return this.synthesizeWithPythonCLI(text, outputPath, voice);
    }
  }

  private async synthesizeWithPythonCLI(
    text: string,
    outputPath: string,
    voice: string
  ): Promise<TTSResult> {
    const { spawn } = require('child_process');
    const fs = require('fs');

    return new Promise((resolve, reject) => {
      const escapedText = text.replace(/"/g, '\\"');
      const proc = spawn('edge-tts', [
        '--voice', voice,
        '--text', escapedText,
        '--write-media', outputPath,
      ]);

      let stderr = '';
      proc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on('close', (code: number) => {
        if (code === 0 && fs.existsSync(outputPath)) {
          resolve({ audioPath: outputPath });
        } else {
          reject(new Error(`edge-tts CLI exited with code ${code}: ${stderr}`));
        }
      });

      proc.on('error', (err: Error) => {
        reject(new Error(`Failed to run edge-tts CLI: ${err.message}. Install with: pip install edge-tts`));
      });
    });
  }

  static getAvailableVoices(): Array<{ id: VoicePackType; name: string; description: string }> {
    return [
      { id: 'cute-girl', name: '\u840c\u59b9', description: '\u751c\u7f8e\u53ef\u7231\u7684\u5973\u58f0 (\u6653\u6653)' },
      { id: 'mature-woman', name: '\u5fa1\u59d0', description: '\u6210\u719f\u4f18\u96c5\u7684\u5973\u58f0 (\u6653\u989c)' },
      { id: 'taiwanese', name: '\u53f0\u59b9', description: '\u6e29\u67d4\u7684\u53f0\u6e7e\u8154\u5973\u58f0 (\u66c9\u81fb)' },
      { id: 'male-smoky', name: '\u7537\u70df\u55d3', description: '\u4f4e\u6c89\u78c1\u6027\u7684\u7537\u58f0 (\u4e91\u5e0c)' },
      { id: 'male-bubble', name: '\u7537\u6c14\u6ce1\u97f3', description: '\u6d3b\u529b\u9752\u6625\u7684\u7537\u58f0 (\u4e91\u5065)' },
    ];
  }
}
