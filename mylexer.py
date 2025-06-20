import ply.lex as lex

tokens = (
    'MAIN', 'TYPE', 'IDENTIFIER', 'NUMBER', 'CHAR_LITERAL', 'STRING_LITERAL',
    'EQUALS', 'SEMICOLON', 'COMMA', 'LBRACE', 'RBRACE', 'LBRACKET', 'RBRACKET',
    'LPAREN', 'RPAREN', 'NEW', 'DELETE', 'TILDE', 'POINTER', 'ADDRESS', 'NULLPTR', 'CLASS',
    'ARROW', 'DOT', 'IF', 'ELSE', 'WHILE', 'LT', 'GT', 'LE', 'GE', 
    'EQ', 'NE'
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
    t.lineno = t.lexer.lineno
    return t

def t_CLASS(t):
    r'\bclass\b'
    t.lineno = t.lexer.lineno
    return t

def t_TYPE(t):
    r'\b(int|float|double|char|string|void|class)\b'
    t.lineno = t.lexer.lineno
    return t

def t_NEW(t):
    r'\bnew\b'
    t.lineno = t.lexer.lineno
    return t

def t_DELETE(t):
    r'\bdelete\b'
    t.lineno = t.lexer.lineno
    return t

def t_IF(t):
    r'\bif\b'
    t.lineno = t.lexer.lineno
    return t

def t_ELSE(t):
    r'\belse\b'
    t.lineno = t.lexer.lineno
    return t

def t_FOR(t):
    r'\bfor\b'
    t.lineno = t.lexer.lineno
    return t

def t_WHILE(t):
    r'\bwhile\b'
    t.lineno = t.lexer.lineno
    return t

def t_IDENTIFIER(t):
    r'[a-zA-Z_][a-zA-Z0-9_]*'
    t.lineno = t.lexer.lineno
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

# Comparison operators (order matters for multi-character operators)
t_LE = r'<='
t_GE = r'>='
t_EQ = r'=='
t_NE = r'!='
t_LT = r'<'
t_GT = r'>'

t_ignore = ' \t\r'  # Ignore whitespace

def t_POINTER(t):
    r'\*'
    t.lineno = t.lexer.lineno
    return t

def t_ADDRESS(t):
    r'&'
    t.lineno = t.lexer.lineno
    return t

def t_NULLPTR(t):
    r'\b(nullptr|NULL)\b'
    t.lineno = t.lexer.lineno
    return t

def t_comment_single(t):
    r'//.*'
    pass  # Ignore single-line comments

def t_ARROW(t):
    r'->'
    t.lineno = t.lexer.lineno
    return t

def t_DOT(t):
    r'\.'
    t.lineno = t.lexer.lineno
    return t

def t_TILDE(t):
    r'~'
    t.lineno = t.lexer.lineno
    return t

def t_error(t):
    print(f"Illegal character '{t.value[0]}'")
    t.lexer.skip(1)

lexer = lex.lex()