import { useState, useEffect, useRef } from 'react';

interface Breakpoint {
  line: number;
  file: string;
}

interface CodeEditorProps {
  initialCode: string;
  onChange: (code: string) => void;
  breakpoints?: Breakpoint[];
  onSetBreakpoint?: (line: number) => void;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ 
  initialCode, 
  onChange, 
  breakpoints = [], 
  onSetBreakpoint 
}) => {
  const [code, setCode] = useState(initialCode);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  // Update local state when initialCode prop changes
  useEffect(() => {
    setCode(initialCode);
  }, [initialCode]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newCode = e.target.value;
    setCode(newCode);
    onChange(newCode);
    updateLineNumbers();
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

  return (
    <div className="code-editor">
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