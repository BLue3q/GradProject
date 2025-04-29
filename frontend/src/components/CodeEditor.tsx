import React, { useState } from 'react';
import Editor from '@monaco-editor/react';

interface CodeEditorProps {
  initialCode?: string;
  onChange?: (value: string | undefined) => void;
  isFullScreen?: boolean;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ 
  initialCode = '// Online C++ compiler to run C++ program online\n#include <iostream>\n\nint main() {\n    // Write C++ code here\n    std::cout << "Hello World!";\n    \n    return 0;\n}', 
  onChange,
  isFullScreen = false
}) => {
  const [code, setCode] = useState(initialCode);

  const handleEditorChange = (value: string | undefined) => {
    setCode(value || '');
    if (onChange) {
      onChange(value);
    }
  };

  return (
    <div className={`code-editor ${isFullScreen ? 'full-screen' : ''}`}>
      <Editor
        height={isFullScreen ? "100vh" : "90vh"}
        defaultLanguage="cpp"
        defaultValue={initialCode}
        onChange={handleEditorChange}
        theme="vs-dark"
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          lineNumbers: 'on',
          glyphMargin: true,
          folding: true,
        }}
      />
    </div>
  );
};

export default CodeEditor;