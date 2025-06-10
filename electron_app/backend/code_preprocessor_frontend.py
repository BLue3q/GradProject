#!/usr/bin/env python3
"""
Frontend Code Preprocessor for C++ Visualizer
Removes visualization-specific syntax before compilation.
"""

import re
import sys
import os

def preprocess_cpp_code(code):
    """
    Remove or replace visualization-specific syntax that the frontend compiler doesn't support.
    
    Args:
        code (str): Original C++ code
        
    Returns:
        str: Preprocessed code ready for compilation
    """
    
    # Store the original code for comparison
    original_code = code
    
    # First, protect essential C++ constructs by temporarily replacing them
    # This prevents them from being accidentally modified
    protections = []
    
    # Protect std::cout statements - these are valid C++
    std_cout_pattern = r'std::cout\s*<<[^;]*;'
    std_cout_matches = re.finditer(std_cout_pattern, code)
    for i, match in enumerate(std_cout_matches):
        placeholder = f"__STD_COUT_PROTECTED_{i}__"
        protections.append((placeholder, match.group(0)))
        code = code.replace(match.group(0), placeholder)
    
    # Protect std::cin statements - these are valid C++  
    std_cin_pattern = r'std::cin\s*>>[^;]*;'
    std_cin_matches = re.finditer(std_cin_pattern, code)
    for i, match in enumerate(std_cin_matches):
        placeholder = f"__STD_CIN_PROTECTED_{i}__"
        protections.append((placeholder, match.group(0)))
        code = code.replace(match.group(0), placeholder)
    
    # Protect template syntax like vector<int>, map<string, int>
    template_pattern = r'\w+\s*<[^>]+>'
    template_matches = re.finditer(template_pattern, code)
    for i, match in enumerate(template_matches):
        placeholder = f"__TEMPLATE_PROTECTED_{i}__"
        protections.append((placeholder, match.group(0)))
        code = code.replace(match.group(0), placeholder)
    
    # Protect comparison operators
    comparison_patterns = [
        r'\w+\s*<\s*\w+',  # a < b
        r'\w+\s*>\s*\w+',  # a > b
        r'\w+\s*<=\s*\w+', # a <= b
        r'\w+\s*>=\s*\w+', # a >= b
    ]
    
    for pattern in comparison_patterns:
        matches = re.finditer(pattern, code)
        for i, match in enumerate(matches):
            placeholder = f"__COMPARISON_PROTECTED_{len(protections)}__"
            protections.append((placeholder, match.group(0)))
            code = code.replace(match.group(0), placeholder)
    
    # NOW apply the filtering for visualization-specific syntax
    # Only target non-standard or problematic patterns
    
    # Remove standalone cin statements that aren't std::cin (visualization syntax)
    code = re.sub(r'\bcin\s*>>\s*([^;]+);', r'// cin >> \1; // Removed for visualization', code)
    
    # Remove standalone cout statements that aren't std::cout (visualization syntax)
    code = re.sub(r'\bcout\s*<<\s*([^;]+);', r'// cout << \1; // Removed for visualization', code)
    
    # Only remove angle brackets that appear to be stray/standalone (not part of valid C++)
    # Be very conservative here
    code = re.sub(r'(?<!\w)\s*<\s*(?!\w|=)', r'/* < removed */', code)
    code = re.sub(r'(?<!\w)\s*>\s*(?!\w|=)', r'/* > removed */', code)
    
    # Remove duplicate operators that might be visualization artifacts
    code = re.sub(r'<<\s*<<', r'<<', code)  # Fix double <<
    code = re.sub(r'>>\s*>>', r'>>', code)   # Fix double >>
    
    # Restore all protected constructs
    for placeholder, original in protections:
        code = code.replace(placeholder, original)
    
    # Clean up excessive whitespace but preserve structure
    code = re.sub(r'\n\s*\n\s*\n+', r'\n\n', code)  # Remove excessive blank lines
    code = re.sub(r'[ \t]+', r' ', code)  # Normalize whitespace but keep single spaces
    code = re.sub(r' +\n', r'\n', code)  # Remove trailing spaces
    
    # Verify we haven't broken basic C++ structure
    if not _is_valid_cpp_structure(code):
        print("Warning: Preprocessed code may have structural issues, using original code")
        return original_code
    
    return code

def _is_valid_cpp_structure(code):
    """
    Basic sanity check to ensure we haven't broken essential C++ structure.
    """
    # Check for balanced braces
    open_braces = code.count('{')
    close_braces = code.count('}')
    
    # Check for balanced parentheses
    open_parens = code.count('(')
    close_parens = code.count(')')
    
    # Check that essential keywords still exist
    essential_patterns = [
        r'\bint\s+main\s*\(',  # main function
        r'\breturn\s+',        # return statements
        r'#include\s*<',       # include statements
    ]
    
    has_main = bool(re.search(essential_patterns[0], code))
    has_return = bool(re.search(essential_patterns[1], code))
    has_includes = bool(re.search(essential_patterns[2], code))
    
    # Basic structure validation
    is_balanced = (open_braces == close_braces) and (open_parens == close_parens)
    has_basic_structure = has_main or has_return or has_includes
    
    return is_balanced and has_basic_structure

def preprocess_file(input_file, output_file=None):
    """
    Preprocess a C++ file.
    
    Args:
        input_file (str): Path to input C++ file
        output_file (str): Path to output file (optional, defaults to input_file with _processed suffix)
    """
    try:
        # Read the input file
        with open(input_file, 'r', encoding='utf-8') as f:
            original_code = f.read()
        
        # Preprocess the code
        processed_code = preprocess_cpp_code(original_code)
        
        # Determine output file path
        if output_file is None:
            base, ext = os.path.splitext(input_file)
            output_file = f"{base}_processed{ext}"
        
        # Write the processed code
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(processed_code)
        
        print(f"Preprocessed code written to: {output_file}")
        return output_file
        
    except Exception as e:
        print(f"Error preprocessing file: {e}")
        return None

def main():
    """Main function for command-line usage."""
    if len(sys.argv) < 2:
        print("Usage: python code_preprocessor_frontend.py <input_file> [output_file]")
        print("       python code_preprocessor_frontend.py --string '<code_string>'")
        sys.exit(1)
    
    if sys.argv[1] == '--string':
        # Process code string directly
        if len(sys.argv) < 3:
            print("Error: No code string provided")
            sys.exit(1)
        
        code = sys.argv[2]
        processed = preprocess_cpp_code(code)
        print("=== PREPROCESSED CODE ===")
        print(processed)
        print("=== END PREPROCESSED CODE ===")
    
    else:
        # Process file
        input_file = sys.argv[1]
        output_file = sys.argv[2] if len(sys.argv) > 2 else None
        
        if not os.path.exists(input_file):
            print(f"Error: Input file '{input_file}' not found")
            sys.exit(1)
        
        result = preprocess_file(input_file, output_file)
        if result:
            print(f"Successfully preprocessed: {input_file} -> {result}")
        else:
            print("Preprocessing failed")
            sys.exit(1)

if __name__ == "__main__":
    main() 