import React from 'react';

interface OutputPanelProps {
  output: string;
  isLoading: boolean;
  hasError: boolean;
}

const OutputPanel: React.FC<OutputPanelProps> = ({ output, isLoading, hasError }) => {
  return (
    <div className="output-panel">
      {isLoading ? (
        <div className="loading-indicator">
          <div className="spinner"></div>
          <p>Compiling and running...</p>
        </div>
      ) : (
        <pre className={`output-content ${hasError ? 'error-output' : ''}`}>
          {output || 'Run your code to see output here.'}
        </pre>
      )}
    </div>
  );
};

export default OutputPanel;
