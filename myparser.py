import ply.yacc as yacc
from mylexer import tokens
import json

scope_stack = []
functions_dict = {}
current_id = 100000

def get_next_id(size=1):
    global current_id
    if size == 1:
        id_value = current_id
        current_id += 1
        return id_value
    else:
        # For arrays, return a range of IDs
        start_id = current_id
        current_id += size
        return list(range(start_id, current_id))

def get_current_scope():
    return scope_stack[-1] if scope_stack else 'global'

def set_scope(scope_name):
    scope_stack.append(scope_name)

def pop_scope():
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
            | CLASS IDENTIFIER LBRACE class_members RBRACE SEMICOLON
            | IDENTIFIER IDENTIFIER SEMICOLON'''
    if len(p) == 7 and p[1] == 'class':  # Class declaration
        class_name = p[2]
        class_scope = f'class:{class_name}'
        set_scope(class_scope)
        for member in p[4]:
            if member.get('type') == 'member_variable':
                member['scope'] = class_scope
                member['id'] = get_next_id()
            elif member.get('type') == 'member_function':
                func_scope = f'function:{class_name}.{member["name"]}'
                set_scope(func_scope)
                for param in member['params']:
                    param['scope'] = func_scope
                    param['id'] = get_next_id()
                for stmt in member['body']:
                    if stmt.get('type') == 'declaration':
                        for decl in stmt['declarations']:
                            if 'dimensions' in decl:
                                size = 1
                                for dim in decl['dimensions']:
                                    size *= int(dim)
                                decl['id'] = get_next_id(size)
                            else:
                                decl['id'] = get_next_id()
                            decl['scope'] = func_scope
                    elif stmt.get('type') == 'function_call':
                        stmt['scope'] = func_scope
                    elif stmt.get('type') == 'assignment':
                        stmt['scope'] = func_scope
                    elif stmt.get('type') == 'object_declaration':  # Added object declaration handling
                        stmt['scope'] = func_scope
                pop_scope()
        p[0] = {
            'type': 'class_declaration',
            'name': class_name,
            'members': p[4],
            'line': p.lineno(2),
            'scope': class_scope
        }
        pop_scope()
    elif len(p) == 4:  # TYPE var_list SEMICOLON or Object declaration
        if p[1] in ['int', 'string', 'char', 'double', 'float']:  # Regular variable declaration
            for decl in p[2]:
                current_scope = get_current_scope()
                decl['scope'] = current_scope
                decl['line'] = p.lineno(1)
                if 'dimensions' in decl:
                    size = 1
                    for dim in decl['dimensions']:
                        size *= int(dim)
                    decl['id'] = get_next_id(size)
                else:
                    decl['id'] = get_next_id()
            p[0] = {'type': 'declaration', 'data_type': p[1], 'declarations': p[2]}
        else:  # Object declaration
            current_scope = get_current_scope()
            p[0] = {
                'type': 'object_declaration',
                'class_type': p[1],
                'name': p[2],
                'line': p.lineno(1),
                'scope': current_scope,
                'id': get_next_id()
            }
    
    elif len(p) == 9:  # function with body
        func_name = p[2]
        The_Function_ID = get_next_id()
        func_scope = f'function:{func_name}'
        set_scope(func_scope)
        for param in p[4]:
            param['scope'] = func_scope
            param['id'] = get_next_id()
        for stmt in p[7]:
            if stmt.get('type') == 'declaration':
                for decl in stmt['declarations']:
                    if 'dimensions' in decl:
                        size = 1
                        for dim in decl['dimensions']:
                            size *= int(dim)
                        decl['id'] = get_next_id(size)
                    else:
                        decl['id'] = get_next_id()
                    decl['scope'] = func_scope
            elif stmt.get('type') == 'function_call':
                stmt['scope'] = func_scope
                if 'arg_param_map' in stmt:
                    for arg_param in stmt['arg_param_map']:
                        if arg_param['arg_value'].get('type') == 'variable':
                            arg_param['arg_value']['scope'] = func_scope
            elif stmt.get('type') == 'assignment':
                stmt['scope'] = func_scope
            elif stmt.get('type') == 'object_declaration':  # Added object declaration handling
                stmt['scope'] = func_scope
        p[0] = {
            'name': func_name,
            'type': 'function declaration',
            'line': p.lineno(2),
            'return_type': p[1],
            'id': The_Function_ID,
            'scope': 'global',
            'params': p[4],
            'body': p[7]
        }
        functions_dict[func_name] = p[0]
        pop_scope()

    elif len(p) == 8:  # main
        set_scope('function:main')
        for stmt in p[6]:
            if stmt.get('type') == 'declaration':
                for decl in stmt['declarations']:
                    if 'dimensions' in decl:
                        size = 1
                        for dim in decl['dimensions']:
                            size *= int(dim)
                        decl['id'] = get_next_id(size)
                    else:
                        decl['id'] = get_next_id()
                    decl['scope'] = 'main'
            elif stmt.get('type') == 'function_call':
                stmt['scope'] = 'function:main'
                if 'arg_param_map' in stmt:
                    for arg_param in stmt['arg_param_map']:
                        if arg_param['arg_value'].get('type') == 'variable':
                            arg_param['arg_value']['scope'] = 'main'
            elif stmt.get('type') == 'assignment':
                stmt['scope'] = 'function:main'
            elif stmt.get('type') == 'object_declaration':  # Added object declaration handling
                stmt['scope'] = 'function:main'
        p[0] = {
            'name': 'main',
            'type': 'the standard Main_Function ',
            'line': p.lineno(2),
            'return_type': p[1],
            'body': p[6],
        }
        pop_scope()

    elif len(p) == 6:  # function call
        func_name = p[1]
        function_data = functions_dict.get(func_name, {})
        function_params = function_data.get('params', [])
        function_id = function_data.get('id', get_next_id())  
        arg_param_map = []
        if len(function_params) == len(p[3]):
            arg_param_map = [{'param_name': function_params[i]['name'], 'arg_value': p[3][i]} for i in range(len(function_params))]
        current_scope = get_current_scope()
        function_body = function_data.get('body', None)
        
        p[0] = {
            'name': func_name,
            'type': 'function_call',
            'line': p.lineno(1),
            'id': function_id,
            'scope': current_scope,
            'arg_param_map': arg_param_map,
            'body': function_body
        }
    elif len(p) == 5:  # assignment
        current_scope = get_current_scope()
        p[0] = {
            'name': p[1],
            'type': 'assignment',
            'line': p.lineno(1),
            'value': p[3],
            'scope': current_scope,
            'id': get_next_id()
        }

def p_var_list(p):
    '''var_list : declarator
                | var_list COMMA declarator'''
    p[0] = [p[1]] if len(p) == 2 else p[1] + [p[3]]

def p_declarator(p):
    '''declarator : IDENTIFIER
                  | POINTER IDENTIFIER
                  | IDENTIFIER EQUALS value
                  | POINTER IDENTIFIER EQUALS address_of_value
                  | POINTER IDENTIFIER EQUALS NEW TYPE
                  | POINTER IDENTIFIER EQUALS NEW TYPE LBRACKET NUMBER RBRACKET
                  | IDENTIFIER LBRACKET NUMBER RBRACKET
                  | IDENTIFIER LBRACKET NUMBER RBRACKET EQUALS LBRACE array_values RBRACE
                  | IDENTIFIER LBRACKET NUMBER RBRACKET LBRACKET NUMBER RBRACKET
                  | IDENTIFIER LBRACKET NUMBER RBRACKET LBRACKET NUMBER RBRACKET EQUALS LBRACE array_values_2d RBRACE'''
    decl = {}
    if len(p) == 2: # int p
        decl['name'] = p[1]
    elif len(p) == 3: # int *p
        decl['name'] = p[2]
        decl['pointer'] = 'pointer declaration'
    elif len(p) == 4:#value assigment 
        decl['name'] = p[1]
        decl['value'] = p[3]
    elif len(p) == 5:# int p = address of value
        decl['name'] = p[2]
        decl['pointer'] = 'pointer declaration'
        decl['points_to'] = {'name': p[4]['name']}
    elif len(p) == 6 and p[4] == 'new': #simple new
        decl['name'] = p[2]
        decl['pointer'] = 'a pointer declaration'
        decl['allocation'] = 'new'
        decl['allocated_type'] = p[5]
    elif len(p) == 7 and p[4] == 'new': #new class object
        decl['name'] = p[2]
        decl['pointer'] = 'class pointer declaration'
        decl['allocation'] = 'new'
        decl['allocated_type'] = p[5]
    elif len(p) == 9 and p[4] == 'new':# array new
        decl['name'] = p[2]
        decl['pointer'] = 'array pointer declaration'
        decl['allocation'] = 'new'
        decl['array_size'] = p[7]
    elif len(p) == 5:# 1 dim array
        decl['name'] = p[1]
        decl['dimensions'] = [p[3]]
    elif len(p) == 9:# declared 1d array with dim and value
        decl['name'] = p[1]
        decl['dimensions'] = [p[3]]
        decl['values'] = p[7]
    elif len(p) == 8:# 2 dim array
        decl['name'] = p[1]
        decl['dimensions'] = [p[3], p[6]]
    elif len(p) == 12:# declared 2d array with dim and value
        decl['name'] = p[1]
        decl['dimensions'] = [p[3], p[6]]
        decl['values'] = p[10]
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
    p[0] = {'type': 'parameter', 'data_type': p[1], 'name': p[2]}

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
             | CHAR_LITERAL
             | IDENTIFIER
             | NULLPTR'''
    if p.slice[1].type == 'IDENTIFIER':
        current_scope = get_current_scope()
        p[0] = {
            'type': 'variable',
            'name': p[1],
            'scope': current_scope
        }
    elif p.slice[1].type == 'NULLPTR':
        p[0] = {
            'type': 'nullptr',
            'value': 'nullptr'
        }
    else:
        p[0] = p[1]

def p_address_of_value(p):
    '''address_of_value : ADDRESS IDENTIFIER'''
    p[0] = {'type': 'address', 'name': p[2]}

def p_class_members(p):
    '''class_members : class_member
                    | class_members class_member
                    | empty'''
    if len(p) == 2:
        p[0] = [p[1]] if p[1] is not None else []
    else:
        p[0] = p[1] + [p[2]]

def p_class_member(p):
    '''class_member : TYPE IDENTIFIER SEMICOLON
                   | TYPE IDENTIFIER EQUALS value SEMICOLON
                   | TYPE POINTER IDENTIFIER SEMICOLON
                   | TYPE POINTER IDENTIFIER EQUALS value SEMICOLON
                   | TYPE POINTER IDENTIFIER EQUALS address_of_value SEMICOLON
                   | IDENTIFIER POINTER IDENTIFIER SEMICOLON
                   | IDENTIFIER POINTER IDENTIFIER EQUALS value SEMICOLON
                   | IDENTIFIER POINTER IDENTIFIER EQUALS address_of_value SEMICOLON
                   | TYPE IDENTIFIER LPAREN param_list RPAREN LBRACE stmt_list RBRACE
                   | default_constructor
                   | parameterized_constructor'''
    if len(p) == 4:  # Member variable without default value
        p[0] = {
            'type': 'member_variable',
            'data_type': p[1],
            'name': p[2]
        }
    elif len(p) == 5:  # Pointer member without default value
        p[0] = {
            'type': 'member_variable',
            'data_type': p[1],
            'name': p[3],
            'pointer': 'pointer declaration'
        }
    elif len(p) == 6:  # Member variable with default value
        p[0] = {
            'type': 'member_variable',
            'data_type': p[1],
            'name': p[2],
            'default_value': p[4]
        }
    elif len(p) == 7:  # Pointer member with default value
        if isinstance(p[5], dict):
            if p[5].get('type') == 'address':  # Address assignment (using &)
                p[0] = {
                    'type': 'member_variable',
                    'data_type': p[1],
                    'name': p[3],
                    'pointer': 'pointer declaration',
                    'points_to': {'name': p[5]['name']}
                }
            elif p[5].get('type') == 'variable' and p[5].get('name') == 'nullptr':  # nullptr assignment
                p[0] = {
                    'type': 'member_variable',
                    'data_type': p[1],
                    'name': p[3],
                    'pointer': 'pointer declaration',
                    'default_value': {
                        'type': 'nullptr',
                        'value': 'nullptr'
                    }
                }
            else:  # Regular value assignment
                p[0] = {
                    'type': 'member_variable',
                    'data_type': p[1],
                    'name': p[3],
                    'pointer': 'pointer declaration',
                    'default_value': p[5]
                }
    elif len(p) == 5 and p[1] != 'TYPE':  # Self-referential pointer without default value
        p[0] = {
            'type': 'member_variable',
            'data_type': p[1],  # This is the class name
            'name': p[3],
            'pointer': 'pointer declaration',
            'self_referential': True
        }
    elif len(p) == 7 and p[1] != 'TYPE':  # Self-referential pointer with default value
        if isinstance(p[5], dict):
            if p[5].get('type') == 'address':  # Address assignment (using &)
                p[0] = {
                    'type': 'member_variable',
                    'data_type': p[1],
                    'name': p[3],
                    'pointer': 'pointer declaration',
                    'self_referential': True,
                    'points_to': {'name': p[5]['name']}
                }
            elif p[5].get('type') == 'variable' and p[5].get('name') == 'nullptr':  # nullptr assignment
                p[0] = {
                    'type': 'member_variable',
                    'data_type': p[1],
                    'name': p[3],
                    'pointer': 'pointer declaration',
                    'self_referential': True,
                    'default_value': {
                        'type': 'nullptr',
                        'value': 'nullptr'
                    }
                }
            else:  # Regular value assignment
                p[0] = {
                    'type': 'member_variable',
                    'data_type': p[1],
                    'name': p[3],
                    'pointer': 'pointer declaration',
                    'self_referential': True,
                    'default_value': p[5]
                }
    elif len(p) == 9:  # Member function
        p[0] = {
            'type': 'member_function',
            'return_type': p[1],
            'name': p[2],
            'params': p[4],
            'body': p[7]
        }
    else:  # Constructor (either default or parameterized)
        p[0] = p[1]

def p_default_constructor(p):
    '''default_constructor : IDENTIFIER LPAREN RPAREN LBRACE stmt_list RBRACE'''
    class_name = p[1]
    constructor_scope = f'constructor:{class_name}'
    set_scope(constructor_scope)
    
    # Set scope for each statement in the body
    for stmt in p[5]:
        if stmt.get('type') == 'declaration':
            for decl in stmt['declarations']:
                decl['scope'] = constructor_scope
        elif stmt.get('type') == 'assignment':
            stmt['scope'] = constructor_scope
        elif stmt.get('type') == 'function_call':
            stmt['scope'] = constructor_scope
    
    p[0] = {
        'type': 'constructor',
        'name': class_name,
        'line': p.lineno(1),
        'params': [],
        'body': p[5]
    }
    pop_scope()

def p_parameterized_constructor(p):
    '''parameterized_constructor : IDENTIFIER LPAREN param_list RPAREN LBRACE stmt_list RBRACE'''
    class_name = p[1]
    constructor_scope = f'parameterized constructor:{class_name}'
    set_scope(constructor_scope)
    
    # Set scope and ID for parameters
    for param in p[3]:
        param['scope'] = constructor_scope
        param['id'] = get_next_id()
    
    # Set scope for each statement in the body
    for stmt in p[6]:
        if stmt.get('type') == 'declaration':
            for decl in stmt['declarations']:
                decl['scope'] = constructor_scope
        elif stmt.get('type') == 'assignment':
            stmt['scope'] = constructor_scope
        elif stmt.get('type') == 'function_call':
            stmt['scope'] = constructor_scope
    
    p[0] = {
        'type': 'parameterized constructor',
        'name': class_name,
        'line': p.lineno(1),
        'params': p[3],
        'body': p[6]
    }
    pop_scope()

def p_error(p):
    print(f"Syntax error at line:{p.lineno} before '{p.value}'" if p else "Syntax error at EOF")

parser = yacc.yacc()

def generate_json(ast, functions_dict, filename='output.json'):
    with open(filename, 'w') as f:
        json.dump(ast, f, indent=2)
    with open('functions.json', 'w') as f:
        json.dump(functions_dict, f, indent=2)
        print(f"JSON output written to functions_dict ")
    print(f"JSON output written to {filename}")

# ON ME for next time  :

# class obj + arrow + dot + for + while
# i want too consider an obj made by constructor