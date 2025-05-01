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
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
} 