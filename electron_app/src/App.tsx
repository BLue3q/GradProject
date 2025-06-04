import { useState, useEffect, useRef } from 'react'
import CodeEditor from './components/CodeEditor'
import OutputPanel from './components/OutputPanel'
import VisualizationPanel from './components/VisualizationPanel'
import ErrorBoundary from './components/ErrorBoundary'
import './App.css'

function App() {
  const [code, setCode] = useState<string>(`#include <iostream>

int main() {
    std::cout << "Hello, C++ Visualizer!" << std::endl;
    return 0;
}`);
  const [output, setOutput] = useState<string>('');
  const [isCompiling, setIsCompiling] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isDebugging, setIsDebugging] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [compilationData, setCompilationData] = useState<any>(null);
  const [currentBlocksDir, setCurrentBlocksDir] = useState<string>('');
  const [breakpoints, setBreakpoints] = useState<Array<{line: number, file: string}>>([]);
  
  // Ref to track if listeners are registered to prevent duplicates
  const listenersRegistered = useRef<boolean>(false);
  const lastRunTime = useRef<number>(0);
  const initializationComplete = useRef<boolean>(false);

  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
  };

  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    console.error('React Error:', error, errorInfo);
    setOutput(prev => prev + `\nReact Error: ${error.message}\n`);
    setHasError(true);
  };

  // Safe helper functions for data access
  const safeAnalysisData = analysisData || null;
  const safeCompilationData = compilationData || null;

  useEffect(() => {
    // Prevent multiple registrations using ref
    if (window.electronAPI && !listenersRegistered.current && !initializationComplete.current) {
      const api = window.electronAPI as any; // Type assertion to fix TS errors
      
      const handleOutput = (data: string) => {
        try {
          setOutput(prev => prev + data);
        } catch (error) {
          console.error('Error updating output:', error);
        }
      };

      const handleAnalysisComplete = (data: string) => {
        try {
          if (!data || typeof data !== 'string') {
            console.error('Invalid analysis data received:', data);
            setOutput(prev => prev + '\nError: Invalid analysis data received\n');
            setHasError(true);
            return;
          }
          
          const parsedData = JSON.parse(data);
          if (!parsedData || typeof parsedData !== 'object') {
            console.error('Parsed analysis data is not valid:', parsedData);
            setOutput(prev => prev + '\nError: Invalid analysis data format\n');
            setHasError(true);
            return;
          }
          
          setAnalysisData(parsedData);
          setCurrentBlocksDir(parsedData.blocksDir || '');
        } catch (e) {
          console.error('Failed to parse analysis data:', e);
          setOutput(prev => prev + `\nError parsing analysis data: ${e}\n`);
          setHasError(true);
        }
      };

      const handleCompilationComplete = (data: any) => {
        try {
          if (!data || typeof data !== 'object') {
            console.error('Invalid compilation data received:', data);
            setOutput(prev => prev + '\nError: Invalid compilation data received\n');
            return;
          }
          
          setCompilationData(data);
        } catch (error) {
          console.error('Error handling compilation data:', error);
          setOutput(prev => prev + `\nError handling compilation: ${error}\n`);
        }
      };

      const handleDebugOutput = (data: string) => {
        try {
          setOutput(prev => prev + data);
        } catch (error) {
          console.error('Error updating debug output:', error);
        }
      };

      // Register callbacks - only once
      try {
        console.log('Registering event listeners');
        api.onProgramOutput(handleOutput);
        api.onAnalysisComplete(handleAnalysisComplete);
        api.onCompilationComplete(handleCompilationComplete);
        api.onDebugOutput(handleDebugOutput);
        listenersRegistered.current = true;
        initializationComplete.current = true;
      } catch (error) {
        console.error('Error registering callbacks:', error);
        setOutput(prev => prev + `\nError setting up callbacks: ${error}\n`);
      }

      // Cleanup function
      return () => {
        try {
          if (window.electronAPI && listenersRegistered.current) {
            console.log('Cleaning up event listeners');
            const cleanupApi = window.electronAPI as any;
            cleanupApi.offProgramOutput?.(handleOutput);
            cleanupApi.offAnalysisComplete?.(handleAnalysisComplete);
            cleanupApi.offCompilationComplete?.(handleCompilationComplete);
            cleanupApi.offDebugOutput?.(handleDebugOutput);
            listenersRegistered.current = false;
          }
        } catch (error) {
          console.error('Error during cleanup:', error);
        }
      };
    }
  }, []); // Empty dependency array to run only once

  const handleCompileAndRun = async () => {
    // Prevent multiple simultaneous runs
    if (isCompiling) {
      console.log('Compilation already in progress, ignoring request');
      return;
    }

    // Debounce rapid clicks (prevent clicks within 1 second)
    const now = Date.now();
    if (now - lastRunTime.current < 1000) {
      console.log('Too soon since last run, ignoring request');
      return;
    }
    lastRunTime.current = now;

    try {
      // If there's a running program, kill it first
      if (window.electronAPI && (window.electronAPI as any).killRunningProcess) {
        (window.electronAPI as any).killRunningProcess();
      }

      setIsCompiling(true);
      setHasError(false);
      setOutput(''); // Clear previous output completely
      
      if (window.electronAPI) {
        try {
          const result = await window.electronAPI.compileCpp(code);
          
          // Handle different status results
          switch (result) {
            case 'execution-completed':
              // Success - output was already sent via real-time events
              setHasError(false);
              break;
            case 'compilation-failed':
            case 'execution-failed':
            case 'spawn-failed':
            case 'system-error':
              // Error cases - errors were already sent via real-time events
              setHasError(true);
              break;
            default:
              // Legacy fallback for any unexpected return values
              if (result.includes('Error') || result.includes('error')) {
                setHasError(true);
              }
              break;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          setOutput(prev => prev + `\n[System] Compilation failed: ${errorMessage}\n`);
          setHasError(true);
          console.error('Compilation error:', error);
        }
      } else {
        // Fallback when running outside of Electron
        console.warn('Electron API not available - running in browser mode');
        setOutput('Electron API not available - running in development mode\n');
        setHasError(true);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setOutput(prev => prev + `\n[System] System Error: ${errorMessage}\n`);
      setHasError(true);
      console.error('System error:', error);
    } finally {
      setIsCompiling(false);
    }
  };

  const handleAnalyzeCode = async () => {
    if (!window.electronAPI) {
      setOutput('Electron API not available');
      return;
    }

    setIsAnalyzing(true);
    setHasError(false);
    setOutput('Starting code analysis...\n');

    try {
      const result = await (window.electronAPI as any).analyzeCode(code);
      setOutput(prev => prev + result + '\n');
    } catch (error) {
      setOutput(prev => prev + `Analysis error: ${error instanceof Error ? error.message : String(error)}\n`);
      setHasError(true);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCompileBlocks = async () => {
    if (!window.electronAPI || !currentBlocksDir) {
      setOutput('No blocks directory available. Please analyze code first.\n');
      return;
    }

    setIsCompiling(true);
    setOutput(prev => prev + 'Starting Java compilation of code blocks...\n');

    try {
      const result = await (window.electronAPI as any).compileBlocks(currentBlocksDir);
      setOutput(prev => prev + result + '\n');
    } catch (error) {
      setOutput(prev => prev + `Compilation error: ${error instanceof Error ? error.message : String(error)}\n`);
      setHasError(true);
    } finally {
      setIsCompiling(false);
    }
  };

  const handleStartDebugging = async () => {
    if (!window.electronAPI) {
      setOutput('Electron API not available');
      return;
    }

    setIsDebugging(true);
    setOutput(prev => prev + 'Starting debugging session...\n');

    try {
      // For now, we'll create a temporary file with the current code
      // In a real implementation, you might want to save this properly
      const result = await (window.electronAPI as any).startDebugging('temp.cpp', breakpoints);
      setOutput(prev => prev + result + '\n');
    } catch (error) {
      setOutput(prev => prev + `Debug error: ${error instanceof Error ? error.message : String(error)}\n`);
      setHasError(true);
      setIsDebugging(false);
    }
  };

  const handleStopDebugging = () => {
    if (window.electronAPI && isDebugging) {
      (window.electronAPI as any).stopDebugging();
      setIsDebugging(false);
      setOutput(prev => prev + 'Debugging session ended.\n');
    }
  };

  const handleDebugStep = (stepType: string) => {
    if (!window.electronAPI || !isDebugging) return;

    const api = window.electronAPI as any;

    switch (stepType) {
      case 'over':
        api.debugStepOver();
        break;
      case 'into':
        api.debugStepInto();
        break;
      case 'out':
        api.debugStepOut();
        break;
      case 'continue':
        api.debugContinue();
        break;
      case 'run':
        api.debugRun();
        break;
    }
  };

  const handleSetBreakpoint = async (line: number) => {
    if (!window.electronAPI) return;

    try {
      const result = await (window.electronAPI as any).setBreakpoint('temp.cpp', line);
      setBreakpoints(prev => [...prev, { line, file: 'temp.cpp' }]);
      setOutput(prev => prev + result + '\n');
    } catch (error) {
      setOutput(prev => prev + `Breakpoint error: ${error}\n`);
    }
  };

  return (
    <ErrorBoundary onError={handleError}>
      <div className="app-container">
        <header className="app-header">
          <h1>C++ Code Visualizer</h1>
          <div className="button-group">
            <button 
              className="run-button" 
              onClick={handleCompileAndRun}
              disabled={isCompiling || isAnalyzing || isDebugging}
            >
              {isCompiling ? 'Compiling...' : 'Run Code'}
            </button>
            
            <button 
              className="analyze-button" 
              onClick={handleAnalyzeCode}
              disabled={isCompiling || isAnalyzing || isDebugging}
            >
              {isAnalyzing ? 'Analyzing...' : 'Analyze'}
            </button>
            
            <button 
              className="compile-blocks-button" 
              onClick={handleCompileBlocks}
              disabled={isCompiling || isAnalyzing || isDebugging || !currentBlocksDir}
            >
              Compile Blocks
            </button>
            
            {!isDebugging ? (
              <button 
                className="debug-button" 
                onClick={handleStartDebugging}
                disabled={isCompiling || isAnalyzing || isDebugging}
              >
                Start Debug
              </button>
            ) : (
              <button 
                className="debug-stop-button" 
                onClick={handleStopDebugging}
              >
                Stop Debug
              </button>
            )}
          </div>
          
          {isDebugging && (
            <div className="debug-controls">
              <button onClick={() => handleDebugStep('run')}>Run</button>
              <button onClick={() => handleDebugStep('continue')}>Continue</button>
              <button onClick={() => handleDebugStep('over')}>Step Over</button>
              <button onClick={() => handleDebugStep('into')}>Step Into</button>
              <button onClick={() => handleDebugStep('out')}>Step Out</button>
            </div>
          )}
        </header>
        
        <main className="app-main">
          <div className="left-panel">
            <div className="panel-header">
              <h2>Code Editor</h2>
              {analysisData && (
                <span className="blocks-info">
                  {analysisData.summary?.total_blocks || 0} blocks analyzed
                </span>
              )}
            </div>
            <CodeEditor 
              initialCode={code} 
              onChange={handleCodeChange}
              breakpoints={breakpoints}
              onSetBreakpoint={handleSetBreakpoint}
            />
          </div>
          
          <div className="right-panels">
            <div className="top-panel">
              <div className="panel-header">
                <h2>Output</h2>
                {compilationData && (
                  <span className="compilation-info">
                    {compilationData.summary?.successful_compilations || 0}/
                    {compilationData.summary?.total_blocks || 0} blocks compiled
                  </span>
                )}
              </div>
              <OutputPanel 
                output={output} 
                isLoading={isCompiling || isAnalyzing} 
                hasError={hasError} 
              />
            </div>
            
            <div className="bottom-panel">
              <div className="panel-header">
                <h2>Visualization</h2>
              </div>
              <VisualizationPanel 
                analysisData={safeAnalysisData}
                compilationData={safeCompilationData}
                isDebugging={isDebugging}
              />
            </div>
          </div>
        </main>
      </div>
    </ErrorBoundary>
  )
}

export default App
