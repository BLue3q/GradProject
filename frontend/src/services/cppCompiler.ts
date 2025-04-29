import { wrap } from 'comlink';

interface CompilerResult {
  output: string;
  error: string | null;
  executionTime: number;
  visualizationData?: any;
}

interface CppWorker {
  initialize(): Promise<void>;
  compileAndRun(code: string): Promise<{ output: string; error: string | null; visualizationData?: any }>;
}

class CppCompiler {
  private worker: Worker | null = null;
  private workerProxy: CppWorker | null = null;
  private isInitialized = false;

  async initialize() {
    if (this.isInitialized) return;
    
    try {
      // Create a Web Worker for compilation
      this.worker = new Worker(new URL('./cppWorker.ts', import.meta.url), { type: 'module' });
      this.workerProxy = wrap<CppWorker>(this.worker);
      
      if (!this.workerProxy) {
        throw new Error('Failed to create worker proxy');
      }
      
      await this.workerProxy.initialize();
      this.isInitialized = true;
      console.log('C++ compiler initialized successfully');
    } catch (error) {
      console.error('Failed to initialize C++ compiler:', error);
      throw new Error('Failed to initialize C++ compiler');
    }
  }

  async compileAndRun(code: string): Promise<CompilerResult> {
    if (!this.isInitialized || !this.workerProxy) {
      await this.initialize();
    }

    if (!this.workerProxy) {
      throw new Error('Worker proxy not initialized');
    }

    try {
      const startTime = performance.now();
      const result = await this.workerProxy.compileAndRun(code);
      const executionTime = performance.now() - startTime;

      return {
        output: result.output,
        error: result.error,
        executionTime,
        visualizationData: result.visualizationData
      };
    } catch (error) {
      return {
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        executionTime: 0
      };
    }
  }

  cleanup() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.workerProxy = null;
      this.isInitialized = false;
    }
  }
}

export const cppCompiler = new CppCompiler();