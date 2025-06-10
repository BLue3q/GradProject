import { useState, useEffect, useRef } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
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
      // Pass the actual code to the debugger, which will create a temporary file
      const result = await (window.electronAPI as any).startDebugging(code, breakpoints);
      setOutput(prev => prev + `Debug session result: ${result}\n`);
      
      if (result !== 'debugging-started') {
        setIsDebugging(false);
      }
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
      // Use the same temporary file name that will be created during debugging
      const result = await (window.electronAPI as any).setBreakpoint('debug_temp.cpp', line);
      setBreakpoints(prev => [...prev, { line, file: 'debug_temp.cpp' }]);
      setOutput(prev => prev + result + '\n');
    } catch (error) {
      setOutput(prev => prev + `Breakpoint error: ${error}\n`);
    }
  };

  return (
    <ErrorBoundary onError={handleError}>
      <div className="app-container">
        {/* Header */}
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
        
        {/* Main Content with Resizable Panels */}
        <main className="app-main-resizable">
          <PanelGroup direction="horizontal" className="panel-group">
            {/* Left Side: Code Editor + Terminal */}
            <Panel defaultSize={60} minSize={30} className="left-panel-resizable">
              <PanelGroup direction="vertical" className="left-panel-group">
                {/* Code Editor - Top */}
                <Panel defaultSize={70} minSize={40} className="code-editor-panel-resizable">
                  <div className="panel-wrapper">
                    <div className="panel-header">
                      <h2>Code Editor</h2>
                      {analysisData && (
                        <span className="blocks-info">
                          {analysisData.summary?.total_blocks || 0} blocks analyzed
                        </span>
                      )}
                    </div>
                    <div className="panel-content">
                      <CodeEditor 
                        initialCode={code} 
                        onChange={handleCodeChange}
                        breakpoints={breakpoints}
                        onSetBreakpoint={handleSetBreakpoint}
                      />
                    </div>
                  </div>
                </Panel>
                
                {/* Resize Handle */}
                <PanelResizeHandle className="resize-handle horizontal-handle">
                  <div className="resize-handle-line" />
                </PanelResizeHandle>
                
                {/* Terminal - Bottom */}
                <Panel defaultSize={30} minSize={15} className="output-panel-resizable">
                  <div className="panel-wrapper">
                    <div className="panel-header">
                      <h2>Terminal</h2>
                      {compilationData && (
                        <span className="compilation-info">
                          {compilationData.summary?.successful_compilations || 0}/
                          {compilationData.summary?.total_blocks || 0} blocks compiled
                        </span>
                      )}
                    </div>
                    <div className="panel-content">
                      <OutputPanel 
                        output={output} 
                        isLoading={isCompiling || isAnalyzing} 
                        hasError={hasError} 
                      />
                    </div>
                  </div>
                </Panel>
              </PanelGroup>
            </Panel>
            
            {/* Vertical Resize Handle */}
            <PanelResizeHandle className="resize-handle vertical-handle">
              <div className="resize-handle-line" />
            </PanelResizeHandle>
            
            {/* Right Side: Visualization Panel */}
            <Panel defaultSize={40} minSize={25} className="visualization-panel-resizable">
              <div className="panel-wrapper">
                <div className="panel-header">
                  <h2>Visualization & Tools</h2>
                </div>
                <div className="panel-content">
                  <VisualizationPanel 
                    analysisData={safeAnalysisData}
                    compilationData={safeCompilationData}
                    isDebugging={isDebugging}
                  />
                </div>
              </div>
            </Panel>
          </PanelGroup>
        </main>
      </div>
    </ErrorBoundary>
  )
}

export default App 