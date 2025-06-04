import React, { useState, useEffect } from 'react';

interface Block {
  id: string;
  description: string;
  line_range: [number, number];
  code: string;
}

interface AnalysisData {
  analysis?: {
    blocks?: Block[];
    functions?: any;
    tokens?: any[];
  };
  summary?: {
    total_blocks?: number;
    blocks?: any[];
  };
  blocksDir?: string;
}

interface CompilationData {
  results?: any;
  summary?: {
    total_blocks?: number;
    successful_compilations?: number;
    failed_compilations?: number;
    intermediate_files?: any[];
    errors?: any[];
  };
  blocksDir?: string;
}

interface VisualizationPanelProps {
  analysisData?: AnalysisData | null;
  compilationData?: CompilationData | null;
  isDebugging?: boolean;
}

const VisualizationPanel: React.FC<VisualizationPanelProps> = ({ 
  analysisData, 
  compilationData, 
  isDebugging = false 
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'blocks' | 'compilation' | 'debug'>('overview');
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);

  // Switch to appropriate tab when new data arrives
  useEffect(() => {
    if (isDebugging) {
      setActiveTab('debug');
    } else if (compilationData) {
      setActiveTab('compilation');
    } else if (analysisData) {
      setActiveTab('blocks');
    }
  }, [analysisData, compilationData, isDebugging]);

  // Safe getter functions
  const getTotalBlocks = () => analysisData?.summary?.total_blocks ?? 0;
  const getFunctionsCount = () => Object.keys(analysisData?.analysis?.functions ?? {}).length;
  const getTokensCount = () => analysisData?.analysis?.tokens?.length ?? 0;
  const getBlocks = () => analysisData?.analysis?.blocks ?? [];
  
  const getCompilationSuccess = () => compilationData?.summary?.successful_compilations ?? 0;
  const getCompilationFailed = () => compilationData?.summary?.failed_compilations ?? 0;
  const getIntermediateFiles = () => compilationData?.summary?.intermediate_files ?? [];
  const getCompilationErrors = () => compilationData?.summary?.errors ?? [];

  const renderOverview = () => (
    <div className="overview-content">
      <h3>Code Analysis Overview</h3>
      {analysisData ? (
        <div className="overview-stats">
          <div className="stat-item">
            <span className="stat-label">Total Blocks:</span>
            <span className="stat-value">{getTotalBlocks()}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Functions:</span>
            <span className="stat-value">{getFunctionsCount()}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Tokens:</span>
            <span className="stat-value">{getTokensCount()}</span>
          </div>
        </div>
      ) : (
        <div className="loading-state">
          <p>Click "Analyze" to start code analysis</p>
        </div>
      )}
      
      {compilationData && (
        <div className="compilation-overview">
          <h4>Compilation Results</h4>
          <div className="overview-stats">
            <div className="stat-item">
              <span className="stat-label">Successful:</span>
              <span className="stat-value success">{getCompilationSuccess()}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Failed:</span>
              <span className="stat-value error">{getCompilationFailed()}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Intermediate Files:</span>
              <span className="stat-value">{getIntermediateFiles().length}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderBlocks = () => {
    const blocks = getBlocks();
    
    return (
      <div className="blocks-content">
        <h3>Code Blocks</h3>
        {analysisData ? (
          blocks.length > 0 ? (
            <div className="blocks-list">
              {blocks.map((block, index) => (
                <div 
                  key={block.id} 
                  className={`block-item ${selectedBlock?.id === block.id ? 'selected' : ''}`}
                  onClick={() => setSelectedBlock(block)}
                >
                  <div className="block-header">
                    <span className="block-id">{block.id}</span>
                    <span className="block-lines">
                      Lines {block.line_range?.[0] ?? 0}-{block.line_range?.[1] ?? 0}
                    </span>
                  </div>
                  <div className="block-description">{block.description || 'No description'}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p>No code blocks found in analysis</p>
            </div>
          )
        ) : (
          <div className="loading-state">
            <p>Waiting for analysis data...</p>
            <div className="spinner"></div>
          </div>
        )}
        
        {selectedBlock && (
          <div className="block-details">
            <h4>Block Details: {selectedBlock.id}</h4>
            <p>{selectedBlock.description || 'No description available'}</p>
            <pre className="block-code">{selectedBlock.code || '// No code available'}</pre>
          </div>
        )}
      </div>
    );
  };

  const renderCompilation = () => {
    const intermediateFiles = getIntermediateFiles();
    const errors = getCompilationErrors();
    
    return (
      <div className="compilation-content">
        <h3>Compilation Results</h3>
        {compilationData ? (
          <div>
            <div className="compilation-summary">
              <div className="summary-stats">
                <div className="stat success">
                  <span className="stat-number">{getCompilationSuccess()}</span>
                  <span className="stat-label">Successful</span>
                </div>
                <div className="stat error">
                  <span className="stat-number">{getCompilationFailed()}</span>
                  <span className="stat-label">Failed</span>
                </div>
                <div className="stat info">
                  <span className="stat-number">{intermediateFiles.length}</span>
                  <span className="stat-label">Intermediate Files</span>
                </div>
              </div>
            </div>
            
            {intermediateFiles.length > 0 && (
              <div className="intermediate-files">
                <h4>Generated Intermediate Code</h4>
                {intermediateFiles.map((file, index) => (
                  <div key={index} className="intermediate-file">
                    <div className="file-header">
                      <span className="file-block">{file?.block || `Block ${index + 1}`}</span>
                      <span className="file-lines">{file?.lines || 0} lines</span>
                    </div>
                    <div className="file-path">{file?.file || 'Unknown file'}</div>
                  </div>
                ))}
              </div>
            )}
            
            {errors.length > 0 && (
              <div className="compilation-errors">
                <h4>Compilation Errors</h4>
                {errors.map((error, index) => (
                  <div key={index} className="error-item">
                    <div className="error-block">{error?.block || `Block ${index + 1}`}</div>
                    <div className="error-message">{error?.error || 'Unknown error'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="loading-state">
            <p>Waiting for compilation results...</p>
            <div className="spinner"></div>
          </div>
        )}
      </div>
    );
  };

  const renderDebug = () => (
    <div className="debug-content">
      <h3>Debug Information</h3>
      {isDebugging ? (
        <div className="debug-info">
          <div className="debug-status">
            <div className="status-indicator active">
              <span className="indicator-dot"></span>
              <span>Debug Session Active</span>
            </div>
          </div>
          
          <div className="debug-sections">
            <div className="debug-section">
              <h4>Current State</h4>
              <p>Program is running in debug mode</p>
            </div>
            
            <div className="debug-section">
              <h4>Variables</h4>
              <p>Variable tracking will appear here</p>
            </div>
            
            <div className="debug-section">
              <h4>Call Stack</h4>
              <p>Call stack information will appear here</p>
            </div>
            
            <div className="debug-section">
              <h4>Execution Timeline</h4>
              <p>Step-by-step execution flow will appear here</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="loading-state">
          <p>Start debugging to see debug information</p>
        </div>
      )}
    </div>
  );

  const getTabCount = (tabType: string) => {
    switch (tabType) {
      case 'blocks':
        return getTotalBlocks();
      case 'compilation':
        return getCompilationSuccess() + getCompilationFailed();
      default:
        return 0;
    }
  };

  return (
    <div className="visualization-panel">
      <div className="panel-tabs">
        <button 
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button 
          className={`tab ${activeTab === 'blocks' ? 'active' : ''}`}
          onClick={() => setActiveTab('blocks')}
          disabled={!analysisData}
        >
          Blocks ({getTabCount('blocks')})
        </button>
        <button 
          className={`tab ${activeTab === 'compilation' ? 'active' : ''}`}
          onClick={() => setActiveTab('compilation')}
          disabled={!compilationData}
        >
          Compilation
        </button>
        <button 
          className={`tab ${activeTab === 'debug' ? 'active' : ''}`}
          onClick={() => setActiveTab('debug')}
        >
          Debug {isDebugging && <span className="debug-indicator">●</span>}
        </button>
      </div>
      
      <div className="panel-content">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'blocks' && renderBlocks()}
        {activeTab === 'compilation' && renderCompilation()}
        {activeTab === 'debug' && renderDebug()}
      </div>
    </div>
  );
};

export default VisualizationPanel; 