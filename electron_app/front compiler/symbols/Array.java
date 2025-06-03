package symbols; // File ​Array.java

import lexer.*;

public class Array extends Type {
    public int size; // number of elements
    public Type of;  // element type

    public Array(int sz, Type p) {
        super("[]", Tag.INDEX, sz * p.width);
        size = sz;
        of = p;
    }

    public String toString() {
        return "[" + size + "] " + of.toString();
    }
}