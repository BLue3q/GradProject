package parser; // File ​Parser.java

import java.io.*;
import lexer.*;
import symbols.*;
import inter.*;

public class Parser {
    private Lexer lex;       // lexical analyzer for this parser
    private Token look;      // lookahead token
    Env top = null;          // current or top symbol table
    int used = 0;            // storage used for declarations

    public Parser(Lexer l) throws IOException {
        lex = l;
        move();
    }

    void move() throws IOException {
        look = lex.scan();
    }

    void error(String s) {
        throw new Error("near line " + lex.line + ": " + s);
    }

    void match(int t) throws IOException {
        if (look.tag == t) move();
        else error("syntax error");
    }

    public void program() throws IOException {
        // program -> block
        Stmt s = block();
        int begin = s.newlabel();
        int after = s.newlabel();
        s.emitlabel(begin);
        s.gen(begin, after);
        s.emitlabel(after);
    }

    Stmt block() throws IOException {
        // block -> { decls stmts }
        match('{');
        Env savedEnv = top;
        top = new Env(top);
        decls();
        Stmt s = stmts();
        match('}');
        top = savedEnv;
        return s;
    }

    void decls() throws IOException {
        // decls -> (type ID ;)*
        while (look.tag == Tag.BASIC) {
            Type p = type();
            Token tok = look;
            match(Tag.ID);
            match(';');
            Id id = new Id((Word)tok, p, used);
            top.put(tok, id);
            used = used + p.width;
        }
    }

    Type type() throws IOException {
        // type -> BASIC (['num'])*
        Type p = (Type)look;
        match(Tag.BASIC);
        if (look.tag != '[') return p;
        else return dims(p);
    }

    Type dims(Type p) throws IOException {
        // p '[' NUM ']' ( '[' NUM ']' )*
        match('[');
        int i = ((Num)look).value;
        match(Tag.NUM);
        match(']');
        if (p instanceof Array) p = ((Array)p).of;
        Type a = new Array(i, p);
        while (look.tag == '[') {
            match('[');
            i = ((Num)look).value;
            match(Tag.NUM);
            match(']');
            if (a instanceof Array) p = ((Array)a).of;
            a = new Array(i, p);
        }
        return a;
    }

    Stmt stmts() throws IOException {
        // stmts -> ( stmt )*
        Stmt s = Stmt.Null;
        while (look.tag != '}') {
            Stmt t = stmt();
            s = new Seq(s, t);
        }
        return s;
    }

    Stmt stmt() throws IOException {
        Expr x;
        Stmt s, s1, s2;
        Stmt savedStmt;

        switch (look.tag) {
            case ';':
                move();
                return Stmt.Null;

            case Tag.BREAK:
                move();
                match(';');
                return new Break();

            case Tag.WHILE:
                While w = new While();
                savedStmt = Stmt.Enclosing;
                Stmt.Enclosing = w;
                move();
                match('(');
                x = bool();
                match(')');
                s1 = stmt();
                w.init(x, s1);
                Stmt.Enclosing = savedStmt;
                return w;

            case Tag.DO:
                Do d = new Do();
                savedStmt = Stmt.Enclosing;
                Stmt.Enclosing = d;
                move();
                s1 = stmt();
                match(Tag.WHILE);
                match('(');
                x = bool();
                match(')');
                match(';');
                d.init(s1, x);
                Stmt.Enclosing = savedStmt;
                return d;

            case Tag.IF:
                match(Tag.IF);
                match('(');
                x = bool();
                match(')');
                s1 = stmt();
                if (look.tag != Tag.ELSE)
                    return new If(x, s1);
                match(Tag.ELSE);
                s2 = stmt();
                return new Else(x, s1, s2);

            case '{':
                return block();

            default:
                return assign();
        }
    }

    Stmt assign() throws IOException {
        // assign -> ID ( '[' bool ']' )* '=' bool ';'
        Stmt s;
        Token t = look;
        match(Tag.ID);
        Id id = top.get(t);
        if (id == null) error(t.toString() + " undeclared");
        if (look.tag == '=') {
            move();
            Expr e = bool();
            match(';');
            s = new Set(id, e);
        } else {
            Access x = offset(id);
            match('=');
            Expr e = bool();
            match(';');
            s = new SetElem(x, e);
        }
        return s;
    }

    Access offset(Id a) throws IOException {
        // I -> '[' bool ']' ( '[' bool ']' )*
        Expr i, w, t1, t2, loc;
        Type type = a.type;
        match('[');
        i = bool();
        match(']');
        type = ((Array)type).of;
        w = new Constant(type.width);
        t1 = new Arith(new Token('*'), i, w);
        loc = t1;

        while (look.tag == '[') {
            match('[');
            i = bool();
            match(']');
            type = ((Array)type).of;
            w = new Constant(type.width);
            t1 = new Arith(new Token('*'), i, w);
            t2 = new Arith(new Token('+'), loc, t1);
            loc = t2;
        }
        return new Access(a, loc, type);
    }

    Expr bool() throws IOException {
        // bool -> join ( '||' join )*
        Expr x = join();
        while (look.tag == Tag.OR) {
            Token tok = look;
            move();
            x = new Or(tok, x, join());
        }
        return x;
    }

    Expr join() throws IOException {
        // join -> equality ( '&&' equality )*
        Expr x = equality();
        while (look.tag == Tag.AND) {
            Token tok = look;
            move();
            x = new And(tok, x, equality());
        }
        return x;
    }

    Expr equality() throws IOException {
        // equality -> rel ( ('==' | '!=') rel )*
        Expr x = rel();
        while (look.tag == Tag.EQ || look.tag == Tag.NE) {
            Token tok = look;
            move();
            x = new Rel(tok, x, rel());
        }
        return x;
    }

    Expr rel() throws IOException {
        // rel -> expr ( ('<' | '<=' | '>' | '>=') expr )*
        Expr x = expr();
        while (look.tag == '<' || look.tag == Tag.LE ||
               look.tag == '>' || look.tag == Tag.GE) {
            Token tok = look;
            move();
            x = new Rel(tok, x, expr());
        }
        return x;
    }

    Expr expr() throws IOException {
        // expr -> term ( ('+' | '-') term )*
        Expr x = term();
        while (look.tag == '+' || look.tag == '-') {
            Token tok = look;
            move();
            x = new Arith(tok, x, term());
        }
        return x;
    }

    Expr term() throws IOException {
        // term -> unary ( ('*' | '/') unary )*
        Expr x = unary();
        while (look.tag == '*' || look.tag == '/') {
            Token tok = look;
            move();
            x = new Arith(tok, x, unary());
        }
        return x;
    }

    Expr unary() throws IOException {
        // unary -> '!' unary | '-' unary | factor
        if (look.tag == '-') {
            move();
            return new Unary(Word.minus, unary());
        } else if (look.tag == '!') {
            Token tok = look;
            move();
            return new Not(tok, unary());
        } else {
            return factor();
        }
    }

    Expr factor() throws IOException {
        // factor -> '(' bool ')' | NUM | REAL | TRUE | FALSE | ID ( '[' bool ']' )*
        Expr x = null;
        switch (look.tag) {
            case '(':
                move();
                x = bool();
                match(')');
                return x;
            case Tag.NUM:
                x = new Constant(look, Type.Int);
                move();
                return x;
            case Tag.REAL:
                x = new Constant(look, Type.Float);
                move();
                return x;
            case Tag.TRUE:
                x = Constant.True;
                move();
                return x;
            case Tag.FALSE:
                x = Constant.False;
                move();
                return x;
            case Tag.ID:
                String s = look.toString();
                Id id = top.get(look);
                if (id == null) error(look.toString() + " undeclared");
                move();
                if (look.tag != '[') return id;
                else return offset(id);
            default:
                error("syntax error");
                return x;
        }
    }
}