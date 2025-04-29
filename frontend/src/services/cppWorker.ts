import { expose } from 'comlink';

// Define the Emscripten Module interface
declare global {
  interface EmscriptenModule {
    cwrap: (name: string, returnType: string | null, argTypes: string[]) => Function;
    callMain: (args: string[]) => number;
    FS: {
      writeFile: (path: string, data: string | Uint8Array, options?: object) => void;
      readFile: (path: string, options?: { encoding?: string }) => string | Uint8Array;
      mkdir: (path: string) => void;
      rmdir: (path: string) => void;
      unlink: (path: string) => void;
    };
    print: (text: string) => void;
    printErr: (text: string) => void;
  }

  interface Window {
    Module: EmscriptenModule;
  }
}

// Worker implementation
const worker = {
  async initialize(): Promise<void> {
    try {
      // Load the Emscripten module
      await new Promise<void>((resolve, reject) => {
        // Create a script element to load the Emscripten JavaScript
        const script = document.createElement('script');
        script.src = '/emscripten/cpp-compiler.js'; // Path to your Emscripten JS file
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Emscripten module'));
        document.body.appendChild(script);
        
        // Configure the Module
        window.Module = {
          print: (text) => console.log(text),
          printErr: (text) => console.error(text),
          onRuntimeInitialized: () => {
            console.log('Emscripten runtime initialized');
            resolve();
          }
        };
      });
      
      console.log('Emscripten module loaded successfully');
    } catch (error) {
      console.error('Failed to initialize Emscripten in worker:', error);
      throw new Error('Failed to initialize C++ compiler in worker');
    }
  },
  
  async compileAndRun(code: string): Promise<{ output: string; error: string | null; visualizationData?: any }> {
    try {
      let output = '';
      let errorOutput = '';
      
      // Capture stdout and stderr
      const originalPrint = window.Module.print;
      const originalPrintErr = window.Module.printErr;
      
      window.Module.print = (text) => {
        output += text + '\n';
        originalPrint(text);
      };
      
      window.Module.printErr = (text) => {
        errorOutput += text + '\n';
        originalPrintErr(text);
      };
      
      // Write the C++ code to a file
      window.Module.FS.writeFile('/input.cpp', code);
      
      // Compile the code
      const compileResult = window.Module.callMain([
        'g++', '-std=c++17', '-o', '/output.js', '/input.cpp'
      ]);
      
      if (compileResult !== 0) {
        return { 
          output: '', 
          error: 'Compilation failed:\n' + errorOutput 
        };
      }
      
      // Run the compiled code
      window.Module.callMain(['/output.js']);
      
      // Restore original print functions
      window.Module.print = originalPrint;
      window.Module.printErr = originalPrintErr;
      
      // Generate simple visualization data
      const visualizationData = {
        executionSteps: output.split('\n').map((line, index) => ({
          step: index + 1,
          output: line,
          lineNumber: this.mapOutputToSourceLine(line, code)
        }))
      };
      
      return { 
        output, 
        error: errorOutput.length > 0 ? errorOutput : null,
        visualizationData
      };
    } catch (error) {
      console.error('Error in compileAndRun:', error);
      return { 
        output: '', 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  },
  
  // Helper method to map output lines to source code lines (simplified)
  mapOutputToSourceLine(outputLine: string, sourceCode: string): number {
    // This is a simplified implementation
    // In a real implementation, you would use debug information from Emscripten
    const lines = sourceCode.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('cout') && outputLine.trim().length > 0) {
        return i + 1;
      }
    }
    return 1; // Default to line 1 if no match found
  }
};

expose(worker);
