package inter; // File Call.java

import java.util.List;
import java.util.ArrayList;
import lexer.*;
import symbols.*;
/**
 * Represents a function‐call expression:
 *   t = call funcName(arg1, arg2, …)
 */
public class Call extends Expr {
    public Id function;             // the function’s name as an Id
    public List<Expr> arguments;    // argument expressions

    public Call(Id funcId, List<Expr> args, Type returnType) {
        super(funcId.op, returnType);
        function = funcId;
        arguments = args;
    }

    public Expr gen() {
        // 1) Evaluate each argument into a temp
        List<String> argTemps = new ArrayList<>();
        for (Expr e : arguments) {
            Expr r = e.reduce();
            argTemps.add(r.toString());
        }
        // 2) Create a new temp for the return value
        Temp retTemp = new Temp(type);

        // 3) Emit “param …” for each argument
        for (String at : argTemps) {
            emit("param " + at);
        }
        // 4) Emit the actual call
        emit(retTemp.toString() + " = call " + function.toString() + ", " + argTemps.size());
        return retTemp;
    }

    public String toString() {
        return "call_" + function.toString();
    }
}