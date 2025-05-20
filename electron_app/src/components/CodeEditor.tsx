import { useState, useEffect } from 'react';

interface CodeEditorProps {
  initialCode: string;
  onChange: (code: string) => void;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ initialCode, onChange }) => {
  const [code, setCode] = useState(initialCode);

  // Update local state when initialCode prop changes
  useEffect(() => {
    setCode(initialCode);
  }, [initialCode]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newCode = e.target.value;
    setCode(newCode);
    onChange(newCode);
  };

  return (
    <div className="code-editor">
      <textarea
        value={code}
        onChange={handleChange}
        className="code-textarea"
        spellCheck="false"
        placeholder="Enter your C++ code here..."
      />
    </div>
  );
};

export default CodeEditor; 