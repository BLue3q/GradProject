"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
let outputCallbacks = [];
let finishedCallbacks = [];
let inputRequiredCallbacks = [];
// Listen for program output events from the main process
electron_1.ipcRenderer.on('program-output', (_event, data) => {
    // Call all registered callbacks with the output data
    outputCallbacks.forEach(callback => callback(data));
});
// Listen for program finished events
electron_1.ipcRenderer.on('program-finished', (_event, code) => {
    // Call all registered callbacks with the exit code
    finishedCallbacks.forEach(callback => callback(code));
});
// Listen for input required events
electron_1.ipcRenderer.on('input-required', () => {
    // Call all registered callbacks to notify that input is required
    inputRequiredCallbacks.forEach(callback => callback());
});
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    // Expose the compileCpp function to the renderer process
    compileCpp: (code) => electron_1.ipcRenderer.invoke('compile-cpp', code),
    // Expose the runPython function to the renderer process
    runPython: (scriptPath) => electron_1.ipcRenderer.invoke('run-python', scriptPath),
    // Register callback for real-time program output
    onProgramOutput: (callback) => {
        outputCallbacks.push(callback);
    },
    // Remove callback for program output
    offProgramOutput: (callback) => {
        outputCallbacks = outputCallbacks.filter(cb => cb !== callback);
    },
    // Register callback for program completion
    onProgramFinished: (callback) => {
        finishedCallbacks.push(callback);
    },
    // Remove callback for program completion
    offProgramFinished: (callback) => {
        finishedCallbacks = finishedCallbacks.filter(cb => cb !== callback);
    },
    // Register callback for input required events
    onInputRequired: (callback) => {
        inputRequiredCallbacks.push(callback);
    },
    // Remove callback for input required events
    offInputRequired: (callback) => {
        inputRequiredCallbacks = inputRequiredCallbacks.filter(cb => cb !== callback);
    },
    // Check if the process is waiting for input
    checkInputMode: () => electron_1.ipcRenderer.invoke('check-input-mode'),
    // Send user input to the running program
    sendProgramInput: (input) => {
        electron_1.ipcRenderer.send('send-program-input', input);
    },
    // Kill the running process
    killRunningProcess: () => {
        electron_1.ipcRenderer.send('kill-running-process');
    }
});
//# sourceMappingURL=preload.js.map