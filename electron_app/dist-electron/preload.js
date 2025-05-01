"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    // Expose the compileCpp function to the renderer process
    compileCpp: (code) => electron_1.ipcRenderer.invoke('compile-cpp', code)
});
//# sourceMappingURL=preload.js.map