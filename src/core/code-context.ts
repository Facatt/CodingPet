import * as vscode from 'vscode';
import { buildCodeContextPrompt } from './prompt-builder';

export interface CodeContext {
  fileName: string;
  language: string;
  currentCode: string;
  cursorLine: number;
  recentChanges?: string;
  diagnostics?: string[];
  projectStructure?: string;
}

export class CodeContextService {
  private lastDocumentVersion: Map<string, number> = new Map();
  private recentChanges: Map<string, string> = new Map();

  getCurrentContext(): CodeContext | null {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return null;
    }

    const document = editor.document;
    const cursorPosition = editor.selection.active;

    const startLine = Math.max(0, cursorPosition.line - 50);
    const endLine = Math.min(document.lineCount - 1, cursorPosition.line + 50);
    const range = new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length);
    const currentCode = document.getText(range);

    const diagnostics = vscode.languages
      .getDiagnostics(document.uri)
      .map((d) => `[${d.severity === 0 ? 'ERROR' : d.severity === 1 ? 'WARN' : 'INFO'}] \u7b2c${d.range.start.line + 1}\u884c: ${d.message}`);

    return {
      fileName: document.fileName,
      language: document.languageId,
      currentCode,
      cursorLine: cursorPosition.line + 1,
      recentChanges: this.recentChanges.get(document.uri.toString()),
      diagnostics: diagnostics.length > 0 ? diagnostics : undefined,
    };
  }

  getFullFileContext(): CodeContext | null {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return null;
    }

    const document = editor.document;
    const cursorPosition = editor.selection.active;

    let currentCode: string;
    if (document.lineCount > 500) {
      const headerCode = document.getText(new vscode.Range(0, 0, 30, 0));
      const startLine = Math.max(0, cursorPosition.line - 100);
      const endLine = Math.min(document.lineCount - 1, cursorPosition.line + 100);
      const cursorCode = document.getText(new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length));
      currentCode = `// === \u6587\u4ef6\u5934\u90e8 ===\n${headerCode}\n// === ... \u7701\u7565 ... ===\n// === \u5149\u6807\u9644\u8fd1(\u7b2c${startLine + 1}-${endLine + 1}\u884c) ===\n${cursorCode}`;
    } else {
      currentCode = document.getText();
    }

    const diagnostics = vscode.languages
      .getDiagnostics(document.uri)
      .map((d) => `[${d.severity === 0 ? 'ERROR' : d.severity === 1 ? 'WARN' : 'INFO'}] \u7b2c${d.range.start.line + 1}\u884c: ${d.message}`);

    return {
      fileName: document.fileName,
      language: document.languageId,
      currentCode,
      cursorLine: cursorPosition.line + 1,
      recentChanges: this.recentChanges.get(document.uri.toString()),
      diagnostics: diagnostics.length > 0 ? diagnostics : undefined,
      projectStructure: this.getProjectStructureSummary(),
    };
  }

  recordChange(event: vscode.TextDocumentChangeEvent): void {
    const uri = event.document.uri.toString();
    const changes = event.contentChanges
      .map((change) => {
        const startLine = change.range.start.line + 1;
        const endLine = change.range.end.line + 1;
        if (change.text === '') {
          return `\u5220\u9664\u4e86\u7b2c${startLine}-${endLine}\u884c\u7684\u5185\u5bb9`;
        }
        const lines = change.text.split('\n');
        if (lines.length <= 5) {
          return `\u5728\u7b2c${startLine}\u884c\u4fee\u6539/\u6dfb\u52a0\uff1a\n${change.text}`;
        }
        return `\u5728\u7b2c${startLine}\u884c\u4fee\u6539/\u6dfb\u52a0\u4e86${lines.length}\u884c\u4ee3\u7801`;
      })
      .join('\n');

    const existing = this.recentChanges.get(uri) || '';
    const combined = existing ? `${existing}\n---\n${changes}` : changes;
    this.recentChanges.set(uri, combined.slice(-2000));
  }

  clearChanges(uri: string): void {
    this.recentChanges.delete(uri);
  }

  buildContextPrompt(): string {
    const context = this.getCurrentContext();
    if (!context) {
      return '\uff08\u5f53\u524d\u6ca1\u6709\u6253\u5f00\u7684\u7f16\u8f91\u5668\uff09';
    }
    return buildCodeContextPrompt(context);
  }

  private getProjectStructureSummary(): string | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return undefined;
    }

    const openFiles = vscode.window.tabGroups.all
      .flatMap((group) => group.tabs)
      .map((tab) => {
        if (tab.input && typeof tab.input === 'object' && 'uri' in tab.input) {
          const uri = (tab.input as { uri: vscode.Uri }).uri;
          return vscode.workspace.asRelativePath(uri);
        }
        return null;
      })
      .filter((f): f is string => f !== null);

    if (openFiles.length === 0) {
      return undefined;
    }

    return `\u9879\u76ee\u6253\u5f00\u7684\u6587\u4ef6\uff1a\n${openFiles.map((f) => `- ${f}`).join('\n')}`;
  }
}
