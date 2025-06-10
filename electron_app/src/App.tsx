import { useState, useEffect, useRef } from 'react'
import CodeEditor from './components/CodeEditor'
import SimpleOutputPanel from './components/SimpleOutputPanel'
import VisualizationPanel from './components/VisualizationPanel'
import ErrorBoundary from './components/ErrorBoundary'
import './App.css'

console.log('✅ App.tsx loaded - React app is running');

function App() {
  const [code, setCode] = useState(`#include <iostream>
struct Node {
    int data;
    Node* next;
    
    Node(int value) : data(value), next(nullptr) {}
};

int main() {
    // Create linked list nodes on heap
    Node* head = new Node(10);
    Node* second = new Node(20);
    Node* third = new Node(30);
    
    // Link the nodes together
    head->next = second;
    second->next = third;
    
    // Create another linked list
    Node* list2 = new Node(100);
    Node* list2_second = new Node(200);
    list2->next = list2_second;
    
    // Traverse and process (cout statements will be auto-removed for parsing)
    Node* current = head;
    int sum = 0;
    while (current != nullptr) {
        sum += current->data;
        current = current->next;
    }
    
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
  
  // Add ref for triggering visualization
  const triggerVisualization = useRef<((data: any) => void) | null>(null);

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
          console.log('📥 Received output data:', data);
          setOutput(prev => {
            const newOutput = prev + data;
            console.log('📝 Updated output state:', newOutput);
            return newOutput;
          });
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
          console.log('🐛 Received debug output:', data);
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
      
      // Add debugging to track output state
      console.log('🚀 Starting compilation, output cleared');
      
      if (window.electronAPI) {
        try {
          const result = await window.electronAPI.compileCpp(code);
          
          console.log('📊 Compilation result:', result);
          console.log('📺 Current output state:', output);
          
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

  // Save and process handler (currently unused but available for manual triggering)
  // const handleSaveAndProcess = async (code: string) => {
  //   if (!window.electronAPI) {
  //     setOutput('Electron API not available');
  //     return;
  //   }

  //   setIsAnalyzing(true);
  //   setHasError(false);
  //   setOutput('Starting save and process pipeline...\n');

  //   try {
  //     const result = await (window.electronAPI as any).saveAndProcess(code);
      
  //     if (result.success) {
  //       setOutput(prev => prev + `Pipeline completed successfully!\n`);
  //       setOutput(prev => prev + `Results saved to: ${result.dataPath}\n`);
        
  //       // Trigger visualization if data is available
  //       if (analysisData && triggerVisualization.current) {
  //         console.log('🎨 Triggering visualization after save-and-process:', analysisData);
  //         triggerVisualization.current(analysisData);
  //       }
  //     } else {
  //       setOutput(prev => prev + `Pipeline failed: ${result.message}\n`);
  //       setHasError(true);
  //     }
  //   } catch (error) {
  //     const errorMessage = error instanceof Error ? error.message : String(error);
  //     setOutput(prev => prev + `Save and process error: ${errorMessage}\n`);
  //     setHasError(true);
  //   } finally {
  //     setIsAnalyzing(false);
  //   }
  // };

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
      
      // Check for specific import errors
      if (typeof result === 'string' && result.includes('cannot import name')) {
        setOutput(prev => prev + `Analysis Error: ${result}\n\nThis indicates a parser module issue. Check that:\n- backend/myparser.py exports parse_cpp_code function\n- All required dependencies are installed\n- Parser files are syntactically correct\n`);
        setHasError(true);
        return;
      }
      
      setOutput(prev => prev + result + '\n');
      
      // Trigger visualization if analysis was successful and data is available
      if (analysisData && triggerVisualization.current) {
        console.log('🎨 Triggering visualization with analysis data:', analysisData);
        triggerVisualization.current(analysisData);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Provide specific guidance for common errors
      let specificGuidance = '';
      if (errorMessage.includes('parse_cpp_code')) {
        specificGuidance = '\n\n🔧 Parser Function Missing:\n- Check that myparser.py contains parse_cpp_code function\n- Verify function is properly exported\n- Ensure no syntax errors in parser files';
      } else if (errorMessage.includes('import')) {
        specificGuidance = '\n\n🔧 Import Error:\n- Check Python module paths\n- Verify all dependencies are installed\n- Check for circular imports';
      }
      
      setOutput(prev => prev + `Analysis Error: ${errorMessage}${specificGuidance}\n`);
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

  // Handle visualization trigger registration
  const handleVisualizationTrigger = (triggerFn: (data: any) => void) => {
    triggerVisualization.current = triggerFn;
  };

  // New auto-analysis handler
  const handleAutoAnalyze = async (code: string) => {
    console.log('🔄 Auto-analysis triggered for code length:', code.length);
    
    // Skip analysis for very short code or empty code
    if (!code.trim() || code.trim().length < 10) {
      console.log('⏭️ Skipping auto-analysis for short/empty code');
      return;
    }

    if (!window.electronAPI) {
      console.warn('⚠️ Electron API not available for auto-analysis');
      return;
    }

    // Prevent multiple simultaneous analyses
    if (isAnalyzing) {
      console.log('⏭️ Analysis already in progress, skipping auto-analysis');
      return;
    }

    setIsAnalyzing(true);
    console.log('🎯 Starting automatic analysis...');

    try {
      // Use the saveAndProcess function for complete pipeline
      const result = await (window.electronAPI as any).saveAndProcess(code);
      
      if (result.success) {
        console.log('✅ Auto-analysis completed successfully');
        console.log('📊 Analysis result:', result);
        
        // The analysisData will be updated via handleAnalysisComplete callback
        // Trigger visualization if data becomes available
        setTimeout(() => {
          if (analysisData && triggerVisualization.current) {
            console.log('🎨 Auto-triggering visualization after analysis:', analysisData);
            triggerVisualization.current(analysisData);
          }
        }, 500); // Small delay to ensure analysisData is updated
      } else {
        console.warn('⚠️ Auto-analysis failed:', result.message);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Auto-analysis error:', errorMessage);
    } finally {
      setIsAnalyzing(false);
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
          {/* Left Side: Code Editor + Terminal */}
          <div className="left-section">
            {/* Code Editor - Top Left */}
            <div className="code-editor-panel">
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
                  onAutoAnalyze={handleAutoAnalyze}
                />
              </div>
            </div>
            
            {/* Output Panel - Bottom Left */}
            <div className="output-panel">
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
                <SimpleOutputPanel 
                  output={output} 
                  isLoading={isCompiling || isAnalyzing} 
                  hasError={hasError} 
                />
              </div>
            </div>
          </div>
          
          {/* Right Side: Visualization Panel */}
          <div className="right-section">
            <div className="visualization-panel">
              <div className="panel-header">
                <h2>Visualization & Tools</h2>
              </div>
              <div className="panel-content">
                <VisualizationPanel 
                  analysisData={safeAnalysisData}
                  compilationData={safeCompilationData}
                  isDebugging={isDebugging}
                  onVisualizationTrigger={handleVisualizationTrigger}
                />
              </div>
            </div>
          </div>
        </main>
      </div>
    </ErrorBoundary>
  )
}

export default App
