import React from 'react';
import CodeEditor from './CodeEditor';
import OutputPanel from './OutputPanel';

interface DualModePanelProps {
  initialCode?: string;
  output: string;
  isLoading: boolean;
  onCodeChange: (code: string | undefined) => void;
  onClearOutput: () => void;
  showOutput: boolean;
}

const DualModePanel: React.FC<DualModePanelProps> = ({
  initialCode,
  output,
  isLoading,
  onCodeChange,
  onClearOutput,
  showOutput
}) => {
  return (
    <div className="dual-mode-panel">
      {!showOutput ? (
        <CodeEditor initialCode={initialCode} onChange={onCodeChange} />
      ) : (
        <OutputPanel 
          output={output} 
          isLoading={isLoading} 
          onClear={onClearOutput} 
        />
      )}
    </div>
  );
};

export default DualModePanel;