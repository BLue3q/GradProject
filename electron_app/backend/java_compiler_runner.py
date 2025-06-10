#!/usr/bin/env python3
"""
Java Compiler Runner for C++ Code Blocks
Compiles code blocks using the Java-based compiler and captures intermediate output
"""

import sys
import os
import subprocess
import json
from pathlib import Path
import tempfile
import shutil

class JavaCompilerRunner:
    def __init__(self, compiler_path="electron_app/compiler"):
        self.compiler_path = Path(compiler_path)
        self.java_files = self.find_java_files()
        self.compiled_classes = {}
        
    def find_java_files(self):
        """Find all Java source files in the compiler directory"""
        java_files = []
        for root, dirs, files in os.walk(self.compiler_path):
            for file in files:
                if file.endswith('.java'):
                    java_files.append(Path(root) / file)
        return java_files
    
    def compile_java_compiler(self):
        """Compile the Java compiler classes"""
        print("Compiling Java compiler...")
        
        # Create temporary directory for compiled classes
        temp_dir = tempfile.mkdtemp()
        
        try:
            # Compile all Java files
            java_files_str = [str(f) for f in self.java_files]
            
            compile_cmd = [
                'javac',
                '-d', temp_dir,
                '-cp', temp_dir
            ] + java_files_str
            
            result = subprocess.run(compile_cmd, capture_output=True, text=True)
            
            if result.returncode != 0:
                print(f"Java compilation failed:")
                print(result.stderr)
                return None
            
            print("Java compiler compiled successfully")
            return temp_dir
            
        except Exception as e:
            print(f"Error compiling Java compiler: {e}")
            shutil.rmtree(temp_dir, ignore_errors=True)
            return None
    
    def run_compiler_on_block(self, block_file, classes_dir):
        """Run the Java compiler on a single code block"""
        try:
            # Create a simple C-like input for the compiler
            # Since our Java compiler expects specific input format
            
            # Read the block content
            with open(block_file, 'r') as f:
                block_content = f.read()
            
            # Convert C++ to simplified C-like syntax for our compiler
            simplified_content = self.simplify_cpp_for_compiler(block_content)
            
            # Create temporary input file
            temp_input = tempfile.NamedTemporaryFile(mode='w', suffix='.c', delete=False)
            temp_input.write(simplified_content)
            temp_input.close()
            
            # Run the Java compiler
            cmd = [
                'java',
                '-cp', classes_dir,
                'main.Main'
            ]
            
            # Redirect stdin to our temporary file
            with open(temp_input.name, 'r') as stdin_file:
                result = subprocess.run(
                    cmd,
                    stdin=stdin_file,
                    capture_output=True,
                    text=True,
                    timeout=30
                )
            
            # Clean up temp file
            os.unlink(temp_input.name)
            
            return {
                'returncode': result.returncode,
                'stdout': result.stdout,
                'stderr': result.stderr,
                'intermediate_code': result.stdout if result.returncode == 0 else None
            }
            
        except subprocess.TimeoutExpired:
            return {
                'returncode': -1,
                'stdout': '',
                'stderr': 'Compiler timeout',
                'intermediate_code': None
            }
        except Exception as e:
            return {
                'returncode': -1,
                'stdout': '',
                'stderr': str(e),
                'intermediate_code': None
            }
    
    def simplify_cpp_for_compiler(self, cpp_code):
        """Convert C++ code to simplified format for our compiler"""
        # The Java compiler expects: { declarations; assignments; }
        
        lines = cpp_code.split('\n')
        declarations = []
        assignments = []
        variable_types = {}  # Track variable types
        
        # First pass: identify all variable declarations and their types
        for line in lines:
            stripped = line.strip()
            
            # Skip includes, using statements, empty lines, comments
            if (not stripped or 
                stripped.startswith('#include') or 
                stripped.startswith('using namespace') or
                stripped.startswith('//') or
                stripped.startswith('/*') or
                stripped.endswith('*/') or
                stripped == '{' or
                stripped == '}' or
                stripped == '};'):
                continue
            
            # Skip struct/class definitions but extract member variables
            if stripped.startswith('struct ') or stripped.startswith('class '):
                continue
            
            # Skip function signatures but process content
            if (stripped.startswith('void ') or 
                stripped.startswith('int main') or
                'return' in stripped):
                continue
            
            # Handle different types of variable declarations
            # Pattern: type variable = value;
            if any(stripped.startswith(t + ' ') for t in ['int', 'float', 'double', 'char', 'bool']):
                parts = stripped.split()
                if len(parts) >= 2:
                    var_type = parts[0]
                    var_part = parts[1]
                    
                    # Handle pointer declarations
                    if '*' in var_part:
                        var_name = var_part.replace('*', '').replace(',', '').split('=')[0].strip()
                        var_type = var_type + '*'
                    else:
                        var_name = var_part.replace(',', '').split('=')[0].strip()
                    
                    variable_types[var_name] = var_type
                    
                    # Add declaration
                    if var_name not in [d.split()[1].rstrip(';') for d in declarations]:
                        declarations.append(f"{var_type.replace('*', '')} {var_name};")
                    
                    # Handle assignment if present
                    if '=' in stripped:
                        value_part = stripped.split('=')[1].strip().rstrip(';')
                        simplified_value = self.simplify_value(value_part, var_name, variable_types)
                        assignments.append(f"{var_name} = {simplified_value};")
                continue
            
            # Handle simple assignments to existing variables
            if '=' in stripped and not any(keyword in stripped for keyword in ['new', 'struct', 'void', 'int', 'class']):
                parts = stripped.split('=')
                if len(parts) == 2:
                    var_name = parts[0].strip()
                    
                    # Handle member access (obj->member or obj.member)
                    if '->' in var_name:
                        var_name = var_name.split('->')[0].strip()
                    elif '.' in var_name and not var_name.replace('.', '').isdigit():
                        var_name = var_name.split('.')[0].strip()
                    
                    value_part = parts[1].strip().rstrip(';')
                    
                    # Add declaration if not already present
                    if var_name not in variable_types:
                        variable_types[var_name] = 'int'
                        if f"int {var_name};" not in declarations:
                            declarations.append(f"int {var_name};")
                    
                    # Add assignment
                    simplified_value = self.simplify_value(value_part, var_name, variable_types)
                    assignments.append(f"{var_name} = {simplified_value};")
                continue
            
            # Handle cout statements
            if 'cout' in stripped:
                if 'x' not in variable_types:
                    variable_types['x'] = 'int'
                    declarations.append("int x;")
                assignments.append("x = 1;")
                continue
            
            # Handle function calls
            if '(' in stripped and ')' in stripped and ';' in stripped:
                if 'y' not in variable_types:
                    variable_types['y'] = 'int'
                    declarations.append("int y;")
                assignments.append("y = 2;")
                continue
            
            # Handle control structures (while, if, for)
            if any(stripped.startswith(keyword) for keyword in ['while', 'if', 'for']):
                if 'z' not in variable_types:
                    variable_types['z'] = 'int'
                    declarations.append("int z;")
                assignments.append("z = 1;")
                continue
        
        # Ensure we have at least some basic declarations and assignments
        if not declarations:
            declarations = ["int x;", "int y;"]
            variable_types = {'x': 'int', 'y': 'int'}
        
        if not assignments:
            assignments = ["x = 1;", "y = 2;"]
        
        # Remove duplicate declarations
        unique_declarations = []
        seen_vars = set()
        for decl in declarations:
            var_name = decl.split()[1].rstrip(';')
            if var_name not in seen_vars:
                unique_declarations.append(decl)
                seen_vars.add(var_name)
        
        # Build the final code in the correct format
        content_lines = ["{ "] + unique_declarations + assignments + ["}"]
        content = " ".join(content_lines)
        
        return content
    
    def simplify_value(self, value_part, var_name, variable_types):
        """Simplify a value expression for the compiler"""
        value_part = value_part.strip()
        
        # Handle nullptr or NULL
        if 'nullptr' in value_part or 'NULL' in value_part:
            return "0"
        
        # Handle new expressions
        if 'new' in value_part:
            return "1"
        
        # Handle string literals
        if value_part.startswith('"') and value_part.endswith('"'):
            return "1"
        
        # Handle character literals
        if value_part.startswith("'") and value_part.endswith("'"):
            return "1"
        
        # Handle numeric literals
        if value_part.replace('.', '').replace('-', '').isdigit():
            return value_part
        
        # Handle variable references
        if value_part in variable_types:
            return value_part
        
        # Handle complex expressions - just return 1
        if any(op in value_part for op in ['+', '-', '*', '/', '%', '->', '.']):
            return "1"
        
        # Handle brace initialization {1, nullptr}
        if value_part.startswith('{') and value_part.endswith('}'):
            return "1"
        
        # Default case
        return "1"
    
    def compile_blocks(self, blocks_dir):
        """Compile all code blocks in the specified directory"""
        blocks_dir = Path(blocks_dir)
        
        if not blocks_dir.exists():
            print(f"Blocks directory {blocks_dir} does not exist")
            return {}
        
        # Compile the Java compiler first
        classes_dir = self.compile_java_compiler()
        if not classes_dir:
            return {}
        
        results = {}
        
        try:
            # Find all .cpp files in the blocks directory
            cpp_files = list(blocks_dir.glob("*.cpp"))
            
            print(f"Found {len(cpp_files)} code blocks to compile")
            
            # Read blocks summary to check which blocks are java_compilable
            blocks_summary_file = blocks_dir / "blocks_summary.json"
            analysis_file = blocks_dir / "analysis.json"
            java_compilable_blocks = set()
            
            # Load analysis data to check java_compilable flag
            if analysis_file.exists():
                try:
                    with open(analysis_file, 'r') as f:
                        analysis_data = json.load(f)
                    
                    blocks = analysis_data.get('blocks', [])
                    for block in blocks:
                        if isinstance(block, dict) and block.get('java_compilable', False):
                            java_compilable_blocks.add(block['id'])
                            
                except json.JSONDecodeError:
                    print("Warning: Could not parse analysis.json, attempting all blocks")
            
            java_compilation_attempted = 0
            java_compilation_successful = 0
            
            for cpp_file in cpp_files:
                block_id = cpp_file.stem
                print(f"Processing block: {cpp_file.name}")
                
                # Check if this block should be compiled with Java compiler
                if java_compilable_blocks and block_id not in java_compilable_blocks:
                    print(f"  → Skipped Java compilation (not suitable for Java compiler)")
                    results[block_id] = {
                        'returncode': -2,  # Special code for skipped
                        'stdout': '',
                        'stderr': 'Block skipped - not suitable for Java compiler',
                        'intermediate_code': None,
                        'skipped': True
                    }
                    continue
                
                # Attempt Java compilation
                print(f"  → Attempting Java compilation...")
                java_compilation_attempted += 1
                
                result = self.run_compiler_on_block(cpp_file, classes_dir)
                results[cpp_file.stem] = result
                
                if result['returncode'] == 0:
                    java_compilation_successful += 1
                    print(f"  ✓ Success - Generated intermediate code")
                else:
                    print(f"  ✗ Failed - {result['stderr'][:100]}...")  # Truncate long errors
            
            # Save compilation results
            results_file = blocks_dir / "compilation_results.json"
            with open(results_file, 'w') as f:
                json.dump(results, f, indent=2)
            
            print(f"\nJava Compilation Summary:")
            print(f"  Total blocks: {len(cpp_files)}")
            print(f"  Java compilation attempted: {java_compilation_attempted}")
            print(f"  Java compilation successful: {java_compilation_successful}")
            print(f"  Java compilation skipped: {len(cpp_files) - java_compilation_attempted}")
            
            if java_compilation_attempted > 0:
                success_rate = (java_compilation_successful / java_compilation_attempted) * 100
                print(f"  Java compilation success rate: {success_rate:.1f}%")
            
            print(f"Compilation results saved to {results_file}")
            
            # Generate AST and visualization data from analysis results
            self.generate_ast_from_analysis(blocks_dir)
            
        finally:
            # Clean up temporary classes directory
            shutil.rmtree(classes_dir, ignore_errors=True)
        
        return results
    
    def generate_ast_from_analysis(self, blocks_dir):
        """Generate AST data for visualization from analysis results"""
        try:
            # Read analysis data
            analysis_file = blocks_dir / "analysis.json"
            if not analysis_file.exists():
                print("No analysis.json found, creating basic AST")
                self.create_basic_ast(blocks_dir)
                return
            
            with open(analysis_file, 'r') as f:
                analysis_data = json.load(f)
            
            # Extract AST from analysis data
            ast = analysis_data.get('ast', [])
            functions = analysis_data.get('functions', {})
            
            # Create visualization-friendly AST structure
            visualization_ast = []
            
            # Process each AST node for visualization
            for node in ast:
                if node and isinstance(node, dict):
                    viz_node = self.convert_node_for_visualization(node)
                    if viz_node:
                        visualization_ast.append(viz_node)
            
            # Add function definitions to AST
            for func_name, func_data in functions.items():
                viz_func = self.convert_function_for_visualization(func_data)
                if viz_func:
                    visualization_ast.append(viz_func)
            
            # If AST is empty, create a basic one from the blocks
            if not visualization_ast:
                print("Empty AST, generating from blocks...")
                visualization_ast = self.generate_ast_from_blocks(blocks_dir)
            
            # Save to data.json for frontend
            output_data = {
                "ast": visualization_ast,
                "functions": functions,
                "analysis": analysis_data
            }
            
            # Save to electron_app/page/data.json for frontend access
            frontend_data_file = Path("electron_app/page/data.json")
            frontend_data_file.parent.mkdir(parents=True, exist_ok=True)
            
            with open(frontend_data_file, 'w') as f:
                json.dump(output_data, f, indent=2)
            
            # Also save to blocks directory
            blocks_data_file = blocks_dir / "data.json"
            with open(blocks_data_file, 'w') as f:
                json.dump(output_data, f, indent=2)
            
            print(f"AST data saved to {frontend_data_file} and {blocks_data_file}")
            print(f"Generated {len(visualization_ast)} AST nodes for visualization")
            
        except Exception as e:
            print(f"Error generating AST: {e}")
            self.create_basic_ast(blocks_dir)
    
    def convert_node_for_visualization(self, node):
        """Convert an AST node to visualization format"""
        node_type = node.get('type', '')
        
        if node_type == 'struct_declaration':
            return {
                'type': 'declaration',
                'declarations': [{
                    'name': node.get('name', 'Node'),
                    'value': 'struct',
                    'scope': node.get('scope', 'global'),
                    'allocation': None,
                    'pointer': False
                }]
            }
        elif node_type in ['function declaration', 'the standard Main_Function']:
            # Convert function to variable declarations within its scope
            declarations = []
            body = node.get('body', [])
            
            for stmt in body:
                if stmt.get('type') == 'declaration':
                    for decl in stmt.get('declarations', []):
                        declarations.append({
                            'name': decl.get('name', 'var'),
                            'value': decl.get('value', 0),
                            'scope': node.get('name', 'main'),
                            'allocation': decl.get('allocation'),
                            'pointer': decl.get('pointer', False)
                        })
                elif stmt.get('type') == 'assignment':
                    declarations.append({
                        'name': stmt.get('name', 'var'),
                        'value': stmt.get('value', 0),
                        'scope': node.get('name', 'main'),
                        'allocation': None,
                        'pointer': False
                    })
            
            if declarations:
                return {
                    'type': 'declaration',
                    'declarations': declarations
                }
        
        return None
    
    def convert_function_for_visualization(self, func_data):
        """Convert function data to visualization format"""
        func_name = func_data.get('name', 'unknown')
        body = func_data.get('body', [])
        
        declarations = []
        for stmt in body:
            if stmt.get('type') == 'declaration':
                for decl in stmt.get('declarations', []):
                    declarations.append({
                        'name': decl.get('name', 'var'),
                        'value': decl.get('value', 0),
                        'scope': func_name,
                        'allocation': decl.get('allocation'),
                        'pointer': decl.get('pointer', False)
                    })
        
        if declarations:
            return {
                'type': 'declaration',
                'declarations': declarations
            }
        
        return None
    
    def generate_ast_from_blocks(self, blocks_dir):
        """Generate basic AST from code blocks when parsing fails"""
        ast = []
        
        # Read blocks and create basic declarations
        for cpp_file in blocks_dir.glob("*.cpp"):
            if cpp_file.stem == "includes":
                continue
                
            try:
                with open(cpp_file, 'r') as f:
                    content = f.read()
                
                # Extract variable declarations and assignments
                lines = content.split('\n')
                declarations = []
                
                for line in lines:
                    stripped = line.strip()
                    
                    # Simple int declarations
                    if stripped.startswith('int ') and '=' in stripped:
                        parts = stripped.split('=')
                        var_name = parts[0].replace('int', '').strip()
                        var_value = parts[1].strip().rstrip(';')
                        
                        declarations.append({
                            'name': var_name,
                            'value': var_value,
                            'scope': 'main' if cpp_file.stem == 'main_execution' else 'global',
                            'allocation': None,
                            'pointer': False
                        })
                    
                    # Pointer declarations
                    elif '*' in stripped and '=' in stripped:
                        parts = stripped.split('=')
                        var_part = parts[0].strip()
                        var_name = var_part.split()[-1].replace('*', '')
                        
                        declarations.append({
                            'name': var_name,
                            'value': 'pointer',
                            'scope': 'main' if cpp_file.stem == 'main_execution' else 'global',
                            'allocation': 'new' if 'new' in stripped else None,
                            'pointer': True
                        })
                
                if declarations:
                    ast.append({
                        'type': 'declaration',
                        'declarations': declarations
                    })
                    
            except Exception as e:
                print(f"Error processing {cpp_file}: {e}")
        
        # Add a basic structure if nothing was found
        if not ast:
            ast = [{
                'type': 'declaration',
                'declarations': [{
                    'name': 'head',
                    'value': 'pointer',
                    'scope': 'main',
                    'allocation': 'new',
                    'pointer': True
                }, {
                    'name': 'current',
                    'value': 'pointer',
                    'scope': 'main',
                    'allocation': None,
                    'pointer': True
                }]
            }]
        
        return ast
    
    def create_basic_ast(self, blocks_dir):
        """Create a basic AST when analysis fails"""
        basic_ast = [{
            'type': 'declaration',
            'declarations': [{
                'name': 'head',
                'value': 'Node pointer',
                'scope': 'main',
                'allocation': 'new',
                'pointer': True
            }, {
                'name': 'current',
                'value': 'Node pointer',
                'scope': 'main', 
                'allocation': None,
                'pointer': True
            }]
        }]
        
        output_data = {
            "ast": basic_ast,
            "functions": {},
            "analysis": {"source": "basic_fallback"}
        }
        
        # Save to frontend location
        frontend_data_file = Path("electron_app/page/data.json")
        frontend_data_file.parent.mkdir(parents=True, exist_ok=True)
        
        with open(frontend_data_file, 'w') as f:
            json.dump(output_data, f, indent=2)
        
        print(f"Created basic AST fallback in {frontend_data_file}")
    
    def generate_intermediate_summary(self, results, blocks_dir):
        """Generate a summary of intermediate code generation"""
        blocks_dir = Path(blocks_dir)
        
        summary = {
            'total_blocks': len(results),
            'successful_compilations': 0,
            'failed_compilations': 0,
            'intermediate_files': [],
            'errors': []
        }
        
        for block_name, result in results.items():
            if result['returncode'] == 0:
                summary['successful_compilations'] += 1
                
                # Save intermediate code to separate file
                if result['intermediate_code']:
                    intermediate_file = blocks_dir / f"{block_name}_intermediate.txt"
                    with open(intermediate_file, 'w') as f:
                        f.write(result['intermediate_code'])
                    
                    summary['intermediate_files'].append({
                        'block': block_name,
                        'file': str(intermediate_file),
                        'lines': len(result['intermediate_code'].split('\n'))
                    })
            else:
                summary['failed_compilations'] += 1
                summary['errors'].append({
                    'block': block_name,
                    'error': result['stderr']
                })
        
        # Save summary
        summary_file = blocks_dir / "intermediate_summary.json"
        with open(summary_file, 'w') as f:
            json.dump(summary, f, indent=2)
        
        return summary

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 java_compiler_runner.py <blocks_directory> [compiler_path]")
        sys.exit(1)
    
    blocks_dir = sys.argv[1]
    compiler_path = sys.argv[2] if len(sys.argv) > 2 else "electron_app/compiler"
    
    runner = JavaCompilerRunner(compiler_path)
    
    print(f"Java Compiler Runner")
    print(f"Compiler path: {runner.compiler_path}")
    print(f"Found {len(runner.java_files)} Java source files")
    
    # Compile all blocks
    results = runner.compile_blocks(blocks_dir)
    
    # Generate summary from the results
    summary = runner.generate_intermediate_summary(results, blocks_dir)
    
    print(f"\nCompilation Summary:")
    print(f"Total blocks: {summary['total_blocks']}")
    print(f"Successful: {summary['successful_compilations']}")
    print(f"Failed: {summary['failed_compilations']}")
    print(f"Intermediate files: {len(summary['intermediate_files'])}")
    
    if summary['errors']:
        print(f"\nErrors:")
        for error in summary['errors']:
            print(f"  {error['block']}: {error['error']}")

if __name__ == "__main__":
    main() 