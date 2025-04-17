import React, { useState, useEffect } from 'react';
import DualModePanel from './DualModePanel';
import OutputPanel from './OutputPanel';

interface CompilationResult {
  success: boolean;
  output: string;
  visualizationData?: any;
  error?: string;
}

const CodeCompiler: React.FC = () => {
  const [code, setCode] = useState<string>('// Online C++ compiler to run C++ program online\n#include <iostream>\n\nint main() {\n    // Write C++ code here\n    std::cout << "Hello World!";\n    \n    return 0;\n}');
  const [output, setOutput] = useState<string>('');
  const [visualizationData, setVisualizationData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showOutput, setShowOutput] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);

  const handleCodeChange = (value: string | undefined) => {
    setCode(value || '');
    // When code changes, we go back to editor mode
    if (showOutput) {
      setShowOutput(false);
    }
  };

  const handleRunCode = async () => {
    setIsLoading(true);
    setHasError(false);
    
    try {
      // In a real application, you would send the code to your backend
      // For now, we'll simulate a response after a delay
      setTimeout(() => {
        // Simulate a successful compilation and execution
        const result: CompilationResult = {
          success: true,
          output: 'Hello World!',
          visualizationData: { /* This would be data from visualizor.js */ }
        };

        if (result.success) {
          setOutput(result.output);
          setVisualizationData(result.visualizationData);
          setShowOutput(true);
        } else {
          setOutput(result.error || 'Unknown error occurred');
          setHasError(true);
          // Keep in editor mode if there's an error
          setShowOutput(false);
        }
        
        setIsLoading(false);
      }, 1500);
    } catch (error) {
      setOutput(`Error: ${error}`);
      setHasError(true);
      setShowOutput(false);
      setIsLoading(false);
    }
  };

  const handleClearOutput = () => {
    setOutput('');
    setShowOutput(false);
  };

  const handleEditCode = () => {
    setShowOutput(false);
  };

  // This effect would load the visualizor.js script when needed
  useEffect(() => {
    if (visualizationData) {
      // In a real application, you would load visualizor.js here
      // and initialize it with the visualization data
      console.log('Visualization data available:', visualizationData);
      
      // Example of loading an external script:
      // const script = document.createElement('script');
      // script.src = '/path/to/visualizor.js';
      // script.async = true;
      // document.body.appendChild(script);
      
      // return () => {
      //   document.body.removeChild(script);
      // };
    }
  }, [visualizationData]);

  return (
    <div className="code-compiler">
      <div className="toolbar">
        <h2>C++ Code Visualizer</h2>
        <div className="toolbar-actions">
          {showOutput && (
            <button className="edit-btn" onClick={handleEditCode}>
              Edit Code
            </button>
          )}
          <button 
            className={`run-btn ${isLoading ? 'disabled' : ''}`} 
            onClick={handleRunCode}
            disabled={isLoading}
          >
            {isLoading ? 'Running...' : 'Run'}
          </button>
        </div>
      </div>
      
      <div className="panels-container">
        <DualModePanel
          initialCode={code}
          output={output}
          isLoading={isLoading}
          onCodeChange={handleCodeChange}
          onClearOutput={handleClearOutput}
          showOutput={showOutput && !hasError}
        />
        
        <OutputPanel
          output=""
          isVisualizationPanel={true}
          visualizationData={visualizationData}
        />
      </div>
      
      {hasError && (
        <div className="error-overlay">
          <div className="error-content">
            <h3>Compilation/Runtime Error</h3>
            <pre>{output}</pre>
            <button onClick={() => setHasError(false)}>Dismiss</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CodeCompiler;