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

int main() {
 Node* head = new Node{1, nullptr};
 head->next = new Node{2, nullptr};
 head->next->next = new Node{3, nullptr};

 printList(head);
 return 0;
}