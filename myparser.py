import ply.yacc as yacc
from mylexer import tokens
import json
scope_stack = []
declarations_dict = {}
functions_dict = {}
next_id = 1000000

def get_type_size(type_name):
    type_sizes = {
        'int': 4,
        'float': 4,
        'double': 8,
        'char': 1,
        'string': 8,  # treating string as pointer
        'void': 0
    }
    return type_sizes.get(type_name, 4)  # default to 4 if type not found

def get_next_id(type_name=None, array_size=None):
    global next_id
    start_id = next_id
    
    if type_name:
        type_size = get_type_size(type_name)
        if array_size:
            # For arrays, increment by (size * type_size)
            next_id += (array_size * type_size)
        else:
            # For regular variables, increment by type_size
            next_id += type_size
    else:
        # For non-type entities (like class declarations), increment by 1
        next_id += 1
    
    end_id = next_id - 1
    return {
        'id': str(start_id),
        'range': f"{start_id}-{end_id}"
    }

def get_current_scope():
    return scope_stack[-1] if scope_stack else 'global'

def set_scope(scope_name):
    scope_stack.append(scope_name)

def pop_scope():
    scope_stack.pop()

def get_variable_scope(var_name):
    current_scope = get_current_scope()
    if f"{current_scope}:{var_name}" in declarations_dict:
        return current_scope
    if f"global:{var_name}" in declarations_dict:
        return "global"
    return None

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
            | CLASS IDENTIFIER LBRACE class_member_list RBRACE SEMICOLON'''
    if len(p) == 4:
        for decl in p[2]:
            decl['type'] = p[1]
            current_scope = get_current_scope()
            decl['scope'] = current_scope
            decl['line'] = p.lineno(1)
            id_info = get_next_id(p[1], decl.get('array_size'))
            decl['id'] = id_info['id']
            decl['range'] = id_info['range']
            key = f"{current_scope}:{decl['name']}"
            declarations_dict[key] = decl
        p[0] = {'type': 'declaration', 'data_type': p[1], 'declarations': p[2]}
    
    elif len(p) == 7 and p[1] == 'class':
        class_name = p[2]
        class_scope = f'class:{class_name}'
        set_scope(class_scope)
        
        members = []
        for member_list in p[4]:
            if isinstance(member_list, list):
                for member in member_list:
                    member['scope'] = class_scope
                    id_info = get_next_id(member['type'], member.get('array_size'))
                    member['id'] = id_info['id']
                    member['range'] = id_info['range']
                    key = f"{class_scope}:{member['name']}"
                    declarations_dict[key] = member
                    members.extend(member_list)
        
        id_info = get_next_id()
        p[0] = {
            'name': class_name,
            'type': 'class declaration',
            'line': p.lineno(2),
            'members': members,
            'id': id_info['id'],
            'range': id_info['range']
        }
        pop_scope()
    
    elif len(p) == 9:
        func_name = p[2]
        func_scope = f'function:{func_name}'
        set_scope(func_scope)
        for param in p[4]:
            param['scope'] = func_scope
            param['id'] = get_next_id(param['type'], param.get('array_size'))
        for stmt in p[7]:
            if stmt:
                if stmt.get('type') == 'declaration':
                    for decl in stmt['declarations']:
                        decl['id'] = get_next_id(decl['type'], decl.get('array_size'))
                        old_scope = decl.get('scope', 'global')
                        old_key = f"{old_scope}:{decl['name']}"
                        new_key = f"{func_name}:{decl['name']}"
                        decl['scope'] = func_name
                        if old_key in declarations_dict:
                            declarations_dict[new_key] = declarations_dict.pop(old_key)
                            declarations_dict[new_key]['scope'] = func_name
                else:
                    stmt['scope'] = func_scope
                    stmt['id'] = get_next_id(stmt['type'], stmt.get('array_size'))
        p[0] = {
            'name': func_name,
            'type': 'function declaration',
            'line': p.lineno(2),
            'return_type': p[1],
            'params': p[4],
            'body': p[7],
            'id': get_next_id()
        }
        functions_dict[func_name] = p[0]
        pop_scope()

    elif len(p) == 8:
        set_scope('function:main')
        for stmt in p[6]:
            if stmt:
                if stmt.get('type') == 'declaration':
                    for decl in stmt['declarations']:
                        decl['id'] = get_next_id(decl['type'], decl.get('array_size'))
                        old_scope = decl.get('scope', 'global')
                        old_key = f"{old_scope}:{decl['name']}"
                        new_key = f"main:{decl['name']}"
                        decl['scope'] = 'main'
                        if old_key in declarations_dict:
                            declarations_dict[new_key] = declarations_dict.pop(old_key)
                            declarations_dict[new_key]['scope'] = 'main'
                else:
                    stmt['scope'] = 'main'
                    stmt['id'] = get_next_id(stmt['type'], stmt.get('array_size'))
        p[0] = {
            'name': 'main',
            'type': 'the standard Main_Function ',
            'line': p.lineno(2),
            'return_type': p[1],
            'body': p[6],
            'id': get_next_id()
        }
        pop_scope()

    elif len(p) == 6:
        func_name = p[1]
        function_data = functions_dict.get(func_name, {})
        function_body = function_data.get('body', None)
        function_params = function_data.get('params', [])
        arg_param_map = []
        if len(function_params) == len(p[3]):
            arg_param_map = [{'param_name': function_params[i]['name'], 'arg_value': p[3][i]} for i in range(len(function_params))]
        current_scope = get_current_scope()
        p[0] = {
            'name': func_name,
            'type': 'function_call',
            'line': p.lineno(1),
            'scope': current_scope,
            'body': function_body,
            'arg_param_map': arg_param_map,
            'id': get_next_id()
        }

    elif len(p) == 5:
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
    if len(p) == 2:
        decl['name'] = p[1]
    elif len(p) == 3:
        decl['name'] = p[2]
        decl['pointer'] = True
    elif len(p) == 4:
        decl['name'] = p[1]
        decl['value'] = p[3]
    elif len(p) == 5:
        if p[1] == '*':  # Pointer with address
            decl['name'] = p[2]
            decl['pointer'] = True
            decl['points_to'] = {'name': p[4]['name']}
        else:  # Array declaration
            decl['name'] = p[1]
            decl['dimensions'] = [p[3]]
            decl['array_size'] = p[3]
    elif len(p) == 6 and p[4] == 'new':
        decl['name'] = p[2]
        decl['pointer'] = True
        decl['allocation'] = 'new'
    elif len(p) == 9 and p[4] == 'new':
        decl['name'] = p[2]
        decl['pointer'] = True
        decl['allocation'] = 'new'
        decl['array_size'] = p[7]
    elif len(p) == 9:  # Array with values
        decl['name'] = p[1]
        decl['dimensions'] = [p[3]]
        decl['array_size'] = p[3]
        decl['values'] = p[7]
    elif len(p) == 8:  # 2D array declaration
        decl['name'] = p[1]
        decl['dimensions'] = [p[3], p[6]]
        decl['array_size'] = p[3] * p[6]
    elif len(p) == 12:  # 2D array with values
        decl['name'] = p[1]
        decl['dimensions'] = [p[3], p[6]]
        decl['array_size'] = p[3] * p[6]
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
             | IDENTIFIER'''
    p[0] = p[1]

def p_address_of_value(p):
    '''address_of_value : ADDRESS IDENTIFIER'''
    p[0] = {'type': 'address', 'name': p[2]}

def p_class_member_list(p):
    '''class_member_list : class_member_list class_member
                        | class_member
                        | empty'''
    if len(p) == 2:
        p[0] = [p[1]] if p[1] is not None else []
    else:
        p[0] = p[1] + [p[2]]

def p_class_member(p):
    '''class_member : TYPE var_list SEMICOLON'''
    members = []
    for decl in p[2]:
        decl['type'] = p[1]
        decl['line'] = p.lineno(1)
        members.append(decl)
    p[0] = members

def p_error(p):
    print(f"Syntax error at line:{p.lineno} before '{p.value}'" if p else "Syntax error at EOF")

parser = yacc.yacc()

def generate_json(ast, functions_dict, declarations_dict, filename='output.json'):
    # Resolve pointers using scope-aware lookup
    for key, value in declarations_dict.items():
        if 'points_to' in value:
            target_name = value['points_to'].get('name')
            if target_name:
                target_scope = get_variable_scope(target_name)
                if target_scope:
                    target_key = f"{target_scope}:{target_name}"
                    target_decl = declarations_dict.get(target_key)
                    if target_decl:
                        value['points_to']['id'] = target_decl['id']

    # Update lines and write to file
    for key, value in declarations_dict.items():
        if value.get('scope') == 'global':
            value['line'] = 'globaly declared'

    for key, value in functions_dict.items():
        value['line'] = 'globaly declared'

    with open(filename, 'w') as f:
        json.dump(ast, f, indent=2)
    with open('functions.json', 'w') as f:
        json.dump(functions_dict, f, indent=2)
    with open('declarations.json','w') as f:
        json.dump(declarations_dict, f, indent=2)
    print(f"JSON output written to {filename}")
