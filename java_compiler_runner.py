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
        # Basic transformations to make C++ compatible with our simple compiler
        
        # Remove includes and using statements
        lines = cpp_code.split('\n')
        simplified_lines = []
        
        for line in lines:
            stripped = line.strip()
            
            # Skip includes and using statements
            if stripped.startswith('#include') or stripped.startswith('using namespace'):
                continue
            
            # Convert std::cout to simple print statements
            if 'std::cout' in line:
                # Convert cout statements to simple assignments
                # This is a very basic transformation
                simplified_lines.append('// Converted cout statement')
                continue
            
            # Convert C++ specific syntax
            if '::' in line:
                line = line.replace('::', '_')
            
            simplified_lines.append(line)
        
        # Add basic program structure if needed
        content = '\n'.join(simplified_lines).strip()
        
        if content and not content.startswith('{'):
            # Wrap in a basic block structure
            content = '{\n' + content + '\n}'
        
        return content
    
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
            
            for cpp_file in cpp_files:
                print(f"Compiling block: {cpp_file.name}")
                
                result = self.run_compiler_on_block(cpp_file, classes_dir)
                results[cpp_file.stem] = result
                
                if result['returncode'] == 0:
                    print(f"  ✓ Success - Generated intermediate code")
                else:
                    print(f"  ✗ Failed - {result['stderr']}")
            
            # Save compilation results
            results_file = blocks_dir / "compilation_results.json"
            with open(results_file, 'w') as f:
                json.dump(results, f, indent=2)
            
            print(f"Compilation results saved to {results_file}")
            
        finally:
            # Clean up temporary classes directory
            shutil.rmtree(classes_dir, ignore_errors=True)
        
        return results
    
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
    
    # Generate summary
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