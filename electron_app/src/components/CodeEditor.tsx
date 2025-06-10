import { useState, useEffect, useRef } from 'react';
import './CodeEditor.css';

interface Breakpoint {
  line: number;
  file: string;
}

interface CodeEditorProps {
  initialCode: string;
  onChange: (code: string) => void;
  breakpoints?: Breakpoint[];
  onSetBreakpoint?: (line: number) => void;
  onSaveAndProcess?: (code: string) => void;
  onAutoAnalyze?: (code: string) => void;
  autoAnalyzeEnabled?: boolean;
  showSaveButton?: boolean;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ 
  initialCode, 
  onChange, 
  breakpoints = [], 
  onSetBreakpoint,
  onSaveAndProcess,
  onAutoAnalyze,
  autoAnalyzeEnabled = true,
  showSaveButton = false
}) => {
  const [code, setCode] = useState(initialCode);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Update local state when initialCode prop changes
  useEffect(() => {
    setCode(initialCode);
  }, [initialCode]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newCode = e.target.value;
    setCode(newCode);
    onChange(newCode);
    updateLineNumbers();

    // Automatic analysis with debouncing
    if (autoAnalyzeEnabled && onAutoAnalyze) {
      // Clear existing timer
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      
      // Set new timer for auto-analysis (2 second delay after user stops typing)
      debounceTimer.current = setTimeout(() => {
        console.log('🔄 Auto-triggering analysis after code change...');
        onAutoAnalyze(newCode);
      }, 2000);
    }
  };

  const updateLineNumbers = () => {
    if (lineNumbersRef.current && textareaRef.current) {
      const lines = code.split('\n');
      const lineNumbersHTML = lines.map((_, index) => {
        const lineNum = index + 1;
        const hasBreakpoint = breakpoints.some(bp => bp.line === lineNum);
        return `<div class="line-number ${hasBreakpoint ? 'has-breakpoint' : ''}" data-line="${lineNum}">${lineNum}</div>`;
      }).join('');
      lineNumbersRef.current.innerHTML = lineNumbersHTML;
    }
  };

  const handleLineNumberClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('line-number') && onSetBreakpoint) {
      const lineNum = parseInt(target.getAttribute('data-line') || '0', 10);
      if (lineNum > 0) {
        onSetBreakpoint(lineNum);
      }
    }
  };

  const handleScroll = () => {
    if (lineNumbersRef.current && textareaRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const handleSaveAndProcess = () => {
    if (onSaveAndProcess) {
      onSaveAndProcess(code);
    }
  };

  useEffect(() => {
    updateLineNumbers();
  }, [code, breakpoints]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.addEventListener('scroll', handleScroll);
      return () => textarea.removeEventListener('scroll', handleScroll);
    }
  }, []);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  return (
    <div className="code-editor">
      {showSaveButton && onSaveAndProcess && (
        <div className="editor-toolbar">
          <button 
            className="save-process-button"
            onClick={handleSaveAndProcess}
            title="Save code and run full analysis pipeline"
          >
            🔄 Save & Process
          </button>
        </div>
      )}
      {autoAnalyzeEnabled && (
        <div className="auto-analysis-indicator">
          <small style={{ color: '#888', fontStyle: 'italic' }}>
            ⚡ Auto-analysis enabled - changes will be processed automatically
          </small>
        </div>
      )}
      <div className="editor-container">
        <div 
          className="line-numbers" 
          ref={lineNumbersRef}
          onClick={handleLineNumberClick}
          title="Click to set breakpoint"
        >
        </div>
        <textarea
          ref={textareaRef}
          value={code}
          onChange={handleChange}
          onScroll={handleScroll}
          className="code-textarea"
          spellCheck="false"
          placeholder="Enter your C++ code here..."
        />
      </div>
    </div>
  );
};

export default CodeEditor; 