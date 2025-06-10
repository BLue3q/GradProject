import { contextBridge, ipcRenderer } from 'electron';

// Prevent multiple registrations if preload is executed multiple times
if ((globalThis as any).__electronAPIInitialized) {
  console.warn('ElectronAPI already initialized, skipping...');
} else {
  (globalThis as any).__electronAPIInitialized = true;

  // Store callback references
  type OutputCallback = (data: string) => void;
  type AnalysisCallback = (data: string) => void;
  type DebugCallback = (data: string) => void;
  type CompilationCallback = (data: any) => void;
  type ParseCompleteCallback = (data: { dataPath: string }) => void;

  let outputCallbacks: OutputCallback[] = [];
  let finishedCallbacks: ((code: number | null) => void)[] = [];
  let inputRequiredCallbacks: (() => void)[] = [];
  let analysisCallbacks: AnalysisCallback[] = [];
  let debugOutputCallbacks: DebugCallback[] = [];
  let compilationCallbacks: CompilationCallback[] = [];
  let parseCompleteCallbacks: ParseCompleteCallback[] = [];

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

  // Listen for parse complete events
  ipcRenderer.on('parse-complete', (_event, data: { dataPath: string }) => {
    // Call all registered callbacks with the parse completion data
    parseCompleteCallbacks.forEach(callback => callback(data));
  });

  // Listen for new analysis and debugging events
  ipcRenderer.on('analysis-progress', (_event, data: string) => {
    outputCallbacks.forEach(callback => callback(data));
  });

  ipcRenderer.on('code-analysis-complete', (_event, data: any) => {
    analysisCallbacks.forEach(callback => callback(JSON.stringify(data)));
  });

  ipcRenderer.on('compilation-progress', (_event, data: string) => {
    outputCallbacks.forEach(callback => callback(data));
  });

  ipcRenderer.on('compilation-complete', (_event, data: any) => {
    compilationCallbacks.forEach(callback => callback(data));
  });

  ipcRenderer.on('debug-output', (_event, data: string) => {
    debugOutputCallbacks.forEach(callback => callback(data));
  });

  ipcRenderer.on('debug-error', (_event, data: string) => {
    debugOutputCallbacks.forEach(callback => callback(`Error: ${data}`));
  });

  ipcRenderer.on('debug-session-ended', (_event, code: number | null) => {
    finishedCallbacks.forEach(callback => callback(code));
  });

  contextBridge.exposeInMainWorld('electronAPI', {
    // NEW: Save code and process pipeline
    saveAndProcess: (code: string): Promise<{ success: boolean; message: string; dataPath?: string }> => 
      ipcRenderer.invoke('save-and-process', code),
    
    // NEW: Code parsing for visualization
    parseCode: (code: string): Promise<{ success: boolean; message: string; dataPath?: string }> => 
      ipcRenderer.invoke('parse-code', code),
    
    // Expose the compileCpp function to the renderer process
    compileCpp: (code: string): Promise<string> => ipcRenderer.invoke('compile-cpp', code),
    
    // Expose the runPython function to the renderer process
    runPython: (scriptPath: string): Promise<string> => ipcRenderer.invoke('run-python', scriptPath),
    
    // Code analysis and preprocessing
    analyzeCode: (code: string): Promise<string> => ipcRenderer.invoke('analyze-code', code),
    
    // Java compilation
    compileBlocks: (blocksDir: string): Promise<string> => ipcRenderer.invoke('compile-blocks', blocksDir),
    
    // GDB debugging
    startDebugging: (cppFile: string, breakpoints: any[] = []): Promise<string> => 
      ipcRenderer.invoke('start-debugging', cppFile, breakpoints),
    
    stopDebugging: (): void => {
      ipcRenderer.send('stop-debugging');
    },
    
    // Debugging controls
    debugStepOver: (): void => {
      ipcRenderer.send('debug-step-over');
    },
    
    debugStepInto: (): void => {
      ipcRenderer.send('debug-step-into');
    },
    
    debugStepOut: (): void => {
      ipcRenderer.send('debug-step-out');
    },
    
    debugContinue: (): void => {
      ipcRenderer.send('debug-continue');
    },
    
    debugRun: (): void => {
      ipcRenderer.send('debug-run');
    },
    
    // Breakpoint management
    setBreakpoint: (file: string, line: number): Promise<string> => 
      ipcRenderer.invoke('set-breakpoint', file, line),
    
    removeBreakpoint: (breakpointId: number): Promise<string> => 
      ipcRenderer.invoke('remove-breakpoint', breakpointId),
    
    // Variable evaluation
    evaluateExpression: (expression: string): Promise<string> => 
      ipcRenderer.invoke('evaluate-expression', expression),
    
    // Send debug command
    sendDebugCommand: (command: string): void => {
      ipcRenderer.send('debug-command', command);
    },
    
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
    
    // Register callback for debug output
    onDebugOutput: (callback: DebugCallback): void => {
      debugOutputCallbacks.push(callback);
    },
    
    // Remove callback for debug output
    offDebugOutput: (callback: DebugCallback): void => {
      debugOutputCallbacks = debugOutputCallbacks.filter(cb => cb !== callback);
    },
    
    // Register callback for compilation results
    onCompilationComplete: (callback: CompilationCallback): void => {
      compilationCallbacks.push(callback);
    },
    
    // Remove callback for compilation results
    offCompilationComplete: (callback: CompilationCallback): void => {
      compilationCallbacks = compilationCallbacks.filter(cb => cb !== callback);
    },
    
    // NEW: Register callback for parse complete events
    onParseComplete: (callback: ParseCompleteCallback): void => {
      parseCompleteCallbacks.push(callback);
    },
    
    // NEW: Remove callback for parse complete events
    offParseComplete: (callback: ParseCompleteCallback): void => {
      parseCompleteCallbacks = parseCompleteCallbacks.filter(cb => cb !== callback);
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
}
