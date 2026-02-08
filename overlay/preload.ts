import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => {
    ipcRenderer.send('set-ignore-mouse', ignore, options);
  },

  resizeWindow: (width: number, height: number) => {
    ipcRenderer.send('resize-window', width, height);
  },

  getWSPort: () => ipcRenderer.invoke('get-ws-port'),

  startDrag: () => {
    ipcRenderer.send('window-drag-start');
  },
});
