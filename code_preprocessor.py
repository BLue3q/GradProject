#!/usr/bin/env python3
"""
Code Preprocessor for C++ Code Visualization
Splits C++ code into logical blocks and saves each block to separate files
"""

import sys
import os
import json
import re
from pathlib import Path
import mylexer
import myparser
from mylexer import lexer
from myparser import parser, functions_dict

class CodeBlockPreprocessor:
    def __init__(self, output_dir="code_blocks"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        self.blocks = []
        self.analysis_data = {}
        
    def analyze_code(self, cpp_code, source_file="input.cpp"):
        """Analyze C++ code and extract logical blocks"""
        try:
            # Reset global state
            global functions_dict
            functions_dict.clear()
            
            # Write code to temporary file for analysis
            temp_file = self.output_dir / "temp_input.cpp"
            with open(temp_file, 'w') as f:
                f.write(cpp_code)
            
            # Tokenize the code
            lexer.input(cpp_code)
            tokens = []
            
            # Collect all tokens
            while True:
                tok = lexer.token()
                if not tok:
                    break
                tokens.append({
                    'type': tok.type,
                    'value': str(tok.value),
                    'line': tok.lineno if hasattr(tok, 'lineno') else 1
                })
            
            # Parse the code
            lexer.input(cpp_code)  # Reset lexer
            try:
                ast = parser.parse(cpp_code, lexer=lexer)
                self.analysis_data = {
                    "source_file": source_file,
                    "tokens": tokens,
                    "ast": ast,
                    "functions": functions_dict,
                    "blocks": []
                }
                
                # Split code into logical blocks
                self.extract_blocks(cpp_code, ast)
                
                return True
            except Exception as parse_error:
                print(f"Parse error: {parse_error}")
                # Still extract basic blocks based on structure
                self.extract_basic_blocks(cpp_code)
                return False
                
        except Exception as e:
            print(f"Analysis error: {e}")
            return False
    
    def extract_blocks(self, cpp_code, ast):
        """Extract logical blocks from parsed AST"""
        lines = cpp_code.split('\n')
        
        # Extract includes and headers as first block
        includes = []
        other_lines = []
        in_includes = True
        
        for i, line in enumerate(lines):
            stripped = line.strip()
            if stripped.startswith('#include') or stripped.startswith('using namespace'):
                if in_includes:
                    includes.append((i + 1, line))
                else:
                    other_lines.append((i + 1, line))
            elif stripped == '' or stripped.startswith('//'):
                if in_includes:
                    includes.append((i + 1, line))
                else:
                    other_lines.append((i + 1, line))
            else:
                in_includes = False
                other_lines.append((i + 1, line))
        
        # Create include block if we have includes
        if includes:
            self.create_block("includes", includes, "Header includes and using statements")
        
        # Process AST to find function blocks
        if isinstance(ast, list):
            for item in ast:
                if item and isinstance(item, dict):
                    self.process_ast_item(item, lines)
        elif isinstance(ast, dict):
            self.process_ast_item(ast, lines)
        
        # Create a main execution block if we have remaining code
        remaining_lines = [line for line in other_lines if not self.line_in_existing_block(line[0])]
        if remaining_lines:
            self.create_block("main_execution", remaining_lines, "Main execution code")
    
    def process_ast_item(self, item, lines):
        """Process individual AST items to create blocks"""
        if not isinstance(item, dict):
            return
            
        item_type = item.get('type', '')
        
        if item_type == 'function declaration' or item_type == 'the standard Main_Function':
            # Extract function block
            func_name = item.get('name', 'unknown')
            line_num = item.get('line', 1)
            
            # Find function boundaries
            start_line = line_num
            end_line = self.find_function_end(lines, start_line - 1)
            
            func_lines = [(i + 1, lines[i]) for i in range(start_line - 1, min(end_line, len(lines)))]
            
            block_info = {
                'function_name': func_name,
                'return_type': item.get('return_type', 'void'),
                'params': item.get('params', []),
                'body': item.get('body', [])
            }
            
            self.create_block(f"function_{func_name}", func_lines, f"Function: {func_name}", block_info)
            
        elif item_type == 'class_declaration':
            # Extract class block
            class_name = item.get('name', 'unknown')
            line_num = item.get('line', 1)
            
            # Find class boundaries
            start_line = line_num
            end_line = self.find_class_end(lines, start_line - 1)
            
            class_lines = [(i + 1, lines[i]) for i in range(start_line - 1, min(end_line, len(lines)))]
            
            block_info = {
                'class_name': class_name,
                'members': item.get('members', [])
            }
            
            self.create_block(f"class_{class_name}", class_lines, f"Class: {class_name}", block_info)
    
    def find_function_end(self, lines, start_index):
        """Find the end line of a function"""
        brace_count = 0
        found_opening = False
        
        for i in range(start_index, len(lines)):
            line = lines[i].strip()
            
            for char in line:
                if char == '{':
                    brace_count += 1
                    found_opening = True
                elif char == '}':
                    brace_count -= 1
                    
                    if found_opening and brace_count == 0:
                        return i + 1
        
        return len(lines)
    
    def find_class_end(self, lines, start_index):
        """Find the end line of a class"""
        brace_count = 0
        found_opening = False
        
        for i in range(start_index, len(lines)):
            line = lines[i].strip()
            
            for char in line:
                if char == '{':
                    brace_count += 1
                    found_opening = True
                elif char == '}':
                    brace_count -= 1
                    
                    if found_opening and brace_count == 0:
                        # Look for semicolon after class
                        if i + 1 < len(lines) and ';' in lines[i + 1]:
                            return i + 2
                        return i + 1
        
        return len(lines)
    
    def line_in_existing_block(self, line_num):
        """Check if a line is already included in an existing block"""
        for block in self.blocks:
            for block_line_num, _ in block['lines']:
                if block_line_num == line_num:
                    return True
        return False
    
    def extract_basic_blocks(self, cpp_code):
        """Fallback method to extract basic blocks when parsing fails"""
        lines = cpp_code.split('\n')
        current_block = []
        block_type = "code_block"
        block_count = 1
        
        for i, line in enumerate(lines):
            current_block.append((i + 1, line))
            
            # Simple heuristics for block boundaries
            stripped = line.strip()
            if (stripped.endswith('{') or 
                stripped.endswith('}') or 
                stripped.endswith(';') and not stripped.startswith('#')):
                
                if current_block:
                    self.create_block(f"{block_type}_{block_count}", current_block, 
                                    f"Code block {block_count}")
                    current_block = []
                    block_count += 1
        
        # Add remaining lines as final block
        if current_block:
            self.create_block(f"{block_type}_{block_count}", current_block, 
                            f"Code block {block_count}")
    
    def create_block(self, block_id, lines, description, extra_info=None):
        """Create a code block and save it to file"""
        block_info = {
            'id': block_id,
            'description': description,
            'lines': lines,
            'line_range': (lines[0][0], lines[-1][0]) if lines else (0, 0),
            'code': '\n'.join([line_content for _, line_content in lines])
        }
        
        if extra_info:
            block_info.update(extra_info)
        
        self.blocks.append(block_info)
        
        # Save block to file
        block_file = self.output_dir / f"{block_id}.cpp"
        with open(block_file, 'w') as f:
            f.write(block_info['code'])
        
        print(f"Created block: {block_id} ({description})")
    
    def save_analysis_results(self):
        """Save analysis results to JSON files"""
        # Update analysis data with blocks
        self.analysis_data['blocks'] = self.blocks
        
        # Save complete analysis
        analysis_file = self.output_dir / "analysis.json"
        with open(analysis_file, 'w') as f:
            json.dump(self.analysis_data, f, indent=2)
        
        # Save blocks summary
        blocks_summary = {
            'total_blocks': len(self.blocks),
            'blocks': [
                {
                    'id': block['id'],
                    'description': block['description'],
                    'line_range': block['line_range'],
                    'file': f"{block['id']}.cpp"
                }
                for block in self.blocks
            ]
        }
        
        summary_file = self.output_dir / "blocks_summary.json"
        with open(summary_file, 'w') as f:
            json.dump(blocks_summary, f, indent=2)
        
        print(f"Analysis results saved to {self.output_dir}")
        return str(analysis_file), str(summary_file)

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 code_preprocessor.py <cpp_file> [output_dir]")
        sys.exit(1)
    
    cpp_file = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else "code_blocks"
    
    if not os.path.exists(cpp_file):
        print(f"Error: File {cpp_file} not found")
        sys.exit(1)
    
    # Read C++ code
    with open(cpp_file, 'r') as f:
        cpp_code = f.read()
    
    # Process the code
    preprocessor = CodeBlockPreprocessor(output_dir)
    
    print(f"Analyzing {cpp_file}...")
    success = preprocessor.analyze_code(cpp_code, cpp_file)
    
    if success:
        print("Analysis completed successfully")
    else:
        print("Analysis completed with warnings")
    
    # Save results
    analysis_file, summary_file = preprocessor.save_analysis_results()
    
    print(f"\nResults:")
    print(f"- Analysis data: {analysis_file}")
    print(f"- Blocks summary: {summary_file}")
    print(f"- Total blocks created: {len(preprocessor.blocks)}")
    
    # Print blocks info
    print("\nCode blocks created:")
    for block in preprocessor.blocks:
        print(f"  {block['id']}: {block['description']} (lines {block['line_range'][0]}-{block['line_range'][1]})")

if __name__ == "__main__":
    main() 