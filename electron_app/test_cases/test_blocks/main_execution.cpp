int main() {
 Node* head = new Node{1, nullptr};
 head->next = new Node{2, nullptr};
 head->next->next = new Node{3, nullptr};

 printList(head);
 return 0;
}