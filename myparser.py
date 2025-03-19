import ply.yacc as yacc
from mylexer import tokens
import json
scope_stack = []
declarations_dict = {}  # Stores variables and arrays
functions_dict = {}  # Stores functions
current_scope = scope_stack[-1] if scope_stack else 'global'

def set_scope(scope_name):
    """Helper function to manage scope changes in the scope stack."""
    scope_stack.append(scope_name)

def pop_scope():
    """Helper function to remove the last scope from the stack."""
    scope_stack.pop()

def p_stmt_list(p):
    '''stmt_list : stmt_list stmt
                 | stmt
                 | empty'''
    
    if len(p) == 2:
        p[0] = [p[1]] if p[1] is not None else []

    else:
        p[0] = p[1] + [p[2]]

def p_empty(p):
    '''empty :'''

    p[0] = None

def p_stmt(p):
    '''stmt : TYPE var_list SEMICOLON
            | TYPE IDENTIFIER LPAREN param_list RPAREN LBRACE stmt_list RBRACE
            | TYPE MAIN LPAREN RPAREN LBRACE stmt_list RBRACE
            | IDENTIFIER LPAREN arg_list RPAREN SEMICOLON
            | IDENTIFIER EQUALS value SEMICOLON  
            '''
    if len(p) == 4:
        # Variable declaration
       
        for decl in p[2]:
            decl['data type'] = p[1]  
            decl['scope'] = current_scope
            decl['line'] = p.lineno(1)

            p[0] = {
            'type': 'declaration',            
            'declarations': p[2]
        }

    elif len(p) == 9:
        # Function definition
        func_name = p[2]
        set_scope(f'function:{func_name}')
        for param in p[4]:
            param['scope'] = f'function:{func_name}'

        for stmt in p[7]:
            if stmt:
                if stmt.get('type') == 'declaration':
                    for decl in stmt['declarations']:
                        decl['scope'] = f'function:{func_name}'
                elif stmt.get('type') == 'function_call':
                    stmt['scope'] = f'function:{func_name}'
                elif stmt.get('type') == 'assignment':
                    stmt['scope'] = f'function:{func_name}'
                    
        pop_scope()
        p[0] = {
            'name': func_name,
            'type': 'function declaration',
            'line' : p.lineno(2),
            'return_type': p[1],
            'params': p[4],
            'body': p[7],
        }
        functions_dict[func_name] = p[0]
        
    elif len(p) == 8:
        # Main function
        set_scope('function:main')
        for stmt in p[6]:
            if stmt:
                if stmt.get('type') == 'declaration':
                    for decl in stmt['declarations']:
                        decl['scope'] = 'main'
                elif stmt.get('type') == 'function_call':
                    stmt['scope'] = 'main'
                elif stmt.get('type') == 'assignment':
                    stmt['scope'] = f'main'

        p[0] = {
            'name': 'main',
            'type': 'the standard Main_Function ',
            'line': p.lineno(2),
            'return_type': p[1],
            'body': p[6]
        }
        pop_scope()

    elif len(p) == 6:
        # Function call

        p[0] = { 
            'name': p[1],
            'type': 'function_call',
            'line' : p.lineno(1),
            'args': p[3],
            'scope': current_scope
        }

    elif len(p) == 5:
        # Assignment statement (IDENTIFIER EQUALS value SEMICOLON)
        
        p[0] = {
            'name': p[1],
            'type': 'assignment',
            'line': p.lineno(1),
            'value': p[3],
            'scope': current_scope
        }


def p_var_list(p):
    '''var_list : declarator
                | var_list COMMA declarator'''
    
    if len(p) == 2:
        p[0] = [p[1]]

    else:
        p[0] = p[1] + [p[3]]

def p_declarator(p):
    '''declarator : IDENTIFIER
                  | IDENTIFIER EQUALS value
                  | IDENTIFIER LBRACKET NUMBER RBRACKET
                  | IDENTIFIER LBRACKET NUMBER RBRACKET EQUALS LBRACE array_values RBRACE
                  | IDENTIFIER LBRACKET NUMBER RBRACKET LBRACKET NUMBER RBRACKET
                  | IDENTIFIER LBRACKET NUMBER RBRACKET LBRACKET NUMBER RBRACKET EQUALS LBRACE array_values_2d RBRACE
                  '''
    
    
    decl = {'name': p[1]}

    if len(p) == 5:  # 1d arrays alone
        decl['dimensions'] = [p[3]]

    elif len(p) == 9:  # 1d array with values
        decl['dimensions'] = [p[3]]
        decl['values'] = p[7]

    elif len(p) == 8:  # 2d arrays alone
        decl['dimensions'] = [p[3], p[6]]

    elif len(p) == 12:  # 2d arrays with values
        decl['dimensions'] = [p[3], p[6]]
        decl['values'] = p[10]

    elif len(p) == 4:  # IDENTIFIER EQUALS value
        decl['value'] = p[3]

    # Scope assignment for declaration inside function
    decl['scope'] = current_scope
    key = f"{current_scope}:{decl['name']}"
    declarations_dict[key] = decl
    

    p[0] = decl

def p_array_values(p):
    '''array_values : value
                    | array_values COMMA value'''
    p[0] = [p[1]] if len(p) == 2 else p[1] + [p[3]]

def p_array_values_2d(p):
    '''array_values_2d : LBRACE array_values RBRACE
                       | array_values_2d COMMA LBRACE array_values RBRACE'''
    p[0] = [p[2]] if len(p) == 4 else p[1] + [p[4]]

def p_param_list(p):
    '''param_list : empty
                  | param_list COMMA param
                  | param'''
    if len(p) == 2:
        p[0] = [] if p[1] is None else [p[1]]
    else:
        p[0] = p[1] + [p[3]]

def p_param(p):
    '''param : TYPE IDENTIFIER'''
    p[0] = {
        'type': 'parameter',
        'data_type': p[1],
        'name': p[2]
    }
    
def p_arg_list(p):
    '''arg_list : empty
                | arg_list COMMA value
                | value'''
    
    if len(p) == 2:
        p[0] = [] if p[1] is None else [p[1]]

    else:
        p[0] = p[1] + [p[3]]

def p_value(p):
    '''value : NUMBER
             | STRING_LITERAL
             | CHAR_LITERAL'''
    
    p[0] = p[1]

def p_error(p):
    print(f"Syntax error at line:{p.lineno} before what looks like a '{p.value}'" if p else "Syntax error at EOF")

parser = yacc.yacc()

def generate_json(ast,functions_dict,declarations_dict, filename='output.json'):
    with open(filename, 'w') as f:
        json.dump(ast, f, indent=2)
    with open('functions.json', 'w') as f:
        json.dump(functions_dict, f, indent=2)
    with open('declarations.json','w') as f:
        json.dump(declarations_dict,f,indent=2)
    print(f"If there was no syntax error detected, the correct JSON output is written into {filename}")
    print("Functions saved in 'functions.json'")
    print("declarations_dict saved in 'declarations.json'")
