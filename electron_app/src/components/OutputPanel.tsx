import React, { useRef, useEffect, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
import './OutputPanel.css';

interface OutputPanelProps {
  output: string;
  isLoading: boolean;
  hasError: boolean;
}

declare global {
  interface Window {
    electronAPI: {
      onProgramOutput: (callback: (data: string) => void) => void;
      offProgramOutput: (callback: (data: string) => void) => void;
      onProgramFinished: (callback: (code: number | null) => void) => void;
      offProgramFinished: (callback: (code: number | null) => void) => void;
      onInputRequired: (callback: () => void) => void;
      offInputRequired: (callback: () => void) => void;
      onAnalysisComplete: (callback: (data: string) => void) => void;
      offAnalysisComplete: (callback: (data: string) => void) => void;
      checkInputMode: () => Promise<boolean>;
      sendProgramInput: (input: string) => void;
      killRunningProcess: () => void;
      compileCpp: (code: string) => Promise<string>;
      runPython: (scriptPath: string) => Promise<string>;
    } | undefined;
  }
}

const OutputPanel: React.FC<OutputPanelProps> = ({ output, isLoading, hasError }) => {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isWaitingForInput, setIsWaitingForInput] = useState<boolean>(false);
  const [isTerminalReady, setIsTerminalReady] = useState<boolean>(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstance = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon>(new FitAddon());
  const inputBuffer = useRef<string>('');
  
  // Debug logging
  console.log('🖥️ OutputPanel render:', { 
    output: output?.substring(0, 100) + (output?.length > 100 ? '...' : ''),
    outputLength: output?.length,
    isLoading, 
    hasError, 
    isTerminalReady 
  });
  
  // Initialize terminal
  useEffect(() => {
    console.log('🚀 OutputPanel useEffect: Initializing terminal');
    
    if (terminalRef.current && !terminalInstance.current) {
      console.log('📺 Creating new terminal instance');
      
      // Create new terminal instance
      const terminal = new Terminal({
        theme: {
          background: '#1e1e1e',
          foreground: '#d4d4d4',
          cursor: '#aeafad',
          cursorAccent: '#1e1e1e',
          selectionBackground: 'rgba(255, 255, 255, 0.3)',
          black: '#000000',
          red: '#cd3131',
          green: '#0dbc79',
          yellow: '#e5e510',
          blue: '#2472c8',
          magenta: '#bc3fbc',
          cyan: '#11a8cd',
          white: '#e5e5e5',
          brightBlack: '#666666',
          brightRed: '#f14c4c',
          brightGreen: '#23d18b',
          brightYellow: '#f5f543',
          brightBlue: '#3b8eea',
          brightMagenta: '#d670d6',
          brightCyan: '#29b8db',
          brightWhite: '#e5e5e5'
        },
        fontFamily: '"Cascadia Code", Menlo, Monaco, "Courier New", monospace',
        fontSize: 14,
        lineHeight: 1.2,
        convertEol: true,
        cursorBlink: true,
        scrollback: 5000,
        disableStdin: false,
        allowTransparency: false
      });
      
      // Add addons
      terminal.loadAddon(fitAddon.current);
      terminal.loadAddon(new WebLinksAddon());
      
      // Open terminal
      terminal.open(terminalRef.current);
      fitAddon.current.fit();
      
      // Store terminal instance
      terminalInstance.current = terminal;
      setIsTerminalReady(true);
      
      // Write initial message
      terminal.write('Terminal ready. Run code to see output...\r\n');
      console.log('✅ Terminal initialized successfully');
      
      // Add event listener for user input
      terminal.onData((data) => {
        if (isRunning && window.electronAPI) {
          // Handle special keys
          if (data === '\r') { // Enter key
            // Only send input when in input mode or when the buffer has content
            if (isWaitingForInput || inputBuffer.current.length > 0) {
              const inputToSend = inputBuffer.current;
              inputBuffer.current = ''; // Clear the buffer
              window.electronAPI.sendProgramInput(inputToSend);
              setIsWaitingForInput(false);
            }
          } else if (data === '\u007F') { // Backspace
            if (inputBuffer.current.length > 0) {
              // Remove the last character from the buffer
              inputBuffer.current = inputBuffer.current.slice(0, -1);
              // Simulate backspace in the terminal
              terminal.write('\b \b');
            }
          } else if (data >= ' ') { // Printable characters
            // Add to input buffer and echo to terminal
            inputBuffer.current += data;
            terminal.write(data);
          }
        }
      });
    }
    
    return () => {
      // Clean up terminal
      if (terminalInstance.current) {
        console.log('🧹 Cleaning up terminal');
        terminalInstance.current.dispose();
        terminalInstance.current = null;
      }
    };
  }, []);
  
  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (terminalInstance.current && fitAddon.current) {
        fitAddon.current.fit();
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Reset terminal state when compilation starts
  useEffect(() => {
    if (isLoading && terminalInstance.current) {
      console.log('🔄 Clearing terminal for new compilation');
      terminalInstance.current.clear();
      terminalInstance.current.write('Compiling and running...\r\n');
      setIsRunning(false);
    }
  }, [isLoading]);
  
  // Effect to handle initial output when component receives new output prop
  useEffect(() => {
    console.log('📝 Output prop changed:', { output, outputLength: output?.length, isLoading, isTerminalReady });
    
    if (!isLoading && output && isTerminalReady && terminalInstance.current) {
      console.log('📺 Writing output to terminal');
      terminalInstance.current.clear();
      terminalInstance.current.write(output);
      setIsRunning(true);
      
      // Focus the terminal
      terminalInstance.current.focus();
    }
  }, [output, isLoading, isTerminalReady]);
  
  // Effect to set up real-time output listener
  useEffect(() => {
    if (!isTerminalReady) return;
    
    // Handle output from the process
    const handleProgramOutput = (data: string) => {
      if (terminalInstance.current) {
        terminalInstance.current.write(data);
      }
    };
    
    // Handle program completion
    const handleProgramFinished = (_code: number | null) => {
      setIsRunning(false);
      setIsWaitingForInput(false);
      inputBuffer.current = '';
      if (terminalInstance.current) {
        terminalInstance.current.write('\r\n\r\nProcess completed.');
      }
    };
    
    // Handle input required event
    const handleInputRequired = async () => {
      setIsWaitingForInput(true);
      inputBuffer.current = ''; // Clear the input buffer
      
      // Focus the terminal when input is required
      if (terminalInstance.current) {
        setTimeout(() => {
          if (terminalInstance.current) {
            terminalInstance.current.focus();
          }
        }, 100);
      }
    };
    
    // Set up IPC listeners
    if (window.electronAPI) {
      window.electronAPI.onProgramOutput(handleProgramOutput);
      window.electronAPI.onProgramFinished(handleProgramFinished);
      window.electronAPI.onInputRequired(handleInputRequired);
      
      // Check input mode on startup
      window.electronAPI.checkInputMode().then(isInputMode => {
        setIsWaitingForInput(isInputMode);
      });
    }
    
    return () => {
      // Clean up listeners
      if (window.electronAPI) {
        window.electronAPI.offProgramOutput(handleProgramOutput);
        window.electronAPI.offProgramFinished(handleProgramFinished);
        window.electronAPI.offInputRequired(handleInputRequired);
      }
    };
  }, [isTerminalReady]);
  
  // Handle terminal click to focus
  const handleTerminalClick = () => {
    if (isRunning && terminalInstance.current) {
      terminalInstance.current.focus();
    }
  };
  
  // Handle clear terminal
  const handleClearTerminal = () => {
    if (terminalInstance.current) {
      terminalInstance.current.clear();
    }
  };
  
  // Handle kill process
  const handleKillProcess = () => {
    if (isRunning && window.electronAPI) {
      window.electronAPI.killRunningProcess();
      setIsRunning(false);
    }
  };
  
  return (
    <div className="vscode-terminal-panel">
      <div className="terminal-header">
        <div className="terminal-title">
          {isWaitingForInput ? (
            <span className="input-mode-indicator">Waiting for Input</span>
          ) : isRunning ? (
            'Running Process'
          ) : (
            'Terminal'
          )}
        </div>
        <div className="terminal-actions">
          <button 
            className="terminal-action-button" 
            onClick={handleClearTerminal}
            title="Clear Terminal"
          >
            <span className="icon">🗑️</span>
          </button>
          {isRunning && (
            <button 
              className="terminal-action-button kill-button" 
              onClick={handleKillProcess}
              title="Kill Process"
            >
              <span className="icon">⏹️</span>
            </button>
          )}
        </div>
      </div>
      
      <div 
        className={`terminal-container ${hasError ? 'error-state' : ''} ${isWaitingForInput ? 'input-mode' : ''}`}
        onClick={handleTerminalClick}
        ref={terminalRef}
      >
        {/* xterm.js terminal will be mounted here */}
      </div>
    </div>
  );
};

export default OutputPanel;
