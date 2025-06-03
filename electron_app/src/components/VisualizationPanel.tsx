import React, { useEffect, useState, useRef } from 'react';

interface VisualizationData {
  // Define the structure based on your output.json format
  [key: string]: any;
}

const VisualizationPanel: React.FC = () => {
  const [visualizationData, setVisualizationData] = useState<VisualizationData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const visualizationRef = useRef<HTMLDivElement>(null);
  const scriptLoadedRef = useRef<boolean>(false);

  useEffect(() => {
    // Handle analysis complete event
    const handleAnalysisComplete = (jsonData: string) => {
      try {
        const data = JSON.parse(jsonData);
        setVisualizationData(data);
        setError(null);
        
        // If the visualization script is loaded, render the visualization
        if (scriptLoadedRef.current && window.renderVisualization) {
          window.renderVisualization(data, 'visualization-root');
        }
      } catch (err) {
        console.error('Failed to parse analysis data:', err);
        setError('Failed to parse analysis data');
      }
    };

    // Set up IPC listener
    if (window.electronAPI) {
      window.electronAPI.onAnalysisComplete(handleAnalysisComplete);
    }

    return () => {
      // Clean up listener
      if (window.electronAPI) {
        window.electronAPI.offAnalysisComplete(handleAnalysisComplete);
      }
    };
  }, []);

  useEffect(() => {
    // Try to load external visualization script
    const loadVisualizationScript = async () => {
      setIsLoading(true);
      try {
        // Load the page wrapper script that integrates with the page visualization
        const script = document.createElement('script');
        script.src = '/page-wrapper.js';
        script.async = true;
        
        await new Promise((resolve, reject) => {
          script.onload = () => {
            console.log('Page wrapper script loaded successfully');
            scriptLoadedRef.current = true;
            setIsLoading(false);
            
            // If we already have data, render it
            if (visualizationData && window.renderVisualization) {
              window.renderVisualization(visualizationData, 'visualization-root');
            }
            resolve(true);
          };
          
          script.onerror = () => {
            console.warn('Failed to load page wrapper script, using fallback');
            scriptLoadedRef.current = true;
            setIsLoading(false);
            
            // Use fallback visualization if wrapper script fails
            if (visualizationData && window.renderFallbackVisualization) {
              window.renderFallbackVisualization(visualizationData, 'visualization-root');
            } else if (visualizationData) {
              renderFallbackVisualization(visualizationData);
            }
            resolve(false);
          };
          
          document.body.appendChild(script);
        });
        
      } catch (err) {
        console.error('Error loading visualization:', err);
        setError('Error loading visualization module');
        setIsLoading(false);
      }
    };

    loadVisualizationScript();
  }, []);

  // Render visualization when data changes
  useEffect(() => {
    if (visualizationData && scriptLoadedRef.current) {
      if (window.renderVisualization) {
        window.renderVisualization(visualizationData, 'visualization-root');
      } else {
        renderFallbackVisualization(visualizationData);
      }
    }
  }, [visualizationData]);

  // Fallback visualization renderer
  const renderFallbackVisualization = (data: VisualizationData) => {
    const container = document.getElementById('visualization-root');
    if (!container) return;

    container.innerHTML = `
      <div style="padding: 20px; color: #d4d4d4; font-family: 'Cascadia Code', monospace;">
        <h3 style="color: #4ec9b0; margin-top: 0;">Analysis Results</h3>
        <pre style="background: #252526; padding: 15px; border-radius: 4px; overflow: auto;">
${JSON.stringify(data, null, 2)}
        </pre>
      </div>
    `;
  };

  return (
    <div className="visualization-panel">
      {/* This div will be used by external JS for runtime visualization */}
      <div 
        id="visualization-root" 
        ref={visualizationRef}
        style={{ width: '100%', height: '100%' }}
      />
      
      {/* Show loading state */}
      {isLoading && (
        <div className="visualization-placeholder">
          <div className="loading-indicator">
            <div className="spinner"></div>
            <p>Loading visualization...</p>
          </div>
        </div>
      )}
      
      {/* Show error state */}
      {error && (
        <div className="visualization-placeholder">
          <h3>Visualization Error</h3>
          <p>{error}</p>
        </div>
      )}
      
      {/* Show placeholder when no data */}
      {!visualizationData && !isLoading && !error && (
        <div className="visualization-placeholder">
          <h3>Visualization Panel</h3>
          <p>Run your C++ code to see the analysis visualization.</p>
          <p>This panel will display:</p>
          <ul>
            <li>Code structure analysis</li>
            <li>Variable tracking</li>
            <li>Execution flow</li>
            <li>Memory usage patterns</li>
          </ul>
        </div>
      )}
    </div>
  );
};

// Extend window interface for the visualization function
declare global {
  interface Window {
    renderVisualization?: (data: any, containerId: string) => void;
    renderFallbackVisualization?: (data: any, containerId: string) => void;
  }
}

export default VisualizationPanel; 