import { getConfig } from '../config';
import { AIService } from '../core/ai-service';
import { HealthReminder } from './health-reminder';
import { NewsFetcher } from './news-fetcher';
import { CodeWatcher } from './code-watcher';
import { TTSManager } from '../tts/tts-manager';
import { WSServer } from '../ipc/ws-server';
import { CodeContextService } from '../core/code-context';
import * as fs from 'fs';

type ProactiveCategory = 'health' | 'news' | 'mood' | 'philosophy' | 'fun';

interface ScheduleEntry {
  category: ProactiveCategory;
  intervalMs: number;
  lastTriggeredAt: number;
  enabled: () => boolean;
}

export class ProactiveScheduler {
  private aiService: AIService;
  private ttsManager: TTSManager;
  private wsServer: WSServer;
  private codeContextService: CodeContextService;
  private healthReminder: HealthReminder;
  private newsFetcher: NewsFetcher;
  private codeWatcher: CodeWatcher;
  private mainTimer: NodeJS.Timeout | null = null;
  private schedules: ScheduleEntry[];

  constructor(
    aiService: AIService,
    ttsManager: TTSManager,
    wsServer: WSServer,
    codeContextService: CodeContextService
  ) {
    this.aiService = aiService;
    this.ttsManager = ttsManager;
    this.wsServer = wsServer;
    this.codeContextService = codeContextService;
    this.healthReminder = new HealthReminder();
    this.newsFetcher = new NewsFetcher();
    this.codeWatcher = new CodeWatcher();

    this.schedules = [
      {
        category: 'news',
        intervalMs: 60 * 60 * 1000,
        lastTriggeredAt: 0,
        enabled: () => getConfig().enableNewsBroadcast,
      },
      {
        category: 'mood',
        intervalMs: 90 * 60 * 1000,
        lastTriggeredAt: 0,
        enabled: () => getConfig().enableProactiveChat,
      },
      {
        category: 'philosophy',
        intervalMs: 120 * 60 * 1000,
        lastTriggeredAt: 0,
        enabled: () => getConfig().enableProactiveChat,
      },
      {
        category: 'fun',
        intervalMs: 75 * 60 * 1000,
        lastTriggeredAt: 0,
        enabled: () => getConfig().enableProactiveChat,
      },
    ];
  }

  start(): void {
    this.healthReminder.start(async () => {
      await this.triggerProactive('health');
    });

    this.codeWatcher.start(async (changes) => {
      await this.handleCodeTip(changes);
    });

    this.mainTimer = setInterval(() => {
      this.checkSchedules();
    }, 5 * 60 * 1000);

    setTimeout(() => {
      this.checkSchedules();
    }, 10 * 60 * 1000);
  }

  recordActivity(): void {
    this.healthReminder.recordActivity();
  }

  getCodeWatcher(): CodeWatcher {
    return this.codeWatcher;
  }

  private async checkSchedules(): Promise<void> {
    if (!this.wsServer.isConnected()) {
      return;
    }

    const now = Date.now();

    for (const schedule of this.schedules) {
      if (
        schedule.enabled() &&
        now - schedule.lastTriggeredAt >= schedule.intervalMs
      ) {
        const randomDelay = Math.random() * 5 * 60 * 1000;
        setTimeout(() => {
          this.triggerProactive(schedule.category);
        }, randomDelay);

        schedule.lastTriggeredAt = now;
        break;
      }
    }
  }

  private async triggerProactive(category: ProactiveCategory): Promise<void> {
    if (!this.wsServer.isConnected()) {
      return;
    }

    let additionalContext = '';

    if (category === 'news') {
      const newsItems = await this.newsFetcher.getFormattedNews();
      if (newsItems.length > 0) {
        const aiResponse = await this.aiService.summarizeNews(newsItems);
        if (!aiResponse.isSkip) {
          await this.sendProactiveMessage(aiResponse.text, aiResponse.emotion, category);
        }
        return;
      }
    }

    if (category === 'health') {
      const minutes = this.healthReminder.getContinuousCodingMinutes();
      additionalContext = `\u7a0b\u5e8f\u5458\u5df2\u7ecf\u8fde\u7eed\u7f16\u7801 ${minutes} \u5206\u949f\u4e86`;
    }

    const aiResponse = await this.aiService.generateProactiveMessage(
      category === 'health' ? 'health' : category === 'news' ? 'fun' : category as any,
      additionalContext
    );

    if (!aiResponse.isSkip) {
      await this.sendProactiveMessage(aiResponse.text, aiResponse.emotion, category);
    }
  }

  private async handleCodeTip(changes: string): Promise<void> {
    if (!this.wsServer.isConnected()) {
      return;
    }

    const codeContext = this.codeContextService.buildContextPrompt();
    const fullContext = `${codeContext}\n\n${changes}`;

    const aiResponse = await this.aiService.getCodeTip(fullContext);

    if (!aiResponse.isSkip && aiResponse.text) {
      let audioUrl: string | undefined;
      const ttsResult = await this.ttsManager.synthesize(aiResponse.text);
      if (ttsResult) {
        const audioBuffer = fs.readFileSync(ttsResult.audioPath);
        const audioBase64 = audioBuffer.toString('base64');
        this.wsServer.send({
          type: 'audio_data',
          audioBase64,
          mimeType: 'audio/mp3',
        });
      }

      this.wsServer.send({
        type: 'code_tip',
        text: aiResponse.text,
        emotion: aiResponse.emotion,
      });
    }
  }

  private async sendProactiveMessage(
    text: string,
    emotion: any,
    category: ProactiveCategory
  ): Promise<void> {
    const ttsResult = await this.ttsManager.synthesize(text);
    if (ttsResult) {
      const audioBuffer = fs.readFileSync(ttsResult.audioPath);
      const audioBase64 = audioBuffer.toString('base64');
      this.wsServer.send({
        type: 'audio_data',
        audioBase64,
        mimeType: 'audio/mp3',
      });
    }

    this.wsServer.send({
      type: 'proactive_message',
      text,
      emotion,
      category,
    });
  }

  stop(): void {
    this.healthReminder.stop();
    this.codeWatcher.stop();
    if (this.mainTimer) {
      clearInterval(this.mainTimer);
      this.mainTimer = null;
    }
  }
}
