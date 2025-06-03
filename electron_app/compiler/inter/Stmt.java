package inter; // File Stmt.java

/**
 * Base class for all statements. Contains:
 *   - static “Null” node (empty sequence)
 *   - static “Enclosing” pointer (for break)
 *   - an “after” label field (for break/while/do)
 *   - abstract gen(int b, int a) method
 */
public abstract class Stmt extends Node {
    public static Stmt Null = new Stmt() {
        public void gen(int b, int a) { }
    };

    public static Stmt Enclosing = Null;

    public int after = 0; // label to jump to on “break”

    public abstract void gen(int b, int a);
}