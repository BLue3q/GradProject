/**
 * Type definitions for the Electron API exposed through preload.ts
 */
export interface ElectronAPI {
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
    electronAPI: ElectronAPI;
  }
} 