import { EmotionType } from '../config';
import { parseEmotionFromResponse } from './prompt-builder';

export class EmotionAnalyzer {
  private currentEmotion: EmotionType = 'calm';
  private emotionHistory: Array<{ emotion: EmotionType; timestamp: number }> = [];

  analyzeResponse(text: string): { cleanText: string; emotion: EmotionType } {
    return parseEmotionFromResponse(text);
  }

  setEmotion(emotion: EmotionType): void {
    this.currentEmotion = emotion;
    this.emotionHistory.push({ emotion, timestamp: Date.now() });

    if (this.emotionHistory.length > 50) {
      this.emotionHistory = this.emotionHistory.slice(-50);
    }
  }

  getCurrentEmotion(): EmotionType {
    return this.currentEmotion;
  }

  scheduleCalm(delayMs: number = 10000): NodeJS.Timeout {
    return setTimeout(() => {
      this.currentEmotion = 'calm';
    }, delayMs);
  }

  inferFromDiagnostics(errorCount: number, warningCount: number): EmotionType {
    if (errorCount > 3) { return 'angry'; }
    if (errorCount > 0) { return 'worried'; }
    if (warningCount > 5) { return 'worried'; }
    if (warningCount > 0) { return 'thinking'; }
    return 'calm';
  }

  getEmotionSummary(): string {
    const recentEmotions = this.emotionHistory.slice(-10);
    if (recentEmotions.length === 0) { return '\u5e73\u9759'; }

    const counts: Record<string, number> = {};
    recentEmotions.forEach((e) => {
      counts[e.emotion] = (counts[e.emotion] || 0) + 1;
    });

    const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return dominant ? dominant[0] : 'calm';
  }
}
