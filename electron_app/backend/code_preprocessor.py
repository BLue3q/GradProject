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
            
            print(f"Analyzing C++ code ({len(cpp_code)} characters)")
            
            # Use the enhanced parser
            from myparser import parse_cpp_code, generate_json
            
            # Parse the code with debugging enabled
            ast, functions_dict, classes_dict = parse_cpp_code(cpp_code, debug=True)
            
            print(f"Parser returned AST with {len(ast)} nodes")
            
            # Store analysis data
            self.analysis_data = {
                "source_file": source_file,
                "ast": ast,
                "functions": functions_dict,
                "classes": classes_dict,
                "blocks": []
            }
            
            # Generate JSON output for debugging
            generate_json(ast, functions_dict, classes_dict, 'parser_output.json')
            
            # Split code into logical blocks
            if ast and len(ast) > 0:
                print("AST generated successfully, extracting blocks...")
                self.extract_blocks(cpp_code, ast)
                return True
            else:
                print("Empty AST returned, extracting basic blocks...")
                self.extract_basic_blocks(cpp_code)
                return False
                
        except Exception as e:
            print(f"Analysis error: {e}")
            import traceback
            traceback.print_exc()
            # Fall back to basic block extraction
            self.extract_basic_blocks(cpp_code)
            return False
    
    def extract_blocks(self, cpp_code, ast):
        """Extract logical blocks from parsed AST with semantic grouping"""
        print("Extracting semantic blocks from AST...")
        
        # Create semantic blocks based on AST structure
        self.create_semantic_blocks(cpp_code, ast)
        
        # Ensure we have at least some basic analysis
        if not self.blocks:
            print("No semantic blocks created, falling back to basic extraction")
            self.extract_basic_blocks(cpp_code)
    
    def create_semantic_blocks(self, cpp_code, ast):
        """Create meaningful blocks based on code structure"""
        lines = cpp_code.split('\n')
        
        # Track created blocks to avoid duplicates
        created_block_types = set()
        
        for node in ast:
            if not isinstance(node, dict):
                continue
                
            node_type = node.get('type', '')
            
            # Handle class declarations
            if node_type == 'class_declaration':
                class_name = node.get('name', 'UnknownClass')
                if f'class_{class_name}' not in created_block_types:
                    self.create_class_block(node, lines)
                    created_block_types.add(f'class_{class_name}')
            
            # Handle function declarations
            elif node_type == 'function declaration':
                func_name = node.get('name', 'unknown_function')
                if f'function_{func_name}' not in created_block_types:
                    self.create_function_block(node, lines)
                    created_block_types.add(f'function_{func_name}')
            
            # Handle main function
            elif node_type == 'the standard Main_Function ':
                if 'main_function' not in created_block_types:
                    self.create_main_function_block(node, lines)
                    created_block_types.add('main_function')
            
            # Handle variable declarations
            elif node_type == 'declaration':
                declarations = node.get('declarations', [])
                for decl in declarations:
                    var_name = decl.get('name', 'unknown_var')
                    if f'variable_{var_name}' not in created_block_types:
                        self.create_variable_block(decl, node.get('data_type', 'unknown'), lines)
                        created_block_types.add(f'variable_{var_name}')
        
        print(f"Created {len(self.blocks)} semantic blocks")
    
    def create_class_block(self, class_node, lines):
        """Create a block for a class declaration"""
        class_name = class_node.get('name', 'UnknownClass')
        line_num = class_node.get('line', 1)
        
        # Find class definition in source
        class_start = None
        class_end = None
        brace_count = 0
        
        for i, line in enumerate(lines):
            if f'class {class_name}' in line:
                class_start = i
                brace_count = line.count('{') - line.count('}')
                break
        
        if class_start is not None:
            # Find end of class
            for i in range(class_start + 1, len(lines)):
                brace_count += lines[i].count('{') - lines[i].count('}')
                if brace_count <= 0:
                    class_end = i
                    break
            
            if class_end is not None:
                # Extract class lines
                class_lines = [(i + 1, lines[i]) for i in range(class_start, class_end + 1)]
                
                # Create block info
                members = class_node.get('members', [])
                member_summary = []
                for member in members:
                    member_type = member.get('type', 'unknown')
                    member_name = member.get('name', 'unnamed')
                    member_summary.append(f"{member_type}: {member_name}")
                
                block_info = {
                    'type': 'class',
                    'class_name': class_name,
                    'member_count': len(members),
                    'members': member_summary,
                    'line_range': [class_start + 1, class_end + 1],
                    'semantic': True
                }
                
                description = f"Class {class_name} with {len(members)} members"
                self.create_block(f"class_{class_name}", class_lines, description, block_info)
    
    def create_function_block(self, func_node, lines):
        """Create a block for a function declaration"""
        func_name = func_node.get('name', 'unknown_function')
        line_num = func_node.get('line', 1)
        return_type = func_node.get('return_type', 'void')
        params = func_node.get('params', [])
        
        # Find function in source
        func_start = None
        func_end = None
        
        # Look for function signature
        for i, line in enumerate(lines):
            if func_name in line and '(' in line and ')' in line:
                func_start = i
                brace_count = line.count('{') - line.count('}')
                
                # If function starts with opening brace, find matching closing brace
                if '{' in line:
                    for j in range(i + 1, len(lines)):
                        brace_count += lines[j].count('{') - lines[j].count('}')
                        if brace_count <= 0:
                            func_end = j
                            break
                else:
                    # Function declaration only (no body)
                    func_end = i
                break
        
        if func_start is not None and func_end is not None:
            func_lines = [(i + 1, lines[i]) for i in range(func_start, func_end + 1)]
            
            param_summary = [f"{p.get('data_type', 'unknown')} {p.get('name', 'param')}" for p in params]
            
            block_info = {
                'type': 'function',
                'function_name': func_name,
                'return_type': return_type,
                'parameters': param_summary,
                'line_range': [func_start + 1, func_end + 1],
                'semantic': True
            }
            
            description = f"Function {func_name}({', '.join(param_summary)}) -> {return_type}"
            self.create_block(f"function_{func_name}", func_lines, description, block_info)
    
    def create_main_function_block(self, main_node, lines):
        """Create a block for the main function"""
        line_num = main_node.get('line', 1)
        
        # Find main function
        main_start = None
        main_end = None
        
        for i, line in enumerate(lines):
            if 'int main' in line and '(' in line:
                main_start = i
                brace_count = line.count('{') - line.count('}')
                
                for j in range(i + 1, len(lines)):
                    brace_count += lines[j].count('{') - lines[j].count('}')
                    if brace_count <= 0:
                        main_end = j
                        break
                break
        
        if main_start is not None and main_end is not None:
            main_lines = [(i + 1, lines[i]) for i in range(main_start, main_end + 1)]
            
            body_statements = main_node.get('body', [])
            
            block_info = {
                'type': 'main_function',
                'statement_count': len(body_statements),
                'line_range': [main_start + 1, main_end + 1],
                'semantic': True
            }
            
            description = f"Main function with {len(body_statements)} statements"
            self.create_block("main_function", main_lines, description, block_info)
    
    def create_variable_block(self, var_decl, data_type, lines):
        """Create a block for variable declarations"""
        var_name = var_decl.get('name', 'unknown_var')
        
        # This is simplified - in practice, we might group related variables
        # For now, we'll create a simple summary block instead of individual variable blocks
        pass  # Skip individual variable blocks to avoid over-segmentation
    
    def is_valid_block_content(self, lines):
        """Check if block content is valid and substantial enough to extract"""
        if not lines:
            return False
        
        content = '\n'.join(lines).strip()
        
        # Skip if too short
        if len(content) < 10:
            return False
        
        # Skip if only contains partial expressions
        if content.count(';') == 0 and content.count('{') == 0:
            return False
        
        # Skip if unbalanced braces
        open_braces = content.count('{')
        close_braces = content.count('}')
        if open_braces != close_braces:
            return False
        
        # Skip if it's just a single assignment or expression
        lines_with_content = [line.strip() for line in lines if line.strip()]
        if len(lines_with_content) == 1:
            single_line = lines_with_content[0]
            if ('=' in single_line and 
                not single_line.startswith('int ') and 
                not single_line.startswith('float ') and 
                not single_line.startswith('char ')):
                return False
        
        return True
    
    def function_is_complete(self, func_lines):
        """Check if function definition is complete and meaningful"""
        if not func_lines:
            return False
        
        func_content = '\n'.join(func_lines)
        
        # Must have function signature with parentheses
        if '(' not in func_content or ')' not in func_content:
            return False
        
        # Must have body with braces
        if '{' not in func_content or '}' not in func_content:
            return False
        
        # Must have some meaningful content inside function body
        lines_in_body = []
        inside_function = False
        brace_count = 0
        
        for line in func_lines:
            if '{' in line:
                inside_function = True
                brace_count += line.count('{')
                brace_count -= line.count('}')
            elif inside_function and brace_count > 0:
                stripped = line.strip()
                if stripped and not stripped.startswith('//'):
                    lines_in_body.append(stripped)
                brace_count += line.count('{')
                brace_count -= line.count('}')
        
        # Function must have at least 1 meaningful statement
        meaningful_statements = [line for line in lines_in_body 
                               if (';' in line or '{' in line) and line != '}']
        
        return len(meaningful_statements) >= 1
    
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
        
        # Save blocks summary with updated structure
        blocks_summary = {
            'total_blocks': len(self.blocks),
            'blocks': [
                {
                    'id': block['id'],
                    'description': block.get('name', f"Block {block['id']}"),  # Use name as description
                    'line_range': block.get('line_range', [block.get('start_line', 0), block.get('end_line', 0)]),
                    'file': f"{block['id']}.cpp",
                    'type': block.get('type', 'unknown'),
                    'name': block.get('name', 'unknown')
                }
                for block in self.blocks
            ]
        }
        
        summary_file = self.output_dir / "blocks_summary.json"
        with open(summary_file, 'w') as f:
            json.dump(blocks_summary, f, indent=2)
        
        print(f"Analysis results saved to {self.output_dir}")
        return str(analysis_file), str(summary_file)
    
    def contains_simple_variables(self, lines):
        """Check if code contains simple variable declarations/assignments that can be compiled by Java compiler"""
        content = '\n'.join(lines)
        
        # Look for simple variable patterns
        simple_patterns = [
            r'\bint\s+\w+\s*=\s*\d+',     # int x = 5;
            r'\b\w+\s*=\s*\d+',           # x = 5;
            r'\bfloat\s+\w+\s*=\s*\d+',   # float x = 5.0;
            r'\bchar\s+\w+\s*=',          # char c = 'a';
        ]
        
        for pattern in simple_patterns:
            if re.search(pattern, content):
                return True
        
        # Check for at least some variable assignments even if complex
        if re.search(r'\w+\s*=\s*[^;]+;', content):
            return True
            
        return False
    
    def extract_simple_variables(self, main_content, function_definitions):
        """Extract simple variable declarations and assignments"""
        variables = {}
        
        # Process main content
        if main_content:
            self.process_lines_for_variables(main_content, variables)
        
        # Process function content
        for func_lines in function_definitions.values():
            self.process_lines_for_variables(func_lines, variables)
        
        return variables
    
    def process_lines_for_variables(self, lines, variables):
        """Process lines to extract variable information"""
        for line in lines:
            stripped = line.strip()
            
            # Skip non-variable lines
            if (not stripped or 
                stripped.startswith('#') or 
                stripped.startswith('//') or
                stripped.startswith('using') or
                stripped.startswith('struct') or
                stripped.startswith('void') or
                stripped.startswith('int main') or
                stripped in ['{', '}', '};'] or
                'cout' in stripped or
                'return' in stripped):
                continue
            
            # Extract simple int declarations
            if stripped.startswith('int '):
                parts = stripped.split('=')
                if len(parts) == 2:
                    var_name = parts[0].replace('int', '').strip().replace('*', '')
                    value_str = parts[1].strip().rstrip(';')
                    
                    # Try to extract a simple numeric value
                    if value_str.isdigit():
                        variables[var_name] = {'type': 'int', 'value': value_str}
                    elif 'new' in value_str or 'nullptr' in value_str:
                        variables[var_name] = {'type': 'int', 'value': '1'}
                    else:
                        variables[var_name] = {'type': 'int', 'value': '0'}
            
            # Extract simple assignments
            elif '=' in stripped and ';' in stripped:
                parts = stripped.split('=')
                if len(parts) == 2:
                    var_name = parts[0].strip()
                    
                    # Clean up variable name (remove -> and . access)
                    if '->' in var_name:
                        var_name = var_name.split('->')[0].strip()
                    elif '.' in var_name and not var_name.replace('.', '').isdigit():
                        var_name = var_name.split('.')[0].strip()
                    
                    if var_name.isalpha() or var_name.replace('_', '').isalnum():
                        value_str = parts[1].strip().rstrip(';')
                        
                        if value_str.isdigit():
                            variables[var_name] = {'type': 'int', 'value': value_str}
                        else:
                            variables[var_name] = {'type': 'int', 'value': '1'}
    
    def is_simple_struct(self, struct_lines):
        """Check if struct is simple enough to be useful"""
        content = '\n'.join(struct_lines)
        
        # Count number of members
        member_count = content.count(';')
        
        # Simple structs have 2-5 members
        if 2 <= member_count <= 5:
            return True
            
        return False
    
    def extract_pointer_variables(self, main_content, function_definitions):
        """Extract pointer variable information"""
        variables = {}
        
        # Process main content
        if main_content:
            self.process_lines_for_pointers(main_content, variables)
        
        # Process function content
        for func_lines in function_definitions.values():
            self.process_lines_for_pointers(func_lines, variables)
        
        return variables
    
    def process_lines_for_pointers(self, lines, variables):
        """Process lines to extract pointer variable information"""
        for line in lines:
            stripped = line.strip()
            
            # Skip non-variable lines
            if (not stripped or 
                stripped.startswith('#') or 
                stripped.startswith('//') or
                stripped.startswith('using') or
                stripped.startswith('struct') or
                stripped.startswith('void') or
                stripped.startswith('int main') or
                stripped in ['{', '}', '};'] or
                'cout' in stripped or
                'return' in stripped):
                continue
            
            # Extract pointer declarations like Node* head
            if '*' in stripped and '=' in stripped:
                parts = stripped.split('=')
                if len(parts) == 2:
                    var_part = parts[0].strip()
                    value_str = parts[1].strip().rstrip(';')
                    
                    # Extract variable name from "Type* varname" format
                    if '*' in var_part:
                        var_name = var_part.split('*')[-1].strip()
                        
                        if var_name.isalpha() or var_name.replace('_', '').isalnum():
                            # Convert pointer values to simple integers
                            if 'new' in value_str:
                                variables[var_name] = {'type': 'int', 'value': '1'}
                            elif 'nullptr' in value_str or 'NULL' in value_str:
                                variables[var_name] = {'type': 'int', 'value': '0'}
                            else:
                                variables[var_name] = {'type': 'int', 'value': '1'}

    def read_output_json_and_detect_blocks(self, json_file="output.json"):
        """Read output.json and detect code blocks using stack-based curly brace parsing"""
        try:
            # Read the JSON file
            if not os.path.exists(json_file):
                print(f"Error: {json_file} not found")
                return False
            
            with open(json_file, 'r') as f:
                data = json.load(f)
            
            if not data.get('parsing_success', False):
                print(f"Parsing was not successful: {data.get('error', 'Unknown error')}")
                return False
            
            # Extract raw code lines
            code_lines = data.get('raw_code', [])
            if not code_lines:
                print("No code lines found in output.json")
                return False
            
            print(f"Detecting blocks in {len(code_lines)} lines of code...")
            
            # Store the analysis data
            self.analysis_data = {
                "source_file": "tested_code.txt",
                "ast": data.get('ast', []),
                "functions": data.get('functions', {}),
                "classes": data.get('classes', {}),
                "blocks": []
            }
            
            # Use stack-based block detection
            detected_blocks = self.detect_blocks_with_stack(code_lines)
            
            # Combine with AST-based semantic information
            enhanced_blocks = self.enhance_blocks_with_ast_info(detected_blocks, data.get('ast', []))
            
            self.blocks = enhanced_blocks
            self.analysis_data['blocks'] = enhanced_blocks
            
            print(f"✅ Detected {len(enhanced_blocks)} code blocks")
            return True
            
        except Exception as e:
            print(f"Error reading output.json: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def detect_blocks_with_stack(self, code_lines):
        """Use stack-based parsing to detect code blocks by tracking curly braces"""
        blocks = []
        stack = []  # Stack to track opening braces
        current_block = None
        block_id = 1
        
        for line_num, line in enumerate(code_lines, 1):
            stripped_line = line.strip()
            
            # Skip empty lines and comments
            if not stripped_line or stripped_line.startswith('//') or stripped_line.startswith('#'):
                continue
            
            # Count braces in this line
            open_braces = line.count('{')
            close_braces = line.count('}')
            
            # Detect block start
            if open_braces > 0:
                # Determine block type from line content
                block_type = self.determine_block_type(stripped_line)
                block_name = self.extract_block_name(stripped_line, block_type)
                
                # Start new block
                new_block = {
                    'id': f"block_{block_id}",
                    'name': block_name,
                    'type': block_type,
                    'start_line': line_num,
                    'end_line': None,
                    'depth': len(stack),
                    'content_lines': [line],
                    'semantic': True
                }
                
                # Push to stack for each opening brace
                for _ in range(open_braces):
                    stack.append({
                        'block': new_block,
                        'line_num': line_num
                    })
                
                current_block = new_block
                block_id += 1
            
            # Add line to current block if we're inside one
            if stack and current_block:
                if line_num > current_block['start_line']:
                    current_block['content_lines'].append(line)
            
            # Detect block end
            if close_braces > 0:
                for _ in range(close_braces):
                    if stack:
                        completed_block_info = stack.pop()
                        completed_block = completed_block_info['block']
                        
                        # Finalize the block
                        completed_block['end_line'] = line_num
                        completed_block['line_range'] = [completed_block['start_line'], completed_block['end_line']]
                        completed_block['code'] = '\n'.join(completed_block['content_lines'])
                        
                        # Remove content_lines to clean up
                        del completed_block['content_lines']
                        
                        # Add to blocks list
                        blocks.append(completed_block)
                        
                        # Update current_block to parent block if stack not empty
                        current_block = stack[-1]['block'] if stack else None
        
        return blocks
    
    def determine_block_type(self, line):
        """Determine the type of code block from the line content"""
        line_lower = line.lower()
        
        if 'class ' in line_lower:
            return 'class'
        elif 'int main' in line_lower or 'void main' in line_lower:
            return 'main_function'
        elif any(keyword in line_lower for keyword in ['int ', 'void ', 'float ', 'double ', 'char ']) and '(' in line and ')' in line:
            return 'function'
        elif 'if ' in line_lower:
            return 'if_statement'
        elif 'else' in line_lower:
            return 'else_statement'
        elif 'while ' in line_lower:
            return 'while_loop'
        elif 'for ' in line_lower:
            return 'for_loop'
        elif 'switch ' in line_lower:
            return 'switch_statement'
        elif 'try' in line_lower:
            return 'try_block'
        elif 'catch' in line_lower:
            return 'catch_block'
        else:
            return 'code_block'
    
    def extract_block_name(self, line, block_type):
        """Extract a meaningful name for the block"""
        if block_type == 'class':
            # Extract class name: "class MyClass {" -> "MyClass"
            parts = line.split()
            for i, part in enumerate(parts):
                if part.lower() == 'class' and i + 1 < len(parts):
                    return parts[i + 1].replace('{', '').strip()
            return 'UnknownClass'
        
        elif block_type in ['function', 'main_function']:
            # Extract function name: "int myFunction(" -> "myFunction"
            if '(' in line:
                before_paren = line.split('(')[0].strip()
                parts = before_paren.split()
                if len(parts) >= 2:
                    return parts[-1]  # Last part before parentheses
            return 'unknown_function'
        
        elif block_type in ['if_statement', 'while_loop', 'for_loop']:
            # Extract condition if possible
            if '(' in line and ')' in line:
                condition_start = line.find('(')
                condition_end = line.rfind(')')
                condition = line[condition_start+1:condition_end].strip()
                return f"{block_type}_{hash(condition) % 1000}"
            return block_type
        
        else:
            return f"{block_type}_{hash(line) % 1000}"
    
    def enhance_blocks_with_ast_info(self, detected_blocks, ast_nodes):
        """Enhance stack-detected blocks with AST semantic information"""
        enhanced_blocks = []
        
        for block in detected_blocks:
            enhanced_block = block.copy()
            
            # Try to find matching AST node
            matching_ast_node = self.find_matching_ast_node(block, ast_nodes)
            
            if matching_ast_node:
                # Add AST information
                enhanced_block['ast_info'] = {
                    'type': matching_ast_node.get('type'),
                    'scope': matching_ast_node.get('scope'),
                    'line': matching_ast_node.get('line')
                }
                
                # For classes, add member information
                if matching_ast_node.get('type') == 'class_declaration':
                    enhanced_block['members'] = matching_ast_node.get('members', [])
                    enhanced_block['member_count'] = len(matching_ast_node.get('members', []))
                
                # For functions, add parameter information
                elif 'function' in matching_ast_node.get('type', ''):
                    enhanced_block['return_type'] = matching_ast_node.get('return_type')
                    enhanced_block['parameters'] = matching_ast_node.get('params', [])
                    enhanced_block['parameter_count'] = len(matching_ast_node.get('params', []))
            
            enhanced_blocks.append(enhanced_block)
        
        return enhanced_blocks
    
    def find_matching_ast_node(self, block, ast_nodes):
        """Find AST node that matches the detected block"""
        for node in ast_nodes:
            if not isinstance(node, dict):
                continue
            
            node_line = node.get('line', 0)
            
            # Check if AST node line falls within block range
            if (block['start_line'] <= node_line <= block.get('end_line', block['start_line']) or
                abs(node_line - block['start_line']) <= 2):  # Allow small line number differences
                
                # Check if types match
                node_type = node.get('type', '')
                if ((block['type'] == 'class' and node_type == 'class_declaration') or
                    (block['type'] in ['function', 'main_function'] and 'function' in node_type.lower()) or
                    (block['type'] == 'main_function' and 'main' in node_type.lower())):
                    return node
        
        return None

    def process_output_json_pipeline(self, json_file="output.json"):
        """Complete pipeline: read output.json -> detect blocks -> save results"""
        print("🔄 Starting output.json processing pipeline...")
        
        # Step 1: Read output.json and detect blocks
        if not self.read_output_json_and_detect_blocks(json_file):
            print("❌ Failed to read output.json or detect blocks")
            return False
        
        # Step 2: Save analysis results
        analysis_file, summary_file = self.save_analysis_results()
        
        print(f"✅ Pipeline completed successfully!")
        print(f"   - Analysis data: {analysis_file}")
        print(f"   - Blocks summary: {summary_file}")
        print(f"   - Total blocks: {len(self.blocks)}")
        
        # Step 3: Print block summary
        print("\n📦 Detected blocks:")
        for block in self.blocks:
            print(f"   - {block['id']}: {block['name']} ({block['type']}) "
                  f"[lines {block['start_line']}-{block.get('end_line', '?')}]")
        
        return True

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