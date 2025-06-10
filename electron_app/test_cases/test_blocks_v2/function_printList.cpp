#include <iostream>
using namespace std;

struct Node {
 int data;
 Node* next;
};

void printList(Node* head) {
 Node* current = head;
 while (current != nullptr) {
     cout << current->data << " -> ";
     current = current->next;
 }
 cout << "NULL" << endl;
}