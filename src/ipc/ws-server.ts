import WebSocket from 'ws';
import { ExtensionToOverlayMessage, OverlayToExtensionMessage } from './messages';

export class WSServer {
  private wss: WebSocket.Server | null = null;
  private client: WebSocket.WebSocket | null = null;
  private port: number = 0;
  private messageHandler: ((msg: OverlayToExtensionMessage) => void) | null = null;
  private connectionHandler: (() => void) | null = null;
  private disconnectionHandler: (() => void) | null = null;

  async start(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.wss = new WebSocket.Server({ port: 0, host: '127.0.0.1' });

      this.wss.on('listening', () => {
        const address = this.wss!.address();
        if (typeof address === 'object' && address) {
          this.port = address.port;
          console.log(`[CodingPet] WebSocket server listening on port ${this.port}`);
          resolve(this.port);
        }
      });

      this.wss.on('connection', (ws: WebSocket.WebSocket) => {
        console.log('[CodingPet] Overlay connected');
        this.client = ws;

        ws.on('message', (data) => {
          try {
            const msg = JSON.parse(data.toString()) as OverlayToExtensionMessage;
            this.messageHandler?.(msg);
          } catch (e) {
            console.error('[CodingPet] Failed to parse message:', e);
          }
        });

        ws.on('close', () => {
          console.log('[CodingPet] Overlay disconnected');
          this.client = null;
          this.disconnectionHandler?.();
        });

        ws.on('error', (err) => {
          console.error('[CodingPet] WebSocket error:', err);
        });

        this.connectionHandler?.();
      });

      this.wss.on('error', (err) => {
        reject(err);
      });
    });
  }

  send(message: ExtensionToOverlayMessage): void {
    if (this.client && this.client.readyState === WebSocket.OPEN) {
      this.client.send(JSON.stringify(message));
    }
  }

  onMessage(handler: (msg: OverlayToExtensionMessage) => void): void {
    this.messageHandler = handler;
  }

  onConnection(handler: () => void): void {
    this.connectionHandler = handler;
  }

  onDisconnection(handler: () => void): void {
    this.disconnectionHandler = handler;
  }

  isConnected(): boolean {
    return this.client !== null && this.client.readyState === WebSocket.OPEN;
  }

  getPort(): number {
    return this.port;
  }

  stop(): void {
    if (this.client) {
      this.client.close();
      this.client = null;
    }
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
  }
}
