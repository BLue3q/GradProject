import { contextBridge, ipcRenderer } from 'electron';

// Store callback references
type OutputCallback = (data: string) => void;
type AnalysisCallback = (data: string) => void;
let outputCallbacks: OutputCallback[] = [];
let finishedCallbacks: ((code: number | null) => void)[] = [];
let inputRequiredCallbacks: (() => void)[] = [];
let analysisCallbacks: AnalysisCallback[] = [];

// Listen for program output events from the main process
ipcRenderer.on('program-output', (_event, data: string) => {
  // Call all registered callbacks with the output data
  outputCallbacks.forEach(callback => callback(data));
});

// Listen for program finished events
ipcRenderer.on('program-finished', (_event, code: number | null) => {
  // Call all registered callbacks with the exit code
  finishedCallbacks.forEach(callback => callback(code));
});

// Listen for input required events
ipcRenderer.on('input-required', () => {
  // Call all registered callbacks to notify that input is required
  inputRequiredCallbacks.forEach(callback => callback());
});

// Listen for analysis complete events
ipcRenderer.on('analysis-complete', (_event, data: string) => {
  // Call all registered callbacks with the analysis data
  analysisCallbacks.forEach(callback => callback(data));
});

contextBridge.exposeInMainWorld('electronAPI', {
  // Expose the compileCpp function to the renderer process
  compileCpp: (code: string): Promise<string> => ipcRenderer.invoke('compile-cpp', code),
  
  // Expose the runPython function to the renderer process
  runPython: (scriptPath: string): Promise<string> => ipcRenderer.invoke('run-python', scriptPath),
  
  // Register callback for real-time program output
  onProgramOutput: (callback: OutputCallback): void => {
    outputCallbacks.push(callback);
  },
  
  // Remove callback for program output
  offProgramOutput: (callback: OutputCallback): void => {
    outputCallbacks = outputCallbacks.filter(cb => cb !== callback);
  },
  
  // Register callback for program completion
  onProgramFinished: (callback: (code: number | null) => void): void => {
    finishedCallbacks.push(callback);
  },
  
  // Remove callback for program completion
  offProgramFinished: (callback: (code: number | null) => void): void => {
    finishedCallbacks = finishedCallbacks.filter(cb => cb !== callback);
  },
  
  // Register callback for input required events
  onInputRequired: (callback: () => void): void => {
    inputRequiredCallbacks.push(callback);
  },
  
  // Remove callback for input required events
  offInputRequired: (callback: () => void): void => {
    inputRequiredCallbacks = inputRequiredCallbacks.filter(cb => cb !== callback);
  },
  
  // Register callback for analysis complete events
  onAnalysisComplete: (callback: AnalysisCallback): void => {
    analysisCallbacks.push(callback);
  },
  
  // Remove callback for analysis complete events
  offAnalysisComplete: (callback: AnalysisCallback): void => {
    analysisCallbacks = analysisCallbacks.filter(cb => cb !== callback);
  },
  
  // Check if the process is waiting for input
  checkInputMode: (): Promise<boolean> => ipcRenderer.invoke('check-input-mode'),
  
  // Send user input to the running program
  sendProgramInput: (input: string): void => {
    ipcRenderer.send('send-program-input', input);
  },
  
  // Kill the running process
  killRunningProcess: (): void => {
    ipcRenderer.send('kill-running-process');
  }
});
