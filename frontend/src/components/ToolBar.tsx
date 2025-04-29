import React from 'react';

interface ToolBarProps {
  hasRun: boolean;
  viewMode: 'code' | 'output';
  onRun: () => void;
  onViewModeChange: (mode: 'code' | 'output') => void;
  isLoading: boolean;
}

const ToolBar: React.FC<ToolBarProps> = ({
  hasRun,
  viewMode,
  onRun,
  onViewModeChange,
  isLoading
}) => {
  const handleToggleView = () => {
    onViewModeChange(viewMode === 'code' ? 'output' : 'code');
  };

  return (
    <div className="toolbar">
      <div className="toolbar-content">
        {!hasRun ? (
          <button 
            className="run-btn" 
            onClick={onRun} 
            disabled={isLoading}
          >
            {isLoading ? 'Running...' : 'Run'}
          </button>
        ) : (
          <button 
            className="toggle-view-btn"
            onClick={handleToggleView}
          >
            {viewMode === 'code' ? 'Show Output' : 'Show Code'}
          </button>
        )}
      </div>
    </div>
  );
};

export default ToolBar; 