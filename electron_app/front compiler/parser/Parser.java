package parser; // File Parser.java

import java.io.*;
import java.util.*;            // for List, ArrayList
import lexer.*;
import symbols.*;
import inter.*;

public class Parser {
    private Lexer lex;       // lexical analyzer
    private Token look;      // lookahead
    Env top = null;          // current symbol table
    int used = 0;            // storage offset for locals

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

    /**
     * CHANGED: Now handles zero or more top‐level function definitions
     *          followed by an optional anonymous “main” block.
     */
    public void program() throws IOException { // CHANGED
        // 1) Parse zero or more functions
        while (look.tag == Tag.BASIC) {
            parseFunctionDecl(); // NEW
        }
        // 2) Optionally parse a final “main” block if next token is '{'
        if (look.tag == '{') {
            Stmt mainBody = block();
            // Emit a label for “main”:
            System.out.println("func_main:"); // CHANGED
            mainBody.gen(0, 0);
            System.out.println("\treturn"); // CHANGED: default return
            System.out.println("endfunc_main"); // CHANGED
        }
    }

    /**
     * NEW: Parse a function declaration of the form:
     *     type ID '(' params ')' block
     * Emits func_<name>:/endfunc_<name> around its body.
     */
    void parseFunctionDecl() throws IOException { // NEW
        // 1) Parse return type
        Type returnType = type();
        Token nameTok = look;       // function name
        match(Tag.ID);
        Id funcId = new Id((Word)nameTok, returnType, 0);

        // 2) Parse parameter list
        match('(');
        List<Id> params = parseParams(); // NEW
        match(')');

        // 3) Enter new scope for this function
        Env savedEnv = top;
        top = new Env(savedEnv);

        // 4) Install parameters into this function’s Env
        int paramOffset = 0;
        for (Id paramId : params) {
            paramId.offset = paramOffset;
            top.put(paramId.op, paramId);
            paramOffset += paramId.type.width;
        }

        // 5) Emit function prologue
        System.out.println("func_" + funcId.op.lexeme + ":"); // CHANGED

        // 6) Parse the function body (block)
        Stmt body = block();
        body.gen(0, 0);

        // 7) Ensure a return if none
        System.out.println("\treturn");                // CHANGED
        System.out.println("endfunc_" + funcId.op.lexeme); // CHANGED

        // 8) Restore the outer scope
        top = savedEnv;
    }

    /**
     * NEW: Parse parameters → ( type ID ) { ',' type ID }*
     * Returns a List<Id> of parameter names.
     */
    List<Id> parseParams() throws IOException { // NEW
        List<Id> list = new ArrayList<>();
        if (look.tag != ')') {
            // At least one parameter
            Type ptype = type();
            Token pid = look;
            match(Tag.ID);
            list.add(new Id((Word)pid, ptype, 0));

            while (look.tag == ',') {
                match(',');
                ptype = type();
                pid = look;
                match(Tag.ID);
                list.add(new Id((Word)pid, ptype, 0));
            }
        }
        return list;
    }

    /**
     * UNCHANGED: block → '{' decls stmts '}'
     */
    Stmt block() throws IOException {
        match('{');
        Env savedEnv = top;
        top = new Env(top);
        decls();
        Stmt s = stmts();
        match('}');
        top = savedEnv;
        return s;
    }

    /**
     * UNCHANGED: decls → ( type ID ';' )*
     */
    void decls() throws IOException {
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

    /**
     * UNCHANGED: type → BASIC ( '[' NUM ']' )*
     */
    Type type() throws IOException {
        Type p = (Type)look;
        match(Tag.BASIC);
        if (look.tag != '[') return p;
        else return dims(p);
    }

    /**
     * UNCHANGED: dims → '[' NUM ']' { '[' NUM ']' }
     */
    Type dims(Type p) throws IOException {
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

    /**
     * UNCHANGED: stmts → ( stmt )*
     */
    Stmt stmts() throws IOException {
        Stmt s = Stmt.Null;
        while (look.tag != '}') {
            Stmt t = stmt();
            s = new Seq(s, t);
        }
        return s;
    }

    /**
     * UNCHANGED except for new ‘return’ case.
     */
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

            case Tag.RETURN:          // NEW
                move();               // consume ‘return’
                Expr re = bool();
                match(';');
                return new Return(re);

            default:
                return assign();
        }
    }

    /**
     * UNCHANGED: assign → ID [ '(' args ')' | '[' bool ']' ] '=' bool ';'
     */
    Stmt assign() throws IOException {
        Stmt s;
        Token t = look;
        match(Tag.ID);
        Id id = top.get(t);
        if (id == null) error(t.toString() + " undeclared");

        if (look.tag == '(') {
            // This is a call used as a statement (no assignment)
            move(); // consume '('
            List<Expr> args = new ArrayList<>();
            if (look.tag != ')') {
                args.add(bool());
                while (look.tag == ',') {
                    move();
                    args.add(bool());
                }
            }
            match(')');
            match(';');
            Expr callExpr = new Call(id, args, id.type);
            // We generate and ignore its returned Temp
            callExpr.gen(); 
            return Stmt.Null;
        }

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

    /**
     * UNCHANGED: offset → '[' bool ']' { '[' bool ']' }
     */
    Access offset(Id a) throws IOException {
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

    /**
     * UNCHANGED: bool → join { '||' join }
     */
    Expr bool() throws IOException {
        Expr x = join();
        while (look.tag == Tag.OR) {
            Token tok = look;
            move();
            x = new Or(tok, x, join());
        }
        return x;
    }

    /**
     * UNCHANGED: join → equality { '&&' equality }
     */
    Expr join() throws IOException {
        Expr x = equality();
        while (look.tag == Tag.AND) {
            Token tok = look;
            move();
            x = new And(tok, x, equality());
        }
        return x;
    }

    /**
     * UNCHANGED: equality → rel { ('==' | '!=') rel }
     */
    Expr equality() throws IOException {
        Expr x = rel();
        while (look.tag == Tag.EQ || look.tag == Tag.NE) {
            Token tok = look;
            move();
            x = new Rel(tok, x, rel());
        }
        return x;
    }

    /**
     * UNCHANGED: rel → expr { ('<' | '<=' | '>' | '>=') expr }
     */
    Expr rel() throws IOException {
        Expr x = expr();
        while (look.tag == '<' || look.tag == Tag.LE
               || look.tag == '>' || look.tag == Tag.GE) {
            Token tok = look;
            move();
            x = new Rel(tok, x, expr());
        }
        return x;
    }

    /**
     * UNCHANGED: expr → term { ('+' | '-') term }
     */
    Expr expr() throws IOException {
        Expr x = term();
        while (look.tag == '+' || look.tag == '-') {
            Token tok = look;
            move();
            x = new Arith(tok, x, term());
        }
        return x;
    }

    /**
     * UNCHANGED: term → unary { ('*' | '/') unary }
     */
    Expr term() throws IOException {
        Expr x = unary();
        while (look.tag == '*' || look.tag == '/') {
            Token tok = look;
            move();
            x = new Arith(tok, x, unary());
        }
        return x;
    }

    /**
     * UNCHANGED: unary → '!' unary | '-' unary | factor
     */
    Expr unary() throws IOException {
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

    /**
     * CHANGED: factor → '(' bool ')' | NUM | REAL | TRUE | FALSE
     *               | ID [ '(' args ')' ] { '[' bool ']' }
     */
    Expr factor() throws IOException { // CHANGED
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
                // Could be a variable, an array access, or a function call
                String s = look.toString();
                Id id = top.get(look);
                if (id == null) error(look.toString() + " undeclared");
                move();

                if (look.tag == '(') {
                    // Function call
                    move(); // consume '('
                    List<Expr> args = new ArrayList<>();
                    if (look.tag != ')') {
                        args.add(bool());
                        while (look.tag == ',') {
                            move();
                            args.add(bool());
                        }
                    }
                    match(')');
                    return new Call(id, args, id.type); // CHANGED
                }

                // Otherwise, maybe array‐element:
                if (look.tag != '[') {
                    return id;
                } else {
                    return offset(id);
                }

            default:
                error("syntax error");
                return x;
        }
    }
}