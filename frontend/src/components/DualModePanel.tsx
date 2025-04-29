import React from 'react';
import CodeEditor from './CodeEditor';
import OutputPanel from './OutputPanel';
import VisualizationPanel from './VisualizationPanel';

interface DualModePanelProps {
  initialCode?: string;
  output: string;
  isLoading: boolean;
  onCodeChange: (code: string | undefined) => void;
  onClearOutput: () => void;
  hasRun: boolean;
  viewMode: 'code' | 'output';
}

const DualModePanel: React.FC<DualModePanelProps> = ({
  initialCode,
  output,
  isLoading,
  onCodeChange,
  onClearOutput,
  hasRun,
  viewMode
}) => {
  if (!hasRun) {
    return (
      <div className="full-screen-editor">
        <CodeEditor 
          initialCode={initialCode} 
          onChange={onCodeChange}
          isFullScreen={true}
        />
      </div>
    );
  }

  return (
    <div className="dual-mode-container">
      <div className="left-panel">
        {viewMode === 'code' ? (
          <CodeEditor 
            initialCode={initialCode} 
            onChange={onCodeChange}
            isFullScreen={false}
          />
        ) : (
          <OutputPanel 
            output={output} 
            isLoading={isLoading} 
            onClear={onClearOutput} 
          />
        )}
      </div>
      <div className="right-panel">
        <VisualizationPanel />
      </div>
    </div>
  );
};

export default DualModePanel;