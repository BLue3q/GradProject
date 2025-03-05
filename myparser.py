import ply.yacc as yacc
from mylexer import tokens
import json

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
            | TYPE MAIN LPAREN RPAREN LBRACE stmt_list RBRACE'''
    if len(p) == 4:
        # Global declaration: Add 'global' scope
        for var in p[2]:
            var['scope'] = 'global'
        p[0] = {
            'type': 'declaration',
            'data_type': p[1],
            'declarations': p[2]
        }
    elif len(p) == 9:
        # Function: Annotate params and body with function scope
        func_name = p[2]
        for param in p[4]:
            param['scope'] = f'function:{func_name}'
        for stmt in p[7]:
            if stmt and stmt.get('type') == 'declaration':
                for decl in stmt['declarations']:
                    decl['scope'] = f'function:{func_name}'
        p[0] = {
            'type': 'function',
            'return_type': p[1],
            'name': func_name,
            'params': p[4],
            'body': p[7]
        }
    elif len(p) == 8:
        # Main function: Annotate body with 'main' scope
        for stmt in p[6]:
            if stmt and stmt.get('type') == 'declaration':
                for decl in stmt['declarations']:
                    decl['scope'] = 'function:main'
        p[0] = {
            'type': 'main function',
            'name': 'main',
            'return_type': p[1],
            'body': p[6]
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
                  | IDENTIFIER LBRACKET NUMBER RBRACKET LBRACKET NUMBER RBRACKET EQUALS LBRACE array_values_2d RBRACE'''
    decl = {'name': p[1]}
    if len(p) == 5:
        decl['dimensions'] = [p[3]]
    elif len(p) == 9:
        decl['dimensions'] = [p[3]]
        decl['values'] = p[7]
    elif len(p) == 8:
        decl['dimensions'] = [p[3], p[6]]
    elif len(p) == 12:
        decl['dimensions'] = [p[3], p[6]]
        decl['values'] = p[10]
    elif len(p) == 4:
        decl['value'] = p[3]
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

def p_value(p):
    '''value : NUMBER
             | STRING_LITERAL
             | CHAR_LITERAL'''
    p[0] = p[1]

def p_error(p):
    print(f"Syntax error at line:{p.lineno} before what look like a '{p.value}'" if p else "Syntax error at EOF")

parser = yacc.yacc()

def generate_json(ast, filename='output.json'):
    with open(filename, 'w') as f:
        json.dump(ast, f, indent=2)
    print(f"If there was no any syntax error detected ! The correct JSON output is written into {filename}")