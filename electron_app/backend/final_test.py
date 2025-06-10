#!/usr/bin/env python3
"""
Comprehensive test for C++ parser fixes
"""

from myparser import parse_cpp_code, clear_parse_state
import json

def test_case(name, cpp_code, expected_result=True):
    """Test a specific C++ code snippet"""
    print(f"\n🧪 TEST CASE: {name}")
    print("=" * 60)
    print("C++ Code:")
    print(cpp_code)
    print("\n" + "-" * 40)
    
    try:
        clear_parse_state()
        ast, functions, classes = parse_cpp_code(cpp_code, debug=False)
        
        if ast and not (len(ast) == 1 and ast[0].get('type') in ['parse_error', 'parse_exception']):
            print("✅ PARSING SUCCESSFUL!")
            print(f"Generated {len(ast)} AST nodes")
            
            # Analyze the results
            for node in ast:
                if node.get('type') == 'class_declaration':
                    print(f"\n📋 Class: {node.get('name')}")
                    members = node.get('members', [])
                    print(f"Members: {len(members)}")
                    
                    for i, member in enumerate(members):
                        member_type = member.get('type', 'unknown')
                        member_name = member.get('name', 'unnamed')
                        member_access = member.get('access', 'unknown')
                        print(f"  {i+1}. {member_type}: {member_name} ({member_access})")
                        
                        if member.get('pointer'):
                            print(f"     ↳ Pointer: {member.get('pointer')}")
                        if member.get('data_type'):
                            print(f"     ↳ Type: {member.get('data_type')}")
                            
        else:
            print("❌ PARSING FAILED")
            if ast and len(ast) > 0:
                error_node = ast[0]
                print(f"Error: {error_node.get('message', 'Unknown error')}")
                if 'errors' in error_node:
                    for error in error_node['errors']:
                        print(f"  - {error}")
            return False
            
        return True
        
    except Exception as e:
        print(f"💥 EXCEPTION: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def run_comprehensive_tests():
    """Run all test cases"""
    
    print("🚀 C++ Parser Comprehensive Test Suite")
    print("Testing fixes for access specifiers, pointers, and class syntax")
    
    test_results = []
    
    # Test 1: Basic class with public members (the original issue)
    test_results.append(test_case(
        "User's Original Issue - Basic Class with Public Members",
        """
class Node {
public:
    int data;
    Node* next;
};
"""
    ))
    
    # Test 2: Class with constructor and destructor
    test_results.append(test_case(
        "Class with Constructor and Destructor", 
        """
class LinkedList {
public:
    LinkedList();
    ~LinkedList();
    void append(int value);
private:
    Node* head;
    int size;
};
"""
    ))
    
    # Test 3: Multiple access sections
    test_results.append(test_case(
        "Multiple Access Sections",
        """
class MyClass {
    int privateVar;
public:
    int publicVar;
    MyClass();
protected:
    int protectedVar;
private:
    void privateMethod();
};
"""
    ))
    
    # Test 4: Pointers and references
    test_results.append(test_case(
        "Pointer and Reference Declarations",
        """
class PointerTest {
public:
    int* intPtr;
    char* charPtr;
    PointerTest* selfPtr;
};
"""
    ))
    
    # Test 5: Class with methods
    test_results.append(test_case(
        "Class with Method Declarations",
        """
class Calculator {
public:
    int add(int a, int b);
    void setResult(int result);
private:
    int result;
};
"""
    ))
    
    # Test 6: Simple class without access specifiers
    test_results.append(test_case(
        "Class Without Explicit Access Specifiers",
        """
class SimpleClass {
    int x;
    int y;
};
"""
    ))
    
    # Test 7: User's complete example
    test_results.append(test_case(
        "User's Complete Example", 
        """
class Node {
public:
    int data;
    Node* next;
};

class LinkedList {
    Node* head;
public:
    LinkedList();
    void append(int value);
};
"""
    ))
    
    # Summary
    passed = sum(test_results)
    total = len(test_results)
    
    print(f"\n🎯 TEST SUMMARY")
    print("=" * 50)
    print(f"Tests passed: {passed}/{total}")
    print(f"Success rate: {(passed/total)*100:.1f}%")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED! Parser fixes are working correctly.")
    else:
        print("⚠️  Some tests failed. Review the parser implementation.")
    
    return passed == total

if __name__ == "__main__":
    success = run_comprehensive_tests()
    exit(0 if success else 1) 