#!/usr/bin/env python3
"""
C++ Lexer and Analyzer for Visualization
This script analyzes C++ code and outputs JSON data for visualization
"""

import sys
import json
import re
from pathlib import Path
import ply.lex as lex

# Token definitions
tokens = (
    'MAIN', 'TYPE', 'IDENTIFIER', 'NUMBER', 'CHAR_LITERAL', 'STRING_LITERAL',
    'EQUALS', 'SEMICOLON', 'COMMA', 'LBRACE', 'RBRACE', 'LBRACKET', 'RBRACKET',
    'LPAREN', 'RPAREN', 'NEW', 'POINTER', 'ADDRESS', 'NULLPTR', 'CLASS',
    'ARROW', 'DOT'
)

def t_newline(t):
    r'\n+'
    t.lexer.lineno += len(t.value)
    
def t_INCLUDE(t):
    r'\#include[ \t]*<[^>]+>'
    pass  # Ignore include directives

def t_NAMESPACE(t):
    r'using[ \t]+namespace[ \t]+std[ \t]*;'
    pass  # Ignore namespace declaration

def t_MAIN(t):
    r'\bmain\b'
    t.lineno = t.lexer.lineno
    return t

def t_CLASS(t):
    r'\bclass\b'
    t.lineno = t.lexer.lineno
    return t

def t_TYPE(t):
    r'\b(int|float|double|char|string|void|class)\b'
    t.lineno = t.lexer.lineno
    return t

def t_NEW(t):
    r'\bnew\b'
    t.lineno = t.lexer.lineno
    return t

def t_IDENTIFIER(t):
    r'[a-zA-Z_][a-zA-Z0-9_]*'
    t.lineno = t.lexer.lineno
    return t

def t_NUMBER(t):
    r'\d+(\.\d+)?([eE][+-]?\d+)?'  # Handle integers, floats, exponents
    if '.' in t.value or 'e' in t.value.lower():
        t.value = float(t.value)
    else:
        t.value = int(t.value)
    return t

def t_CHAR_LITERAL(t):
    r"'(\\.|[^'\\])'"
    t.value = t.value[1:-1]  # Strip quotes
    return t

def t_STRING_LITERAL(t):
    r'\"(\\.|[^"\\])*\"'
    t.value = t.value[1:-1]  # Strip quotes
    return t

t_LPAREN = r'\('
t_RPAREN = r'\)'
t_LBRACKET = r'\['
t_RBRACKET = r'\]'
t_LBRACE = r'\{'
t_RBRACE = r'\}'
t_EQUALS = r'='
t_SEMICOLON = r';'
t_COMMA = r','

t_ignore = ' \t\r'  # Ignore whitespace

def t_POINTER(t):
    r'\*'
    t.lineno = t.lexer.lineno
    return t

def t_ADDRESS(t):
    r'&'
    t.lineno = t.lexer.lineno
    return t

def t_NULLPTR(t):
    r'\b(nullptr|NULL)\b'
    t.lineno = t.lexer.lineno
    return t

def t_comment_single(t):
    r'//.*'
    pass  # Ignore single-line comments

def t_error(t):
    print(f"Illegal character '{t.value[0]}'")
    t.lexer.skip(1)

def t_ARROW(t):
    r'->'
    t.lineno = t.lexer.lineno
    return t

def t_DOT(t):
    r'\.'
    t.lineno = t.lexer.lineno
    return t

# Build the lexer
lexer = lex.lex()

def analyze_cpp_code(file_path):
    """Analyze C++ code and extract information for visualization"""
    
    try:
        with open(file_path, 'r') as f:
            code = f.read()
    except Exception as e:
        return {"error": f"Failed to read file: {str(e)}"}
    
    # Tokenize the code
    lexer.input(code)
    tokens_list = []
    
    while True:
        tok = lexer.token()
        if not tok:
            break
        tokens_list.append({
            'type': tok.type,
            'value': str(tok.value),
            'line': tok.lineno
        })
    
    # Simple analysis - extract functions, variables, and includes
    analysis = {
        "file": str(file_path),
        "metrics": {
            "lines": len(code.splitlines()),
            "characters": len(code),
            "tokens": len(tokens_list)
        },
        "tokens": tokens_list,
        "includes": [],
        "functions": [],
        "variables": [],
        "classes": []
    }
    
    # Extract includes
    include_pattern = r'#include\s*[<"]([^>"]+)[>"]'
    for match in re.finditer(include_pattern, code):
        analysis["includes"].append({
            "name": match.group(1),
            "line": code[:match.start()].count('\n') + 1
        })
    
    # Extract functions (simple pattern)
    function_pattern = r'(\w+)\s+(\w+)\s*\([^)]*\)\s*\{'
    for match in re.finditer(function_pattern, code):
        analysis["functions"].append({
            "return_type": match.group(1),
            "name": match.group(2),
            "line": code[:match.start()].count('\n') + 1
        })
    
    # Extract variable declarations (simple pattern)
    var_pattern = r'(int|float|double|char|bool|string)\s+(\w+)\s*[=;]'
    for match in re.finditer(var_pattern, code):
        analysis["variables"].append({
            "type": match.group(1),
            "name": match.group(2),
            "line": code[:match.start()].count('\n') + 1
        })
    
    # Extract classes
    class_pattern = r'class\s+(\w+)\s*\{'
    for match in re.finditer(class_pattern, code):
        analysis["classes"].append({
            "name": match.group(1),
            "line": code[:match.start()].count('\n') + 1
        })
    
    # Add visualization data
    analysis["visualization"] = {
        "type": "code_structure",
        "nodes": [],
        "edges": []
    }
    
    # Create nodes for visualization
    node_id = 0
    for func in analysis["functions"]:
        analysis["visualization"]["nodes"].append({
            "id": f"node_{node_id}",
            "label": func["name"],
            "type": "function",
            "data": func
        })
        node_id += 1
    
    for cls in analysis["classes"]:
        analysis["visualization"]["nodes"].append({
            "id": f"node_{node_id}",
            "label": cls["name"],
            "type": "class",
            "data": cls
        })
        node_id += 1
    
    return analysis

def main():
    if len(sys.argv) < 2:
        print("Usage: python mylexer.py <cpp_file>")
        sys.exit(1)
    
    file_path = Path(sys.argv[1])
    
    # Analyze the C++ code
    result = analyze_cpp_code(file_path)
    
    # Write output to output.json
    output_path = Path("output.json")
    with open(output_path, 'w') as f:
        json.dump(result, f, indent=2)
    
    print(f"Analysis complete. Results written to {output_path}")

if __name__ == "__main__":
    main()