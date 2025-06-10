#include <iostream>
using namespace std;

struct Node {
    int data;
    Node* next;
};

void printList(Node* head) {
    Node* current = head;
    while (current != nullptr) {
        // cout << current->data << " -> ";  // Commented for parser
        current = current->next;
    }
    // cout << "NULL" << endl;  // Commented for parser  
}

int main() {
    Node* head = new Node;
    head->data = 1;
    head->next = nullptr;
    
    Node* second = new Node;
    second->data = 2;
    second->next = nullptr;
    head->next = second;
    
    Node* third = new Node;
    third->data = 3;
    third->next = nullptr;
    second->next = third;

    printList(head);
    return 0;
}