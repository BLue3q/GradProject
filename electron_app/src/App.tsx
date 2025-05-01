import { useState } from 'react'
import CodeEditor from './components/CodeEditor'
import OutputPanel from './components/OutputPanel'
import VisualizationPanel from './components/VisualizationPanel'
import './App.css'

function App() {
  const [code, setCode] = useState<string>(`#include <iostream>

int main() {
    std::cout << "Hello, C++ Visualizer!" << std::endl;
    return 0;
}`);
  const [output, setOutput] = useState<string>('');
  const [isCompiling, setIsCompiling] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);

  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
  };

  const handleCompileAndRun = async () => {
    setIsCompiling(true);
    setHasError(false);
    
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.compileCpp(code);
        setOutput(result);
        setHasError(result.includes('Error') || result.includes('error'));
      } else {
        // Fallback when running outside of Electron
        console.warn('Electron API not available - running in browser mode');
        setTimeout(() => {
          setOutput('Hello, C++ Visualizer!');
        }, 1000);
      }
    } catch (error) {
      setOutput(`Error: ${error instanceof Error ? error.message : String(error)}`);
      setHasError(true);
    } finally {
      setIsCompiling(false);
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>C++ Code Visualizer</h1>
        <button 
          className="run-button" 
          onClick={handleCompileAndRun}
          disabled={isCompiling}
        >
          {isCompiling ? 'Compiling...' : 'Run Code'}
        </button>
      </header>
      
      <main className="app-main">
        <div className="left-panel">
          <div className="panel-header">
            <h2>Code Editor</h2>
          </div>
          <CodeEditor 
            initialCode={code} 
            onChange={handleCodeChange} 
          />
        </div>
        
        <div className="right-panels">
          <div className="top-panel">
            <div className="panel-header">
              <h2>Output</h2>
            </div>
            <OutputPanel 
              output={output} 
              isLoading={isCompiling} 
              hasError={hasError} 
            />
          </div>
          
          <div className="bottom-panel">
            <div className="panel-header">
              <h2>Visualization</h2>
            </div>
            <VisualizationPanel />
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
