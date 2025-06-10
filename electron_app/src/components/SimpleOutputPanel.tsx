import React from 'react';

interface SimpleOutputPanelProps {
  output: string;
  isLoading: boolean;
  hasError: boolean;
}

const SimpleOutputPanel: React.FC<SimpleOutputPanelProps> = ({ output, isLoading }) => {
  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#1e1e1e',
      color: '#d4d4d4',
      fontFamily: 'monospace',
      overflow: 'hidden'
    }}>
      {/* Content */}
      <div style={{
        flex: 1,
        padding: '12px',
        overflow: 'auto',
        whiteSpace: 'pre-wrap',
        fontSize: '14px',
        lineHeight: '1.4',
        backgroundColor: '#1e1e1e'
      }}>
        {isLoading ? (
          <div style={{ color: '#007acc' }}>
            Compiling...
          </div>
        ) : output ? (
          <div>
            {output}
          </div>
        ) : (
          <div style={{ color: '#888', fontStyle: 'italic' }}>
            Terminal ready. Run code to see output.
          </div>
        )}
      </div>
    </div>
  );
};

export default SimpleOutputPanel; 