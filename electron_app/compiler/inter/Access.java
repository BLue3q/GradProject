package inter; // File ​Access.java

import lexer.*;
import symbols.*;

public class Access extends Op {
    public Id array;      // array reference
    public Expr index;    // index expression
    public Expr width;    // size of each element
    public Type type;     // element type

    public Access(Id a, Expr i, Type t) {
        super(new Token(Tag.INDEX), t);
        array = a;
        index = i;
        type = t;
    }

    public Expr reduce() {
        Expr i = index.reduce();
        Expr w = new Constant(type.width);
        Expr t1 = new Arith(new Token('*'), i, w);
        Expr t2 = new Arith(new Token('+'), array, t1);
        return t2;
    }

    public String toString() {
        return array.toString() + " [ " + index.toString() + " ]";
    }
}