import React from 'react';

interface OutputPanelProps {
  output: string;
  isLoading?: boolean;
  onClear?: () => void;
  visualizationData?: any;
  isVisualizationPanel?: boolean;
}

const OutputPanel: React.FC<OutputPanelProps> = ({ 
  output, 
  isLoading = false,
  onClear,
  visualizationData,
  isVisualizationPanel = false
}) => {
  return (
    <div className={`panel ${isVisualizationPanel ? 'visualization-panel' : 'output-panel'}`}>
      <div className="panel-header">
        <h3>{isVisualizationPanel ? 'Visualization' : 'Output'}</h3>
        {!isVisualizationPanel && (
          <button className="clear-btn" onClick={onClear}>Clear</button>
        )}
      </div>
      <div className="panel-content">
        {isVisualizationPanel ? (
          <div className="visualization-container" id="visualization-container">
            {!visualizationData && <div className="no-data">Run code to see visualization</div>}
            {visualizationData && <div>Visualization data loaded</div>}
          </div>
        ) : (
          isLoading ? (
            <div className="loading">Running...</div>
          ) : (
            <pre>{output}</pre>
          )
        )}
      </div>
    </div>
  );
};

export default OutputPanel;