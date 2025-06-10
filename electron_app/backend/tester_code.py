#!/usr/bin/env python3
"""
Tester Code: Parse C++ code from tested_code.txt and generate output.json
"""

import sys
import json
import os
from myparser import parse_cpp_code, clear_parse_state

def main():
    try:
        # Read code from tested_code.txt
        input_file = "tested_code.txt"
        if not os.path.exists(input_file):
            print(f"Error: {input_file} not found")
            return False
            
        with open(input_file, "r") as file:
            tested_code = file.read()
        
        print(f"Processing {len(tested_code)} characters of C++ code...")
        
        # Parse the code using our parser
        ast, functions_dict, classes_dict = parse_cpp_code(tested_code, debug=True)
        
        # Create structured output for frontend
        output_data = {
            "source": "tester_code.py",
            "timestamp": str(os.path.getmtime(input_file)),
            "code_length": len(tested_code),
            "parsing_success": ast is not None and len(ast) > 0,
            "ast": ast,
            "functions": functions_dict,
            "classes": classes_dict,
            "raw_code": tested_code.split('\n'),  # Split into lines for block detection
            "analysis_metadata": {
                "total_nodes": len(ast) if ast else 0,
                "function_count": len(functions_dict),
                "class_count": len(classes_dict),
                "lines_of_code": len(tested_code.split('\n'))
            }
        }
        
        # Write to output.json
        output_file = "output.json"
        with open(output_file, "w") as f:
            json.dump(output_data, f, indent=2)
        
        print(f"✅ Generated {output_file} successfully")
        print(f"   - AST nodes: {output_data['analysis_metadata']['total_nodes']}")
        print(f"   - Functions: {output_data['analysis_metadata']['function_count']}")
        print(f"   - Classes: {output_data['analysis_metadata']['class_count']}")
        print(f"   - Lines of code: {output_data['analysis_metadata']['lines_of_code']}")
        
        return True
        
    except Exception as e:
        print(f"Error in tester_code.py: {e}")
        import traceback
        traceback.print_exc()
        
        # Create error output
        error_output = {
            "source": "tester_code.py",
            "parsing_success": False,
            "error": str(e),
            "ast": [],
            "functions": {},
            "classes": {},
            "raw_code": [],
            "analysis_metadata": {
                "total_nodes": 0,
                "function_count": 0,
                "class_count": 0,
                "lines_of_code": 0
            }
        }
        
        with open("output.json", "w") as f:
            json.dump(error_output, f, indent=2)
        
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)

# atifacts describe parser
# introduction
# project goals scope
# simialr projects and what difference
# parser tools , description of parser , grammer
# how to use parser
# problems and how solved
# json manual

# desktop application ,interface 
# how connected to parser via block diagram
# draw to the app how it works
# how to use the app
# manual for the app

# visualization
# tools
# what mean , how work
# how to use it
