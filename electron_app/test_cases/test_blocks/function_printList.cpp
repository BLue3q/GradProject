void printList(Node* head) {
 Node* current = head;
 while (current != nullptr) {
     cout << current->data << " -> ";
     current = current->next;
 }
 cout << "NULL" << endl;
}