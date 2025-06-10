#!/usr/bin/env python3
"""
Debug test for access specifier parsing
"""

from myparser import parse_cpp_code, clear_parse_state, current_access_level, set_current_access
import json

def test_debug_access():
    """Debug access specifier parsing"""
    
    print("🔧 Debug Test: Access Specifier Parsing")
    print("=" * 50)
    
    # Test each token separately first
    from mylexer import lexer
    
    test_tokens = "class Node { public: int data; Node* next; };"
    print(f"Test input: {test_tokens}")
    print("\n🔤 Tokenization:")
    
    lexer.input(test_tokens)
    tokens = []
    while True:
        tok = lexer.token()
        if not tok:
            break
        tokens.append((tok.type, tok.value))
        print(f"  {tok.type}: '{tok.value}'")
    
    # Check if PUBLIC and COLON tokens are recognized
    print(f"\n✅ Found tokens: {len(tokens)}")
    has_public = any(t[0] == 'PUBLIC' for t in tokens)
    has_colon = any(t[0] == 'COLON' for t in tokens)
    print(f"PUBLIC token found: {has_public}")
    print(f"COLON token found: {has_colon}")
    
    # Now test full parsing
    cpp_code = """
class Node {
public:
    int data;
    Node* next;
};
"""
    
    print(f"\n🎯 Full Parsing Test:")
    print(f"Current access level before: {current_access_level}")
    
    try:
        clear_parse_state()
        ast, functions, classes = parse_cpp_code(cpp_code, debug=False)
        
        print(f"Current access level after: {current_access_level}")
        
        if ast and len(ast) > 0 and ast[0].get('type') != 'parse_error':
            print("✅ Parsing succeeded")
            class_node = ast[0]
            
            print(f"\n📋 Class: {class_node.get('name')}")
            print(f"Members: {len(class_node.get('members', []))}")
            
            for i, member in enumerate(class_node.get('members', [])):
                print(f"\n  Member {i+1}:")
                print(f"    Type: {member.get('type')}")
                print(f"    Name: {member.get('name')}")
                print(f"    Access: {member.get('access')}")
                print(f"    Line: {member.get('line')}")
                if member.get('pointer'):
                    print(f"    Pointer: {member.get('pointer')}")
        else:
            print("❌ Parsing failed")
            if ast:
                print(f"Error: {ast[0]}")
        
    except Exception as e:
        print(f"💥 Exception: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_debug_access() 