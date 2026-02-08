import * as vscode from 'vscode';
import { getConfig } from '../config';

export class CodeWatcher {
  private changeBuffer: vscode.TextDocumentChangeEvent[] = [];
  private debounceTimer: NodeJS.Timeout | null = null;
  private debounceMs = 5000;
  private lastTipTime: number = 0;
  private minTipIntervalMs = 60000;
  private onTipCallback: ((changes: string) => void) | null = null;

  start(onTip: (changes: string) => void): void {
    this.onTipCallback = onTip;
  }

  recordChange(event: vscode.TextDocumentChangeEvent): void {
    const config = getConfig();
    if (!config.enableCodeTips) {
      return;
    }

    if (event.document.uri.scheme !== 'file') {
      return;
    }

    this.changeBuffer.push(event);

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.processChanges();
    }, this.debounceMs);
  }

  private processChanges(): void {
    if (this.changeBuffer.length === 0) {
      return;
    }

    const now = Date.now();
    if (now - this.lastTipTime < this.minTipIntervalMs) {
      this.changeBuffer = [];
      return;
    }

    const changeSummary = this.summarizeChanges();

    if (changeSummary && this.isSignificantChange(changeSummary)) {
      this.lastTipTime = now;
      this.onTipCallback?.(changeSummary);
    }

    this.changeBuffer = [];
  }

  private summarizeChanges(): string | null {
    if (this.changeBuffer.length === 0) {
      return null;
    }

    const changesPerFile = new Map<string, string[]>();

    for (const event of this.changeBuffer) {
      const fileName = event.document.fileName;
      const changes = changesPerFile.get(fileName) || [];

      for (const change of event.contentChanges) {
        if (change.text.trim().length > 0) {
          const startLine = change.range.start.line + 1;
          changes.push(`\u7b2c${startLine}\u884c: ${change.text.substring(0, 200)}`);
        }
      }

      changesPerFile.set(fileName, changes);
    }

    if (changesPerFile.size === 0) {
      return null;
    }

    let summary = '\u6700\u8fd1\u4ee3\u7801\u53d8\u66f4\uff1a\n';
    for (const [file, changes] of changesPerFile) {
      const shortFile = file.split(/[\\\/]/).slice(-2).join('/');
      summary += `\n\u6587\u4ef6 ${shortFile}:\n`;
      summary += changes.slice(0, 5).join('\n');
      if (changes.length > 5) {
        summary += `\n...\u8fd8\u6709${changes.length - 5}\u5904\u53d8\u66f4`;
      }
    }

    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const doc = editor.document;
      const cursor = editor.selection.active;
      const startLine = Math.max(0, cursor.line - 10);
      const endLine = Math.min(doc.lineCount - 1, cursor.line + 10);
      const contextCode = doc.getText(new vscode.Range(startLine, 0, endLine, doc.lineAt(endLine).text.length));
      summary += `\n\n\u5f53\u524d\u5149\u6807\u9644\u8fd1\u4ee3\u7801\uff08${doc.fileName.split(/[\\\/]/).pop()}\uff0c\u7b2c${startLine + 1}-${endLine + 1}\u884c\uff09:\n\`\`\`\n${contextCode}\n\`\`\``;
    }

    return summary;
  }

  private isSignificantChange(summary: string): boolean {
    const lineCount = summary.split('\n').length;
    return lineCount >= 3;
  }

  stop(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.changeBuffer = [];
  }
}
