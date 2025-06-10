import ply.yacc as yacc
from mylexer import tokens
import json

# Define operator precedence and associativity
precedence = (
    ('left', 'COMMA'),
    ('right', 'EQUALS'),
    ('left', 'EQ', 'NE'),
    ('left', 'LT', 'LE', 'GT', 'GE'),
    ('left', 'DOT', 'ARROW'),
    ('right', 'NEW', 'DELETE'),
    ('left', 'LPAREN', 'RPAREN'),
    ('left', 'LBRACKET', 'RBRACKET'),
    ('nonassoc', 'REDUCE_EMPTY'),  # Special precedence for empty reductions
)

scope_stack = []
functions_dict = {}
classes_dict = {}  # Store class information including constructors
current_id = 100000
parse_errors = []  # Track parsing errors

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
    if scope_stack:
        scope_stack.pop()

def set_scope_for_value(value, scope):
    """Recursively set scope for variables in value expressions"""
    if isinstance(value, dict):
        if value.get('type') == 'variable':
            value['scope'] = scope
        elif value.get('type') == 'member_access':
            # Set scope for the object part if it's a variable
            if isinstance(value.get('object'), dict) and value['object'].get('type') == 'variable':
                value['object']['scope'] = scope
        elif value.get('type') == 'comparison':
            # Set scope for both sides of the comparison
            set_scope_for_value(value.get('left'), scope)
            set_scope_for_value(value.get('right'), scope)
        elif value.get('type') == 'method_call':
            # Set scope for the object and arguments in method calls
            if isinstance(value.get('object'), dict):
                set_scope_for_value(value['object'], scope)
            if value.get('args'):
                for arg in value['args']:
                    if isinstance(arg, dict):
                        set_scope_for_value(arg, scope)
        elif value.get('type') == 'function_call':
            # Set scope for arguments in function calls
            if value.get('arg_param_map'):
                for arg_param in value['arg_param_map']:
                    if isinstance(arg_param.get('arg_value'), dict):
                        set_scope_for_value(arg_param['arg_value'], scope)
        elif value.get('type') == 'array_access':
            # Set scope for array variable and index
            if isinstance(value.get('array'), dict):
                set_scope_for_value(value['array'], scope)
            if isinstance(value.get('index'), dict):
                set_scope_for_value(value['index'], scope)

    elif isinstance(value, list):
        # Handle lists of values (like argument lists)
        for item in value:
            if isinstance(item, dict):
                set_scope_for_value(item, scope)

def p_stmt_list(p):
    '''stmt_list : stmt_list stmt 
                 | stmt'''
    if len(p) == 2:
        p[0] = [p[1]]
    else:
        p[0] = p[1] + [p[2]]

def p_stmt_list_empty(p):
    '''stmt_list : %prec REDUCE_EMPTY'''
    p[0] = []

# Removed empty rule - using specific empty rules instead

def p_stmt(p):
    '''stmt : declaration_stmt
            | function_def_stmt
            | main_function_stmt
            | class_declaration_stmt
            | assignment_stmt
            | compound_assignment_stmt
            | member_assignment_stmt
            | method_call_stmt
            | function_call_stmt
            | object_declaration_stmt
            | pointer_declaration_stmt
            | new_object_stmt
            | delete_stmt
            | if_stmt
            | while_stmt
            | return_stmt'''
    p[0] = p[1]

def p_declaration_stmt(p):
    '''declaration_stmt : TYPE var_list SEMICOLON'''
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
        # Set scope for the declaration's value (e.g., new_array)
        if decl.get('value'):
            set_scope_for_value(decl['value'], current_scope)
    p[0] = {'type': 'declaration', 'data_type': p[1], 'declarations': p[2]}

def p_function_def_stmt(p):
    '''function_def_stmt : TYPE IDENTIFIER LPAREN param_list RPAREN LBRACE stmt_list RBRACE'''
    func_name = p[2]
    The_Function_ID = get_next_id()
    func_scope = f'function:{func_name}'
    set_scope(func_scope)
    for param in p[4]:
        param['scope'] = func_scope
        param['id'] = get_next_id()
    process_statement_scope(p[7], func_scope)
    p[0] = {
        'type': 'function declaration',
        'line': p.lineno(2),
        'scope': 'global',
        'id': The_Function_ID,
        'name': func_name,
        'return_type': p[1],
        'params': p[4],
        'body': p[7]
    }
    functions_dict[func_name] = p[0]
    pop_scope()

def p_main_function_stmt(p):
    '''main_function_stmt : TYPE MAIN LPAREN RPAREN LBRACE stmt_list RBRACE'''
    set_scope('function:main')
    process_statement_scope(p[6], 'function:main')
    p[0] = {
        'type': 'the standard Main_Function ',
        'line': p.lineno(2),
        'scope': 'global',
        'name': 'main',
        'return_type': p[1],
        'body': p[6]
    }
    pop_scope()

def p_class_declaration_stmt(p):
    '''class_declaration_stmt : CLASS IDENTIFIER LBRACE class_members RBRACE SEMICOLON
                             | STRUCT IDENTIFIER LBRACE class_members RBRACE SEMICOLON'''
    class_name = p[2]
    class_scope = f'class:{class_name}'
    set_scope(class_scope)
    for member in p[4]:
        if member.get('type') == 'member_variable':
            member['scope'] = class_scope
            member['id'] = get_next_id()
            data_type = member.get('data_type', '')
            if data_type not in ['int', 'string', 'char', 'double', 'float', 'void']:
                member['data_type'] = f'class:{data_type}'
        elif member.get('type') == 'member_function':
            member['belongs_to_class'] = class_name
            func_scope = f'function:{class_name}.{member["name"]}'
            set_scope(func_scope)
            for param in member['params']:
                param['scope'] = func_scope
                param['id'] = get_next_id()
            process_statement_scope(member['body'], func_scope)
            pop_scope()
    p[0] = {
        'type': 'class_declaration',
        'line': p.lineno(2),
        'scope': 'global',
        'name': class_name,
        'members': p[4]
    }
    
    # Store class information in classes_dict
    constructors = []
    destructors = []
    for member in p[4]:
        if member.get('type') in ['constructor', 'parameterized constructor']:
            constructors.append(member)
        elif member.get('type') == 'destructor':
            destructors.append(member)
    
    classes_dict[class_name] = {
        'name': class_name,
        'members': p[4],
        'constructors': constructors,
        'destructors': destructors,
        'line': p.lineno(2)
    }
    
    pop_scope()

def p_assignment_stmt(p):
    '''assignment_stmt : IDENTIFIER EQUALS value SEMICOLON'''
    current_scope = get_current_scope()
    p[0] = {
        'type': 'assignment',
        'line': p.lineno(1),
        'scope': current_scope,
        'name': p[1],
        'value': p[3]
    }
    # Set scope for the assignment's value (e.g., new_array)
    if isinstance(p[3], dict):
        set_scope_for_value(p[3], current_scope)

def p_compound_assignment_stmt(p):
    '''compound_assignment_stmt : IDENTIFIER INCREMENT SEMICOLON
                                | IDENTIFIER DECREMENT SEMICOLON
                                | IDENTIFIER PLUS_EQUALS value SEMICOLON
                                | IDENTIFIER MINUS_EQUALS value SEMICOLON
                                | IDENTIFIER TIMES_EQUALS value SEMICOLON
                                | IDENTIFIER DIVIDE_EQUALS value SEMICOLON'''
    current_scope = get_current_scope()
    if len(p) == 4:  # ++ or --
        operator = '++' if 'INCREMENT' in str(p[2]) else '--'
        value = None
    else:  # +=, -=, *=, /=
        operator = str(p[2]).replace('_EQUALS', '=')
        value = p[3]
        set_scope_for_value(value, current_scope)
    
    p[0] = {
        'type': 'compound_assignment',
        'line': p.lineno(1),
        'scope': current_scope,
        'name': p[1],
        'operator': operator,
        'value': value
    }

def p_member_assignment_stmt(p):
    '''member_assignment_stmt : value DOT IDENTIFIER EQUALS value SEMICOLON
                             | value ARROW IDENTIFIER EQUALS value SEMICOLON'''
    current_scope = get_current_scope()
    # Extract object name from the variable structure
    object_name = p[1]['name'] if isinstance(p[1], dict) and 'name' in p[1] else p[1]
    
    if p[2] == '.':  # Dot operator
        p[0] = {
            'type': 'member_assignment',
            'line': p.lineno(2),
            'scope': current_scope,
            'object': object_name,
            'member': p[3],
            'operator': 'dot',
            'value': p[5]
        }
    elif p[2] == '->':  # Arrow operator
        p[0] = {
            'type': 'member_assignment',
            'line': p.lineno(2),
            'scope': current_scope,
            'object': object_name,
            'member': p[3],
            'operator': 'arrow',
            'pointer_access': True,
            'value': p[5]
        }

def p_method_call_stmt(p):
    '''method_call_stmt : value DOT IDENTIFIER LPAREN RPAREN SEMICOLON
                       | value ARROW IDENTIFIER LPAREN RPAREN SEMICOLON
                       | value DOT IDENTIFIER LPAREN arg_list RPAREN SEMICOLON
                       | value ARROW IDENTIFIER LPAREN arg_list RPAREN SEMICOLON'''
    current_scope = get_current_scope()
    
    # Set scope for the object if it's a variable
    if isinstance(p[1], dict):
        set_scope_for_value(p[1], current_scope)
    
    # Determine if this is a no-arg or with-args method call
    if len(p) == 7:  # No arguments
        args = []
    else:  # With arguments
        args = p[5] if p[5] else []
        # Set scope for arguments
        if args:
            for arg in args:
                if isinstance(arg, dict):
                    set_scope_for_value(arg, current_scope)
    
    # Create arg_param_map for method calls
    method_name = p[3]
    arg_param_map = create_method_arg_param_map(method_name, args)
    
    if p[2] == '.':  # Dot operator
        p[0] = {
            'type': 'method_call',
            'line': p.lineno(2),
            'scope': current_scope,
            'object': p[1],
            'method': method_name,
            'operator': 'dot',
            'args': args,
            'arg_param_map': arg_param_map
        }
    elif p[2] == '->':  # Arrow operator
        p[0] = {
            'type': 'method_call',
            'line': p.lineno(2),
            'scope': current_scope,
            'object': p[1],
            'method': method_name,
            'operator': 'arrow',
            'pointer_access': True,
            'args': args,
            'arg_param_map': arg_param_map
        }

def p_function_call_stmt(p):
    '''function_call_stmt : IDENTIFIER LPAREN arg_list RPAREN SEMICOLON'''
    func_name = p[1]
    function_data = functions_dict.get(func_name, {})
    function_params = function_data.get('params', [])
    arg_param_map = []
    if len(function_params) == len(p[3]):
        arg_param_map = [{'param_name': function_params[i]['name'], 'arg_value': p[3][i]} for i in range(len(function_params))]
    current_scope = get_current_scope()
    function_body = function_data.get('body', None)
    
    p[0] = {
        'type': 'function_call',
        'line': p.lineno(1),
        'scope': current_scope,
        'name': func_name,
        'arg_param_map': arg_param_map,
        'body': function_body
    }

def p_object_declaration_stmt(p):
    '''object_declaration_stmt : IDENTIFIER IDENTIFIER SEMICOLON
                              | IDENTIFIER IDENTIFIER LPAREN arg_list RPAREN SEMICOLON'''
    current_scope = get_current_scope()
    class_name = p[1]
    object_name = p[2]
    
    if len(p) == 4:  # Default constructor
        p[0] = {
            'type': 'object_declaration',
            'line': p.lineno(1),
            'scope': current_scope,
            'id': get_next_id(),
            'constructor_type': 'default_constructor_call',
            'class_type': class_name,
            'name': object_name
        }
    else:  # Parameterized constructor
        # Find the parameterized constructor for this class
        constructor_params = []
        arg_param_map = []
        
        if class_name in classes_dict:
            class_info = classes_dict[class_name]
            for constructor in class_info['constructors']:
                if constructor.get('type') == 'parameterized constructor':
                    constructor_params = constructor.get('params', [])
                    break
        
        # Create arg_param_map if we have matching constructor
        if len(constructor_params) == len(p[4]):
            arg_param_map = [{'param_name': constructor_params[i]['name'], 'arg_value': p[4][i]} for i in range(len(constructor_params))]
        
        p[0] = {
            'type': 'object_declaration',
            'line': p.lineno(1),
            'scope': current_scope,
            'id': get_next_id(),
            'constructor_type': 'parameterized_constructor_call',
            'class_type': class_name,
            'object_name': object_name,
            'arg_param_map': arg_param_map
        }

def p_pointer_declaration_stmt(p):
    '''pointer_declaration_stmt : IDENTIFIER POINTER IDENTIFIER SEMICOLON'''
    current_scope = get_current_scope()
    p[0] = {
        'type': 'class_pointer_declaration',
        'line': p.lineno(1),
        'scope': current_scope,
        'id': get_next_id(),
        'class_type': p[1],
        'name': p[3],
        'pointer_category': 'class_object'
    }

def p_new_object_stmt(p):
    '''new_object_stmt : IDENTIFIER POINTER IDENTIFIER EQUALS NEW IDENTIFIER SEMICOLON
                      | IDENTIFIER POINTER IDENTIFIER EQUALS NEW IDENTIFIER LBRACE arg_list RBRACE SEMICOLON'''
    current_scope = get_current_scope()
    
    if len(p) == 8:  # Default constructor
        p[0] = {
            'type': 'class_pointer_declaration',
            'line': p.lineno(1),
            'scope': current_scope,
            'id': get_next_id(),
            'class_type': p[1],
            'name': p[3],
            'allocation': 'new',
            'allocated_type': p[6],
            'constructor_type': 'default_constructor_call'
        }
    else:  # Parameterized constructor
        # Set scope for constructor arguments
        for arg in p[8]:
            if isinstance(arg, dict):
                set_scope_for_value(arg, current_scope)
        
        # Create arg_param_map for parameterized constructor
        class_name = p[6]
        constructor_args = p[8]
        arg_param_map = create_constructor_arg_param_map(class_name, constructor_args)
        
        p[0] = {
            'type': 'class_pointer_declaration',
            'line': p.lineno(1),
            'scope': current_scope,
            'id': get_next_id(),
            'class_type': p[1],
            'name': p[3],
            'allocation': 'new',
            'allocated_type': p[6],
            'constructor_type': 'parameterized_constructor_call',
            'constructor_args': p[8],
            'arg_param_map': arg_param_map
        }

def p_delete_stmt(p):
    '''delete_stmt : DELETE value SEMICOLON'''
    current_scope = get_current_scope()
    p[0] = {
        'type': 'delete_statement',
        'line': p.lineno(1),
        'scope': current_scope,
        'target': p[2]
    }
    # Set scope for the target if it's a variable
    if isinstance(p[2], dict) and p[2].get('type') == 'variable':
        p[2]['scope'] = current_scope

# Remove old p_stmt logic - it's been replaced by separate functions above


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
                  | POINTER IDENTIFIER EQUALS NEW IDENTIFIER
                  | POINTER IDENTIFIER EQUALS NEW IDENTIFIER LBRACE arg_list RBRACE
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
    elif len(p) == 5 and p[4].get('type') == 'address':# int p = address of value
        decl['name'] = p[2]
        decl['pointer'] = 'pointer declaration'
        decl['points_to'] = {'name': p[4]['name']}
    elif len(p) == 6 and p[4] == 'new': #simple new (both TYPE and IDENTIFIER)
        decl['name'] = p[2]
        decl['allocation'] = 'new'
        decl['allocated_type'] = p[5]
        # Check if it's a class type (IDENTIFIER) or primitive type (TYPE)
        if isinstance(p[5], str) and p[5] not in ['int', 'string', 'char', 'double', 'float', 'void']:
            decl['pointer'] = 'class pointer declaration'
            decl['constructor_type'] = 'default_constructor_call'
        else:
            decl['pointer'] = 'a pointer declaration'
    elif len(p) == 9 and p[4] == 'new' and p[6] == '{':  # new ClassName{args} (like: new Node{value, nullptr})
        decl['name'] = p[2]
        decl['pointer'] = 'class pointer declaration'
        decl['allocation'] = 'new'
        decl['allocated_type'] = p[5]
        decl['constructor_type'] = 'parameterized_constructor_call'
        decl['constructor_args'] = p[7]
        
        # Set scope for constructor arguments
        current_scope = get_current_scope()
        for arg in p[7]:
            if isinstance(arg, dict):
                set_scope_for_value(arg, current_scope)
        
        # Create arg_param_map for parameterized constructor
        class_name = p[5]
        constructor_args = p[7]
        arg_param_map = create_constructor_arg_param_map(class_name, constructor_args)
        decl['arg_param_map'] = arg_param_map
    elif len(p) == 9 and p[4] == 'new' and p[6] == '[':# array new
        decl['name'] = p[2]
        decl['pointer'] = 'array pointer declaration'
        decl['allocation'] = 'new'
        decl['array_size'] = p[7]
    elif len(p) == 5 and not isinstance(p[4], dict):# 1 dim array
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
    '''param_list : param_list COMMA param
                  | param'''
    if len(p) == 2:
        p[0] = [p[1]]
    else:
        p[0] = p[1] + [p[3]]

def p_param_list_empty(p):
    '''param_list : %prec REDUCE_EMPTY'''
    p[0] = []

def p_param(p):
    '''param : TYPE IDENTIFIER'''
    p[0] = {'type': 'parameter', 'data_type': p[1], 'name': p[2]}

def p_arg_list(p):
    '''arg_list : arg_list COMMA value
                | value'''
    if len(p) == 2:
        p[0] = [p[1]]
    else:
        p[0] = p[1] + [p[3]]

def p_arg_list_empty(p):
    '''arg_list : %prec REDUCE_EMPTY'''
    p[0] = []

def p_value(p):
    '''value : NUMBER
             | STRING_LITERAL
             | CHAR_LITERAL
             | IDENTIFIER
             | NULLPTR
             | value DOT IDENTIFIER
             | value ARROW IDENTIFIER
             | NEW TYPE LBRACKET NUMBER RBRACKET
             | NEW IDENTIFIER LBRACKET NUMBER RBRACKET'''
    if len(p) == 2:  # Simple values
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
    elif len(p) == 4:  # Member access

        
        if p[2] == '.':  # Dot operator
            p[0] = {
                'type': 'member_access',
                'object': p[1],
                'member': p[3],
                'operator': 'dot'
            }
        elif p[2] == '->':  # Arrow operator
            p[0] = {
                'type': 'member_access',
                'object': p[1],
                'member': p[3],
                'operator': 'arrow',
                'pointer_access': True
            }
    elif len(p) == 6:  # new array allocation: NEW TYPE/IDENTIFIER LBRACKET NUMBER RBRACKET
        if p[1] == 'new':
            p[0] = {
                'type': 'new_array',
                'data_type': p[2],
                'size': p[4]
            }

def p_address_of_value(p):
    '''address_of_value : ADDRESS IDENTIFIER'''
    p[0] = {'type': 'address', 'name': p[2]}

def p_class_members(p):
    '''class_members : class_member
                    | class_members class_member'''
    if len(p) == 2:
        p[0] = [p[1]]
    else:
        p[0] = p[1] + [p[2]]

def p_class_members_empty(p):
    '''class_members : %prec REDUCE_EMPTY'''
    p[0] = []

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
                   | TYPE IDENTIFIER LPAREN param_list RPAREN SEMICOLON
                   | VOID IDENTIFIER LPAREN param_list RPAREN SEMICOLON
                   | VOID IDENTIFIER LPAREN param_list RPAREN LBRACE stmt_list RBRACE
                   | IDENTIFIER LPAREN param_list RPAREN SEMICOLON
                   | IDENTIFIER LPAREN param_list RPAREN LBRACE stmt_list RBRACE
                   | TILDE IDENTIFIER LPAREN param_list RPAREN LBRACE stmt_list RBRACE
                   | access_specifier COLON'''
    
    # Handle access specifiers
    if len(p) == 3 and p[2] == ':':  # access_specifier COLON
        p[0] = {
            'type': 'access_specifier',
            'access': p[1],
            'line': p.lineno(1)
        }
        return
        
    # Handle destructor
    if len(p) == 8 and p[1] == '~':  # TILDE IDENTIFIER LPAREN param_list RPAREN LBRACE stmt_list
        class_name = p[2]
        destructor_scope = f'destructor:{class_name}'
        set_scope(destructor_scope)
        process_statement_scope(p[7], destructor_scope)
        
        p[0] = {
            'type': 'destructor',
            'name': class_name,
            'line': p.lineno(1),
            'body': p[7]
        }
        pop_scope()
        return
        
    # Handle constructor declarations (IDENTIFIER LPAREN ... )
    if (len(p) == 6 or len(p) == 8) and isinstance(p[1], str) and p[1] not in ['int', 'float', 'double', 'char', 'string', 'void']:
        # This is likely a constructor (class name matches)
        if len(p) == 6:  # IDENTIFIER LPAREN param_list RPAREN SEMICOLON (constructor declaration)
            class_name = p[1]
            if not p[3]:  # Empty parameter list = default constructor
                p[0] = {
                    'type': 'constructor_declaration',
                    'name': class_name,
                    'line': p.lineno(1),
                    'params': []
                }
            else:  # Parameterized constructor
                p[0] = {
                    'type': 'parameterized_constructor_declaration', 
                    'name': class_name,
                    'line': p.lineno(1),
                    'params': p[3]
                }
            return
        elif len(p) == 8:  # IDENTIFIER LPAREN param_list RPAREN LBRACE stmt_list RBRACE (constructor definition)
            class_name = p[1]
            if not p[3]:  # Default constructor with body
                constructor_scope = f'constructor:{class_name}'
                set_scope(constructor_scope)
                process_statement_scope(p[6], constructor_scope)
                
                p[0] = {
                    'type': 'constructor',
                    'name': class_name,
                    'line': p.lineno(1),
                    'params': [],
                    'body': p[6]
                }
                pop_scope()
            else:  # Parameterized constructor with body
                constructor_scope = f'parameterized_constructor:{class_name}'
                set_scope(constructor_scope)
                
                for param in p[3]:
                    param['scope'] = constructor_scope
                    param['id'] = get_next_id()
                
                process_statement_scope(p[6], constructor_scope)
                
                p[0] = {
                    'type': 'parameterized_constructor',
                    'name': class_name,
                    'line': p.lineno(1),
                    'params': p[3],
                    'body': p[6]
                }
                pop_scope()
            return
        
    # Handle function declarations without body (prototypes)
    if len(p) == 7 and p[5] == ')' and p[6] == ';':  # Function declaration
        p[0] = {
            'type': 'member_function_declaration',
            'return_type': p[1],
            'name': p[2],
            'params': p[4],
            'line': p.lineno(2)
        }
        return
    
    # Handle member variables (existing logic)
    if len(p) == 4:  # Member variable without default value
        p[0] = {
            'type': 'member_variable',
            'data_type': p[1],
            'name': p[2],
            'line': p.lineno(2)
        }
    elif len(p) == 5:  # Pointer member without default value
        p[0] = {
            'type': 'member_variable',
            'data_type': p[1],
            'name': p[3],
            'pointer': 'pointer declaration',
            'line': p.lineno(3)
        }
    elif len(p) == 6:  # Member variable with default value
        p[0] = {
            'type': 'member_variable',
            'data_type': p[1],
            'name': p[2],
            'default_value': p[4],
            'line': p.lineno(2)
        }
    elif len(p) == 7:  # Pointer member with default value
        if isinstance(p[5], dict):
            if p[5].get('type') == 'address':  # Address assignment (using &)
                p[0] = {
                    'type': 'member_variable',
                    'data_type': p[1],
                    'name': p[3],
                    'pointer': 'pointer declaration',
                    'points_to': {'name': p[5]['name']},
                    'line': p.lineno(3)
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
                    },
                    'line': p.lineno(3)
                }
            else:  # Regular value assignment
                p[0] = {
                    'type': 'member_variable',
                    'data_type': p[1],
                    'name': p[3],
                    'pointer': 'pointer declaration',
                    'default_value': p[5],
                    'line': p.lineno(3)
                }
    elif len(p) == 5 and p[1] != 'TYPE':  # Self-referential pointer without default value
        p[0] = {
            'type': 'member_variable',
            'data_type': p[1],  # This is the class name
            'name': p[3],
            'pointer': 'pointer declaration',
            'self_referential': True,
            'line': p.lineno(3)
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
                    'points_to': {'name': p[5]['name']},
                    'line': p.lineno(3)
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
                    },
                    'line': p.lineno(3)
                }
            else:  # Regular value assignment
                p[0] = {
                    'type': 'member_variable',
                    'data_type': p[1],
                    'name': p[3],
                    'pointer': 'pointer declaration',
                    'self_referential': True,
                    'default_value': p[5],
                    'line': p.lineno(3)
                }
    elif len(p) == 9:  # Member function with body
        p[0] = {
            'type': 'member_function',
            'return_type': p[1],
            'name': p[2],
            'belongs_to_class': '',  
            'params': p[4],
            'body': p[7],
            'line': p.lineno(2)
        }

def p_access_specifier(p):
    '''access_specifier : PUBLIC
                        | PRIVATE
                        | PROTECTED'''
    p[0] = p[1]

# If statement - separate function to avoid grammar conflicts
def p_if_stmt(p):
    '''if_stmt : IF LPAREN condition RPAREN LBRACE stmt_list RBRACE
               | IF LPAREN condition RPAREN LBRACE stmt_list RBRACE ELSE LBRACE stmt_list RBRACE'''
    current_scope = get_current_scope()
    if_scope = 'if_body'
    set_scope(if_scope)
    
    # Handle if body
    if_body_index = 6  # Always at position 6
    # Handle if body (stmt_list position varies based on if structure)
    process_statement_scope(p[if_body_index], if_scope)
    
    # Set scope for variables in the condition
    set_scope_for_value(p[3], current_scope)
    
    # Handle based on length: 8 = if only, 12 = if-else  
    if len(p) == 8:  # IF without else
        p[0] = {
            'type': 'if_statement',
            'line': p.lineno(1),
            'scope': current_scope,
            'condition': p[3],
            'if_body': p[if_body_index]
        }
    else:  # len(p) == 12: IF with else
        else_scope = 'else_body'
        set_scope(else_scope)
        process_statement_scope(p[10], else_scope)  # p[10] is else_body stmt_list
        
        p[0] = {
            'type': 'if_statement',
            'line': p.lineno(1),
            'scope': current_scope,
            'condition': p[3],
            'if_body': p[if_body_index],
            'else_body': p[10]
        }
        pop_scope()
    pop_scope()


# While statement - similar to if statement
def p_while_stmt(p):
    '''while_stmt : WHILE LPAREN condition RPAREN LBRACE stmt_list RBRACE'''
    current_scope = get_current_scope()
    while_scope = 'while_body'
    set_scope(while_scope)
    
    # Handle while body (stmt_list is at position 6)
    process_statement_scope(p[6], while_scope)
    
    # Set scope for variables in the condition
    set_scope_for_value(p[3], current_scope)
    
    p[0] = {
        'type': 'while_statement',
        'line': p.lineno(1),
        'scope': current_scope,
        'condition': p[3],
        'body': p[6]
    }
    pop_scope()


def p_condition(p):
    '''condition : value LT value
                 | value GT value
                 | value LE value
                 | value GE value
                 | value EQ value
                 | value NE value'''
    p[0] = {
        'type': 'comparison',
        'left': p[1],
        'operator': p[2],
        'right': p[3]
    }

def p_return_stmt(p):
    '''return_stmt : RETURN SEMICOLON
                   | RETURN value SEMICOLON'''
    current_scope = get_current_scope()
    if len(p) == 3:  # RETURN SEMICOLON
        p[0] = {
            'type': 'return_statement',
            'line': p.lineno(1),
            'scope': current_scope,
            'value': None
        }
    else:  # RETURN value SEMICOLON
        p[0] = {
            'type': 'return_statement',
            'line': p.lineno(1),
            'scope': current_scope,
            'value': p[2]
        }
        # Set scope for the return value
        if isinstance(p[2], dict):
            set_scope_for_value(p[2], current_scope)

def p_error(p):
    global parse_errors
    if p:
        error_msg = f"Syntax error at line {p.lineno} before '{p.value}' (token type: {p.type})"
        print(error_msg)
        parse_errors.append(error_msg)
        # Try to recover by skipping the problematic token
        parser.errok()
    else:
        error_msg = "Syntax error at EOF - unexpected end of input"
        print(error_msg)
        parse_errors.append(error_msg)

parser = yacc.yacc()

def parse_cpp_code(input_code, debug=False):
    """Main parsing function that handles C++ code and returns AST"""
    # Clear previous state
    clear_parse_state()
    
    if debug:
        print(f"Parsing input code ({len(input_code)} characters):")
        print("=" * 50)
        print(input_code)
        print("=" * 50)
    
    try:
        # Reset lexer
        from mylexer import lexer
        lexer.input(input_code)
        
        # Parse and generate AST
        result = parser.parse(input_code, lexer=lexer, debug=debug)
        
        if debug:
            print(f"Parse result type: {type(result)}")
            print(f"Parse result: {result}")
            print(f"Functions dict: {functions_dict}")
            print(f"Classes dict: {classes_dict}")
            print(f"Parse errors: {parse_errors}")
        
        # Ensure we have a proper AST structure
        if result is None:
            if parse_errors:
                print(f"Parsing failed with {len(parse_errors)} errors:")
                for error in parse_errors:
                    print(f"  - {error}")
                # Create a minimal AST structure even if parsing fails
                result = [{
                    'type': 'parse_error',
                    'errors': parse_errors,
                    'message': 'Failed to parse C++ code'
                }]
            else:
                print("Parser returned None without errors - creating empty AST")
                result = []
        
        # Ensure result is a list
        if not isinstance(result, list):
            result = [result] if result else []
        
        # Add class type information
        enhanced_result = add_class_types_to_variables(result)
        
        return enhanced_result, functions_dict, classes_dict
        
    except Exception as e:
        error_msg = f"Exception during parsing: {str(e)}"
        print(error_msg)
        parse_errors.append(error_msg)
        return [{
            'type': 'parse_exception',
            'error': str(e),
            'message': 'Exception occurred during parsing'
        }], {}, {}

def add_class_types_to_variables(data):
    """Add class type information to variables based on their names"""
    def process_item(item, parent_scope=None):
        if isinstance(item, dict):
            # Get the current item's scope, or inherit from parent
            current_scope = item.get('scope', parent_scope)
            
            # Special handling for constructor arguments
            if item.get('constructor_args'):
                for arg in item['constructor_args']:
                    if isinstance(arg, dict) and arg.get('type') == 'variable':
                        if arg.get('scope') == 'global' and current_scope:
                            arg['scope'] = current_scope
            
            # If this is a variable, add class type based on name
            if item.get('type') == 'variable':
                var_name = item.get('name')
                
                # Add class type
                if var_name in ['list1', 'list2']:
                    item['class_type'] = 'LinkedList'
                elif var_name in ['temp', 'newNode', 'head']:
                    item['class_type'] = 'Node'
                
                # Fix scope if needed
                if item.get('scope') == 'global' and parent_scope and parent_scope != 'global':
                    item['scope'] = parent_scope
            
            # Recursively process all values, passing down the current scope
            for key, value in item.items():
                if key != 'constructor_args':  # Already handled above
                    process_item(value, current_scope or parent_scope)
        elif isinstance(item, list):
            # Process all items in the list
            for sub_item in item:
                process_item(sub_item, parent_scope)
    
    process_item(data)
    return data

def generate_json(ast, functions_dict, classes_dict, filename='output.json'):
    # Add class type information to variables
    enhanced_ast = add_class_types_to_variables(ast)
    
    with open(filename, 'w') as f:
        json.dump(enhanced_ast, f, indent=2)
    with open('functions.json', 'w') as f:
        json.dump(functions_dict, f, indent=2)
    with open('classes.json', 'w') as f:
        json.dump(classes_dict, f, indent=2)
    print(f"JSON output written to {filename}")
    
    
def create_method_arg_param_map(method_name, args):
    """Create arg_param_map for method calls by finding method in any class"""
    arg_param_map = []
    if not args:
        return arg_param_map
        
    for class_name, class_info in classes_dict.items():
        for member in class_info.get('members', []):
            if member.get('type') == 'member_function' and member.get('name') == method_name:
                method_params = member.get('params', [])
                if len(method_params) == len(args):
                    arg_param_map = [{'param_name': method_params[i]['name'], 'arg_value': args[i]} for i in range(len(args))]
                return arg_param_map  # Return immediately when found
    return arg_param_map

def create_constructor_arg_param_map(class_name, constructor_args):
    """Create arg_param_map for constructor calls (handles both explicit & aggregate)"""
    arg_param_map = []
    if not constructor_args or class_name not in classes_dict:
        return arg_param_map
        
    class_info = classes_dict[class_name]
    
    # First try to find explicit parameterized constructor
    constructor_params = []
    for constructor in class_info.get('constructors', []):
        if constructor.get('type') == 'parameterized constructor':
            constructor_params = constructor.get('params', [])
            break
    
    # If no explicit constructor found, use member variables for aggregate initialization
    if not constructor_params:
        member_vars = [member for member in class_info.get('members', []) 
                      if member.get('type') == 'member_variable']
        if len(member_vars) == len(constructor_args):
            arg_param_map = [{'param_name': member_vars[i]['name'], 'arg_value': constructor_args[i]} 
                           for i in range(len(constructor_args))]
    else:
        # Use explicit constructor parameters
        if len(constructor_params) == len(constructor_args):
            arg_param_map = [{'param_name': constructor_params[i]['name'], 'arg_value': constructor_args[i]} 
                           for i in range(len(constructor_args))]
    
    return arg_param_map

def create_function_arg_param_map(function_name, args):
    """Create arg_param_map for function calls"""
    arg_param_map = []
    if not args:
        return arg_param_map
        
    function_data = functions_dict.get(function_name, {})
    function_params = function_data.get('params', [])
    if len(function_params) == len(args):
        arg_param_map = [{'param_name': function_params[i]['name'], 'arg_value': args[i]} for i in range(len(function_params))]
    
    return arg_param_map

def process_statement_scope(stmt_list, scope_name):
    """Process scope for a list of statements - eliminates repetitive scope setting"""
    if not stmt_list:
        return
        
    for stmt in stmt_list:
        if not stmt:
            continue
            
        if stmt.get('type') == 'declaration':
            for decl in stmt['declarations']:
                if 'dimensions' in decl:
                    size = 1
                    for dim in decl['dimensions']:
                        size *= int(dim)
                    decl['id'] = get_next_id(size)
                else:
                    decl['id'] = get_next_id()
                decl['scope'] = scope_name
        elif stmt.get('type') == 'function_call':
            stmt['scope'] = scope_name
            if 'arg_param_map' in stmt:
                for arg_param in stmt['arg_param_map']:
                    if isinstance(arg_param['arg_value'], dict) and arg_param['arg_value'].get('type') == 'variable':
                        arg_param['arg_value']['scope'] = scope_name
        elif stmt.get('type') == 'assignment':
            stmt['scope'] = scope_name
            if stmt.get('value'):
                set_scope_for_value(stmt['value'], scope_name)
        elif stmt.get('type') == 'member_assignment':
            stmt['scope'] = scope_name
            if stmt.get('value'):
                set_scope_for_value(stmt['value'], scope_name)
        elif stmt.get('type') in ['object_declaration', 'class_pointer_declaration']:
            stmt['scope'] = scope_name
        elif stmt.get('type') in ['if_statement', 'while_statement']:
            stmt['scope'] = scope_name
            if stmt.get('condition'):
                set_scope_for_value(stmt['condition'], scope_name)
        elif stmt.get('type') == 'delete_statement':
            stmt['scope'] = scope_name
            if stmt.get('target') and isinstance(stmt['target'], dict):
                set_scope_for_value(stmt['target'], scope_name)
        elif stmt.get('type') == 'method_call':
            stmt['scope'] = scope_name
            if stmt.get('object') and isinstance(stmt['object'], dict):
                set_scope_for_value(stmt['object'], scope_name)
            if stmt.get('args'):
                for arg in stmt['args']:
                    if isinstance(arg, dict):
                        set_scope_for_value(arg, scope_name)

def assign_ids_to_declarations(stmt_list):
    """Assign IDs to declarations in a statement list"""
    for stmt in stmt_list:
        if stmt and stmt.get('type') == 'declaration':
            for decl in stmt['declarations']:
                if 'dimensions' in decl:
                    size = 1
                    for dim in decl['dimensions']:
                        size *= int(dim)
                    decl['id'] = get_next_id(size)
                else:
                    decl['id'] = get_next_id()

def clear_parse_state():
    """Clear global parsing state for a fresh start"""
    global scope_stack, functions_dict, classes_dict, current_id, parse_errors
    scope_stack = []
    functions_dict = {}
    classes_dict = {}
    current_id = 100000
    parse_errors = []
