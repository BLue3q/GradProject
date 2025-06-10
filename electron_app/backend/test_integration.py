#!/usr/bin/env python3
"""
Integration test for the complete save-and-process pipeline
"""

import os
import json
import subprocess
import sys

def test_integration():
    """Test the complete integration pipeline"""
    print("🧪 Testing Complete Integration Pipeline")
    print("=" * 50)
    
    # Sample C++ code to test
    test_code = '''class Node {
public:
    int data;
    Node* next;
};

class LinkedList {
private:
    Node* head;
public:
    LinkedList() {
        head = nullptr;
    }
    
    void append(int value) {
        Node* newNode = new Node{};
        newNode->data = value;
        newNode->next = nullptr;
        
        if (head == nullptr) {
            head = newNode;
        } else {
            Node* temp = head;
            while (temp->next != nullptr) {
                temp = temp->next;
            }
            temp->next = newNode;
        }
    }
    
    void print() {
        Node* temp = head;
        while (temp != nullptr) {
            temp = temp->next;
        }
    }
};

int main() {
    LinkedList list1;
    list1.append(1);
    list1.append(2);
    list1.print();
    
    LinkedList* list2 = new LinkedList{};
    list2->append(10);
    list2->print();
    
    delete list2;
}'''
    
    # Step 1: Write test code to tested_code.txt
    print("📝 Step 1: Writing test code to tested_code.txt...")
    with open('tested_code.txt', 'w') as f:
        f.write(test_code)
    print("✅ Code written successfully")
    
    # Step 2: Run tester_code.py
    print("\n🔄 Step 2: Running tester_code.py...")
    result = subprocess.run(['python3', 'tester_code.py'], 
                          capture_output=True, text=True)
    
    if result.returncode == 0:
        print("✅ Parser completed successfully")
        print(f"   Output: {result.stdout.strip()}")
    else:
        print(f"❌ Parser failed: {result.stderr}")
        return False
    
    # Step 3: Check if output.json was created
    print("\n📄 Step 3: Checking output.json...")
    if os.path.exists('output.json'):
        with open('output.json', 'r') as f:
            output_data = json.load(f)
        
        print("✅ output.json created successfully")
        print(f"   - Parsing success: {output_data.get('parsing_success', False)}")
        print(f"   - AST nodes: {output_data.get('analysis_metadata', {}).get('total_nodes', 0)}")
        print(f"   - Functions: {output_data.get('analysis_metadata', {}).get('function_count', 0)}")
        print(f"   - Classes: {output_data.get('analysis_metadata', {}).get('class_count', 0)}")
        print(f"   - Lines of code: {output_data.get('analysis_metadata', {}).get('lines_of_code', 0)}")
    else:
        print("❌ output.json not found")
        return False
    
    # Step 4: Run code_preprocessor.py pipeline
    print("\n🔄 Step 4: Running code_preprocessor.py pipeline...")
    result = subprocess.run(['python3', '-c', '''
import sys
sys.path.append('.')
from code_preprocessor import CodeBlockPreprocessor

preprocessor = CodeBlockPreprocessor('code_blocks')
success = preprocessor.process_output_json_pipeline('output.json')
sys.exit(0 if success else 1)
'''], capture_output=True, text=True)
    
    if result.returncode == 0:
        print("✅ Block detection completed successfully")
        print(f"   Output: {result.stdout.strip()}")
    else:
        print(f"❌ Block detection failed: {result.stderr}")
        return False
    
    # Step 5: Check generated files
    print("\n📦 Step 5: Checking generated files...")
    analysis_file = 'code_blocks/analysis.json'
    summary_file = 'code_blocks/blocks_summary.json'
    
    if os.path.exists(analysis_file) and os.path.exists(summary_file):
        with open(summary_file, 'r') as f:
            summary_data = json.load(f)
        
        print("✅ Analysis files generated successfully")
        print(f"   - Total blocks: {summary_data.get('total_blocks', 0)}")
        print(f"   - Analysis file: {analysis_file}")
        print(f"   - Summary file: {summary_file}")
        
        # Show block types
        block_types = {}
        for block in summary_data.get('blocks', []):
            block_type = block.get('type', 'unknown')
            block_types[block_type] = block_types.get(block_type, 0) + 1
        
        print("   - Block types:")
        for block_type, count in block_types.items():
            print(f"     * {block_type}: {count}")
        
    else:
        print("❌ Analysis files not found")
        return False
    
    print("\n🎉 Integration test completed successfully!")
    print("   The complete pipeline is working correctly:")
    print("   1. ✅ Code saved to tested_code.txt")
    print("   2. ✅ tester_code.py parsed the code")
    print("   3. ✅ output.json generated with AST data")
    print("   4. ✅ code_preprocessor.py detected blocks using stack")
    print("   5. ✅ analysis.json and blocks_summary.json created")
    
    return True

if __name__ == "__main__":
    success = test_integration()
    sys.exit(0 if success else 1) 