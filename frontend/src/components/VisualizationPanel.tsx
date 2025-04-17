import React, { useEffect, useRef } from 'react';

interface VisualizationPanelProps {
  visualizationData?: any;
  isLoading?: boolean;
}

const VisualizationPanel: React.FC<VisualizationPanelProps> = ({ 
  visualizationData,
  isLoading = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (visualizationData && containerRef.current) {
      // This is where you would initialize the visualization
      // using the data and the container reference
      console.log('Visualization data available:', visualizationData);
      
      // Example of how you might integrate with visualizor.js:
      // if (window.visualizor) {
      //   window.visualizor.initialize(containerRef.current, visualizationData);
      // }
    }
  }, [visualizationData]);

  return (
    <div className="panel visualization-panel">
      <div className="panel-header">
        <h3>Visualization</h3>
      </div>
      <div className="panel-content">
        <div 
          ref={containerRef} 
          className="visualization-container" 
          id="visualization-container"
        >
          {isLoading ? (
            <div className="loading">Preparing visualization...</div>
          ) : !visualizationData ? (
            <div className="no-data">Run code to see visualization</div>
          ) : (
            <div className="visualization-active">
              {/* Visualization will be rendered here by visualizor.js */}
              <div>Visualization data loaded</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VisualizationPanel;