import { app, BrowserWindow, screen, ipcMain, Tray, Menu } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

function getWSPort(): number {
  if (process.env.CODINGPET_WS_PORT) {
    return parseInt(process.env.CODINGPET_WS_PORT, 10);
  }
  const portArg = process.argv.find((arg) => arg.startsWith('--ws-port='));
  if (portArg) {
    return parseInt(portArg.split('=')[1], 10);
  }
  return 13579;
}

function getSavedPosition(): { x: number; y: number } | null {
  const configPath = path.join(app.getPath('userData'), 'pet-position.json');
  try {
    if (fs.existsSync(configPath)) {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return { x: data.x, y: data.y };
    }
  } catch (e) {
    // ignore
  }
  return null;
}

function savePosition(x: number, y: number): void {
  const configPath = path.join(app.getPath('userData'), 'pet-position.json');
  try {
    fs.writeFileSync(configPath, JSON.stringify({ x, y }));
  } catch (e) {
    // ignore
  }
}

function createWindow(): void {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  const savedPos = getSavedPosition();
  const defaultX = screenWidth - 320;
  const defaultY = screenHeight - 400;

  mainWindow = new BrowserWindow({
    width: 300,
    height: 500,
    x: savedPos?.x ?? defaultX,
    y: savedPos?.y ?? defaultY,
    transparent: true,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setIgnoreMouseEvents(false);

  const htmlPath = path.join(__dirname, 'renderer', 'index.html');
  if (fs.existsSync(htmlPath)) {
    mainWindow.loadFile(htmlPath);
  } else {
    const devHtmlPath = path.join(__dirname, '..', 'renderer', 'index.html');
    if (fs.existsSync(devHtmlPath)) {
      mainWindow.loadFile(devHtmlPath);
    } else {
      console.error('Cannot find index.html');
    }
  }

  mainWindow.on('moved', () => {
    if (mainWindow) {
      const [x, y] = mainWindow.getPosition();
      savePosition(x, y);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  ipcMain.on('set-ignore-mouse', (_event, ignore: boolean, options?: { forward: boolean }) => {
    if (mainWindow) {
      if (ignore) {
        mainWindow.setIgnoreMouseEvents(true, { forward: true });
      } else {
        mainWindow.setIgnoreMouseEvents(false);
      }
    }
  });

  ipcMain.on('window-drag-start', () => {
    // Drag handled by CSS -webkit-app-region: drag
  });

  ipcMain.on('resize-window', (_event, width: number, height: number) => {
    if (mainWindow) {
      mainWindow.setSize(width, height);
    }
  });

  ipcMain.handle('get-ws-port', () => {
    return getWSPort();
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) { mainWindow.restore(); }
      mainWindow.focus();
    }
  });
}
