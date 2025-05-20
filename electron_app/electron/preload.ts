import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Expose the compileCpp function to the renderer process
  compileCpp: (code: string): Promise<string> => ipcRenderer.invoke('compile-cpp', code)
});
