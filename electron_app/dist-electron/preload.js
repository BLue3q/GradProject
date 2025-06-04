"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Prevent multiple registrations if preload is executed multiple times
if (globalThis.__electronAPIInitialized) {
    console.warn('ElectronAPI already initialized, skipping...');
}
else {
    globalThis.__electronAPIInitialized = true;
    let outputCallbacks = [];
    let finishedCallbacks = [];
    let inputRequiredCallbacks = [];
    let analysisCallbacks = [];
    let debugOutputCallbacks = [];
    let compilationCallbacks = [];
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
    // Listen for analysis complete events
    electron_1.ipcRenderer.on('analysis-complete', (_event, data) => {
        // Call all registered callbacks with the analysis data
        analysisCallbacks.forEach(callback => callback(data));
    });
    // Listen for new analysis and debugging events
    electron_1.ipcRenderer.on('analysis-progress', (_event, data) => {
        outputCallbacks.forEach(callback => callback(data));
    });
    electron_1.ipcRenderer.on('code-analysis-complete', (_event, data) => {
        analysisCallbacks.forEach(callback => callback(JSON.stringify(data)));
    });
    electron_1.ipcRenderer.on('compilation-progress', (_event, data) => {
        outputCallbacks.forEach(callback => callback(data));
    });
    electron_1.ipcRenderer.on('compilation-complete', (_event, data) => {
        compilationCallbacks.forEach(callback => callback(data));
    });
    electron_1.ipcRenderer.on('debug-output', (_event, data) => {
        debugOutputCallbacks.forEach(callback => callback(data));
    });
    electron_1.ipcRenderer.on('debug-error', (_event, data) => {
        debugOutputCallbacks.forEach(callback => callback(`Error: ${data}`));
    });
    electron_1.ipcRenderer.on('debug-session-ended', (_event, code) => {
        finishedCallbacks.forEach(callback => callback(code));
    });
    electron_1.contextBridge.exposeInMainWorld('electronAPI', {
        // Expose the compileCpp function to the renderer process
        compileCpp: (code) => electron_1.ipcRenderer.invoke('compile-cpp', code),
        // Expose the runPython function to the renderer process
        runPython: (scriptPath) => electron_1.ipcRenderer.invoke('run-python', scriptPath),
        // Code analysis and preprocessing
        analyzeCode: (code) => electron_1.ipcRenderer.invoke('analyze-code', code),
        // Java compilation
        compileBlocks: (blocksDir) => electron_1.ipcRenderer.invoke('compile-blocks', blocksDir),
        // GDB debugging
        startDebugging: (cppFile, breakpoints = []) => electron_1.ipcRenderer.invoke('start-debugging', cppFile, breakpoints),
        stopDebugging: () => {
            electron_1.ipcRenderer.send('stop-debugging');
        },
        // Debugging controls
        debugStepOver: () => {
            electron_1.ipcRenderer.send('debug-step-over');
        },
        debugStepInto: () => {
            electron_1.ipcRenderer.send('debug-step-into');
        },
        debugStepOut: () => {
            electron_1.ipcRenderer.send('debug-step-out');
        },
        debugContinue: () => {
            electron_1.ipcRenderer.send('debug-continue');
        },
        debugRun: () => {
            electron_1.ipcRenderer.send('debug-run');
        },
        // Breakpoint management
        setBreakpoint: (file, line) => electron_1.ipcRenderer.invoke('set-breakpoint', file, line),
        removeBreakpoint: (breakpointId) => electron_1.ipcRenderer.invoke('remove-breakpoint', breakpointId),
        // Variable evaluation
        evaluateExpression: (expression) => electron_1.ipcRenderer.invoke('evaluate-expression', expression),
        // Send debug command
        sendDebugCommand: (command) => {
            electron_1.ipcRenderer.send('debug-command', command);
        },
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
        // Register callback for analysis complete events
        onAnalysisComplete: (callback) => {
            analysisCallbacks.push(callback);
        },
        // Remove callback for analysis complete events
        offAnalysisComplete: (callback) => {
            analysisCallbacks = analysisCallbacks.filter(cb => cb !== callback);
        },
        // Register callback for debug output
        onDebugOutput: (callback) => {
            debugOutputCallbacks.push(callback);
        },
        // Remove callback for debug output
        offDebugOutput: (callback) => {
            debugOutputCallbacks = debugOutputCallbacks.filter(cb => cb !== callback);
        },
        // Register callback for compilation results
        onCompilationComplete: (callback) => {
            compilationCallbacks.push(callback);
        },
        // Remove callback for compilation results
        offCompilationComplete: (callback) => {
            compilationCallbacks = compilationCallbacks.filter(cb => cb !== callback);
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
}
//# sourceMappingURL=preload.js.map