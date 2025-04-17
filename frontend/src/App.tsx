import React, { useState } from 'react';
import CodeEditor from './components/CodeEditor';
import OutputPanel from './components/OutputPanel';
import VisualizationPanel from './components/VisualizationPanel';
import './App.css';

function App() {
  const [fileName, setFileName] = useState('main.cpp');
  const [code, setCode] = useState('// Online C++ compiler to run C++ program online\n#include <iostream>\n\nint main() {\n    // Write C++ code here\n    std::cout << "Hello World!";\n    \n    return 0;\n}');
  const [output, setOutput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showOutput, setShowOutput] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [visualizationData, setVisualizationData] = useState(null);

  const handleCodeChange = (value: string | undefined) => {
    setCode(value || '');
  };

  const handleRunCode = async () => {
    setIsLoading(true);
    
    // Simulate code execution
    setTimeout(() => {
      setOutput('Hello World!');
      
      setVisualizationData((null));
      setShowOutput(true);
      setIsLoading(false);
    }, 1500);
  };

  const togglePanel = () => {
    setShowOutput(!showOutput);
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    document.body.classList.toggle('light-mode');
  };

  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
  };

  const handleShare = () => {
    // Implement share functionality
    alert('Share functionality will be implemented here');
  };

  return (
    <div className={`App ${isDarkMode ? 'dark-mode' : 'light-mode'}`}>
      <div className="control-bar">
        <div className="file-info">
          <span className="file-name">{fileName}</span>
        </div>
        <div className="control-buttons">
          <button className="switch-btn" onClick={togglePanel}>
            {showOutput ? 'Show Code' : 'Show Output'}
          </button>
          <button className="run-btn" onClick={handleRunCode} disabled={isLoading}>
            {isLoading ? 'Running...' : 'Run'}
          </button>
          <button className="control-btn" onClick={toggleFullScreen} title="Toggle Fullscreen">
            <i className={`fas ${isFullScreen ? 'fa-compress' : 'fa-expand'}`}></i>
          </button>
          <button className="control-btn" onClick={toggleDarkMode} title="Toggle Dark/Light Mode">
            <i className={`fas ${isDarkMode ? 'fa-sun' : 'fa-moon'}`}></i>
          </button>
          <button className="control-btn" onClick={handleShare} title="Share">
            <i className="fas fa-share-alt"></i>
          </button>
        </div>
      </div>
      
      <div className="main-content">
        <div className="left-panel">
          {!showOutput ? (
            <CodeEditor initialCode={code} onChange={handleCodeChange} />
          ) : (
            <OutputPanel output={output} isLoading={isLoading} />
          )}
        </div>
        
        <div className="right-panel">
          <VisualizationPanel visualizationData={visualizationData} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
}

export default App;