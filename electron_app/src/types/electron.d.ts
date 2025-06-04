/**
 * Type definitions for the Electron API exposed through preload.ts
 */
interface ElectronAPI {
  /**
   * Compile and run C++ code
   * @param code - String containing C++ code to compile and run
   * @returns Promise that resolves to the output (stdout) or error (stderr)
   */
  compileCpp: (code: string) => Promise<string>;
  
  /**
   * Run a Python script
   * @param scriptPath - Path to the Python script to execute
   * @returns Promise that resolves to the output (stdout) or error (stderr)
   */
  runPython: (scriptPath: string) => Promise<string>;
  
  /**
   * Analyze code
   * @param code - String containing code to analyze
   * @returns Promise that resolves to the analysis result
   */
  analyzeCode: (code: string) => Promise<string>;
  
  /**
   * Compile blocks
   * @param blocksDir - Directory containing blocks to compile
   * @returns Promise that resolves to the compilation result
   */
  compileBlocks: (blocksDir: string) => Promise<string>;
  
  /**
   * Start debugging
   * @param cppFile - Path to the C++ file to debug
   * @param breakpoints - Array of breakpoints to set
   * @returns Promise that resolves to the debugging result
   */
  startDebugging: (cppFile: string, breakpoints?: any[]) => Promise<string>;
  
  /**
   * Stop debugging
   */
  stopDebugging: () => void;
  
  /**
   * Debug step over
   */
  debugStepOver: () => void;
  
  /**
   * Debug step into
   */
  debugStepInto: () => void;
  
  /**
   * Debug step out
   */
  debugStepOut: () => void;
  
  /**
   * Debug continue
   */
  debugContinue: () => void;
  
  /**
   * Debug run
   */
  debugRun: () => void;
  
  /**
   * Set a breakpoint
   * @param file - Path to the file containing the breakpoint
   * @param line - Line number of the breakpoint
   * @returns Promise that resolves to the result of setting the breakpoint
   */
  setBreakpoint: (file: string, line: number) => Promise<string>;
  
  /**
   * Remove a breakpoint
   * @param breakpointId - ID of the breakpoint to remove
   * @returns Promise that resolves to the result of removing the breakpoint
   */
  removeBreakpoint: (breakpointId: number) => Promise<string>;
  
  /**
   * Evaluate an expression
   * @param expression - Expression to evaluate
   * @returns Promise that resolves to the evaluation result
   */
  evaluateExpression: (expression: string) => Promise<string>;
  
  /**
   * Send a debug command
   * @param command - Command to send
   */
  sendDebugCommand: (command: string) => void;
  
  /**
   * Register a callback to receive real-time output from the program
   * @param callback - Function to call when new output is available
   */
  onProgramOutput: (callback: (data: string) => void) => void;
  
  /**
   * Remove a callback for program output
   * @param callback - The callback function to remove
   */
  offProgramOutput: (callback: (data: string) => void) => void;
  
  /**
   * Register a callback for when the program finishes execution
   * @param callback - Function to call when the program completes
   */
  onProgramFinished: (callback: (code: number | null) => void) => void;
  
  /**
   * Remove a callback for program completion
   * @param callback - The callback function to remove
   */
  offProgramFinished: (callback: (code: number | null) => void) => void;
  
  /**
   * Register a callback for when input is required
   * @param callback - Function to call when input is required
   */
  onInputRequired: (callback: () => void) => void;
  
  /**
   * Remove a callback for input required
   * @param callback - The callback function to remove
   */
  offInputRequired: (callback: () => void) => void;
  
  /**
   * Register a callback for when analysis is complete
   * @param callback - Function to call with analysis data
   */
  onAnalysisComplete: (callback: (data: string) => void) => void;
  
  /**
   * Remove a callback for analysis complete
   * @param callback - The callback function to remove
   */
  offAnalysisComplete: (callback: (data: string) => void) => void;
  
  /**
   * Register a callback for when debugging output is available
   * @param callback - Function to call when new debugging output is available
   */
  onDebugOutput: (callback: (data: string) => void) => void;
  
  /**
   * Remove a callback for debugging output
   * @param callback - The callback function to remove
   */
  offDebugOutput: (callback: (data: string) => void) => void;
  
  /**
   * Register a callback for when compilation is complete
   * @param callback - Function to call with compilation data
   */
  onCompilationComplete: (callback: (data: any) => void) => void;
  
  /**
   * Remove a callback for compilation complete
   * @param callback - The callback function to remove
   */
  offCompilationComplete: (callback: (data: any) => void) => void;
  
  /**
   * Check if the process is waiting for input
   * @returns Promise that resolves to true if waiting for input
   */
  checkInputMode: () => Promise<boolean>;
  
  /**
   * Send user input to the running program
   * @param input - The input string to send
   */
  sendProgramInput: (input: string) => void;
  
  /**
   * Kill the currently running program
   */
  killRunningProcess: () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
} 