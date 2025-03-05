import ply.lex as lex

tokens = (
    'MAIN', 'TYPE', 'IDENTIFIER', 'NUMBER', 'CHAR_LITERAL', 'STRING_LITERAL',
    'EQUALS', 'SEMICOLON', 'COMMA', 'LBRACE', 'RBRACE', 'LBRACKET', 'RBRACKET',
    'LPAREN', 'RPAREN'
)
def t_newline(t):
    r'\n+'
    t.lexer.lineno += len(t.value)
    
def t_INCLUDE(t):
    r'\#include[ \t]*<[^>]+>'
    pass  # Ignore include directives

def t_NAMESPACE(t):
    r'using[ \t]+namespace[ \t]+std[ \t]*;'
    pass  # Ignore namespace declaration

def t_MAIN(t):
    r'\bmain\b'
    return t

def t_TYPE(t):
    r'\b(int|float|double|char|string)\b'
    return t

def t_IDENTIFIER(t):
    r'[a-zA-Z_][a-zA-Z0-9_]*'
    return t

def t_NUMBER(t):
    r'\d+(\.\d+)?([eE][+-]?\d+)?'  # Handle integers, floats, exponents
    if '.' in t.value or 'e' in t.value.lower():
        t.value = float(t.value)
    else:
        t.value = int(t.value)
    return t

def t_CHAR_LITERAL(t):
    r"'(\\.|[^'\\])'"
    t.value = t.value[1:-1]  # Strip quotes
    return t

def t_STRING_LITERAL(t):
    r'\"(\\.|[^"\\])*\"'
    t.value = t.value[1:-1]  # Strip quotes
    return t

t_LPAREN = r'\('
t_RPAREN = r'\)'
t_LBRACKET = r'\['
t_RBRACKET = r'\]'
t_LBRACE = r'\{'
t_RBRACE = r'\}'
t_EQUALS = r'='
t_SEMICOLON = r';'
t_COMMA = r','

t_ignore = ' \t\r'  # Ignore whitespace

def t_error(t):
    print(f"Illegal character '{t.value[0]}'")
    t.lexer.skip(1)

lexer = lex.lex()