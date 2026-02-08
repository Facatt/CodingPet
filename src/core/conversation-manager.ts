import * as vscode from 'vscode';

export interface ConversationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export class ConversationManager {
  private messages: ConversationMessage[] = [];
  private maxHistory = 50;
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.loadHistory();
  }

  addUserMessage(content: string): void {
    this.messages.push({
      role: 'user',
      content,
      timestamp: Date.now(),
    });
    this.trimHistory();
    this.saveHistory();
  }

  addAssistantMessage(content: string): void {
    this.messages.push({
      role: 'assistant',
      content,
      timestamp: Date.now(),
    });
    this.trimHistory();
    this.saveHistory();
  }

  getMessages(): ConversationMessage[] {
    return [...this.messages];
  }

  getOpenAIMessages(): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
    return this.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
  }

  getRecentMessages(count: number): ConversationMessage[] {
    return this.messages.slice(-count);
  }

  clear(): void {
    this.messages = [];
    this.saveHistory();
  }

  private trimHistory(): void {
    if (this.messages.length > this.maxHistory) {
      this.messages = this.messages.slice(-this.maxHistory);
    }
  }

  private saveHistory(): void {
    try {
      this.context.globalState.update('codingpet.conversationHistory', this.messages);
    } catch (e) {
      console.error('[CodingPet] Failed to save conversation history:', e);
    }
  }

  private loadHistory(): void {
    try {
      const saved = this.context.globalState.get<ConversationMessage[]>('codingpet.conversationHistory');
      if (saved && Array.isArray(saved)) {
        this.messages = saved;
      }
    } catch (e) {
      console.error('[CodingPet] Failed to load conversation history:', e);
    }
  }
}
