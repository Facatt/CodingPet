import OpenAI from 'openai';
import { EmotionType, getConfig } from '../config';
import { ConversationManager } from './conversation-manager';
import { SYSTEM_PROMPT, CODE_TIP_PROMPT, PROACTIVE_PROMPTS, parseEmotionFromResponse, isSkipResponse, buildCodeContextPrompt } from './prompt-builder';

export interface AIResponse {
  text: string;
  emotion: EmotionType;
  shouldSpeak: boolean;
  isSkip?: boolean;
}

export class AIService {
  private client: OpenAI | null = null;
  private conversationManager: ConversationManager;

  constructor(conversationManager: ConversationManager) {
    this.conversationManager = conversationManager;
    this.initClient();
  }

  private initClient(): void {
    const config = getConfig();
    if (config.openaiApiKey) {
      this.client = new OpenAI({
        apiKey: config.openaiApiKey,
        baseURL: config.openaiBaseUrl,
      });
    }
  }

  refreshClient(): void {
    this.initClient();
  }

  isReady(): boolean {
    return this.client !== null;
  }

  async chat(userMessage: string, codeContext?: string): Promise<AIResponse> {
    if (!this.client) {
      return { text: '请先在设置中配置 OpenAI API Key 哦~', emotion: 'worried', shouldSpeak: true };
    }

    let fullUserMessage = userMessage;
    if (codeContext) {
      fullUserMessage = `${codeContext}\n\n用户说：${userMessage}`;
    }

    this.conversationManager.addUserMessage(userMessage);

    try {
      const messages = [
        { role: 'system' as const, content: SYSTEM_PROMPT },
        ...this.conversationManager.getOpenAIMessages().slice(-20),
      ];

      messages[messages.length - 1] = { role: 'user', content: fullUserMessage };

      const response = await this.client.chat.completions.create({
        model: 'gpt-4o',
        messages,
        max_tokens: 1000,
        temperature: 0.8,
      });

      const rawText = response.choices[0]?.message?.content || '抱歉，我走神了，能再说一遍吗？';
      const { cleanText, emotion } = parseEmotionFromResponse(rawText);

      this.conversationManager.addAssistantMessage(cleanText);

      return { text: cleanText, emotion, shouldSpeak: true };
    } catch (error: any) {
      console.error('[CodingPet] AI chat error:', error);
      const errorMsg = error.message?.includes('API')
        ? 'API 调用出错了，检查一下网络和 Key 设置吧~'
        : `出了点小问题：${error.message || '未知错误'}`;
      return { text: errorMsg, emotion: 'worried', shouldSpeak: true };
    }
  }

  async getCodeTip(codeContext: string): Promise<AIResponse> {
    if (!this.client) {
      return { text: '', emotion: 'calm', shouldSpeak: false, isSkip: true };
    }

    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: CODE_TIP_PROMPT },
          { role: 'user', content: codeContext },
        ],
        max_tokens: 300,
        temperature: 0.7,
      });

      const rawText = response.choices[0]?.message?.content || '';

      if (isSkipResponse(rawText)) {
        return { text: '', emotion: 'calm', shouldSpeak: false, isSkip: true };
      }

      const { cleanText, emotion } = parseEmotionFromResponse(rawText);
      return { text: cleanText, emotion, shouldSpeak: true };
    } catch (error) {
      console.error('[CodingPet] Code tip error:', error);
      return { text: '', emotion: 'calm', shouldSpeak: false, isSkip: true };
    }
  }

  async generateProactiveMessage(
    category: keyof typeof PROACTIVE_PROMPTS,
    additionalContext?: string
  ): Promise<AIResponse> {
    if (!this.client) {
      return { text: '', emotion: 'calm', shouldSpeak: false, isSkip: true };
    }

    try {
      let prompt = PROACTIVE_PROMPTS[category];
      if (additionalContext) {
        prompt += `\n\n额外背景信息：${additionalContext}`;
      }

      const response = await this.client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        max_tokens: 300,
        temperature: 0.9,
      });

      const rawText = response.choices[0]?.message?.content || '';
      const { cleanText, emotion } = parseEmotionFromResponse(rawText);
      return { text: cleanText, emotion, shouldSpeak: true };
    } catch (error) {
      console.error('[CodingPet] Proactive message error:', error);
      return { text: '', emotion: 'calm', shouldSpeak: false, isSkip: true };
    }
  }

  async summarizeNews(newsItems: string[]): Promise<AIResponse> {
    if (!this.client) {
      return { text: '', emotion: 'calm', shouldSpeak: false, isSkip: true };
    }

    try {
      const prompt = `以下是今天的科技新闻，请用轻松有趣的方式给程序员播报1-2条最有意思的：\n\n${newsItems.join('\n')}\n\n要求：简洁有趣，不超过150字，附带 [emotion:excited]`;

      const response = await this.client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        max_tokens: 300,
        temperature: 0.8,
      });

      const rawText = response.choices[0]?.message?.content || '';
      const { cleanText, emotion } = parseEmotionFromResponse(rawText);
      return { text: cleanText, emotion, shouldSpeak: true };
    } catch (error) {
      console.error('[CodingPet] News summary error:', error);
      return { text: '', emotion: 'calm', shouldSpeak: false, isSkip: true };
    }
  }

  async transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string> {
    if (!this.client) {
      throw new Error('OpenAI client not initialized');
    }

    try {
      const ext = mimeType.includes('webm') ? 'webm' : mimeType.includes('wav') ? 'wav' : 'mp3';
      const file = new File([audioBuffer], `audio.${ext}`, { type: mimeType });

      const transcription = await this.client.audio.transcriptions.create({
        model: 'whisper-1',
        file,
        language: 'zh',
      });

      return transcription.text;
    } catch (error) {
      console.error('[CodingPet] Whisper transcription error:', error);
      throw error;
    }
  }
}
