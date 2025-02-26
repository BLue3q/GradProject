%{
#include "Comp.tab.h"
#include <stdlib.h>
#include <string.h>

extern void yyerror(const char *s);
%}

%%
^#include[ \t]*<[^>]+>                      { /* Skip includes */ }

^using[ \t]+namespace[ \t]+std[ \t]*;       { /* Skip using namespaces */ }

"main"                                      { return MAIN; }

int|float|double|char|string   { 
    yylval.str = strdup(yytext); 
    return TYPE; 
}

[a-zA-Z_][a-zA-Z0-9_]*  { 
    yylval.str = strdup(yytext); 
    return IDENTIFIER;  
}

[0-9]+                  { 
    yylval.num = atoi(yytext); 
    return NUMBER; 
}

'(\\.|[^'\\])'          { 
    char* text = strndup(yytext + 1, strlen(yytext) - 2);
    yylval.str = text;
    return CHAR_LITERAL; 
}

\"(\\.|[^"\\])*\"       { 
    char* text = strndup(yytext + 1, strlen(yytext) - 2);
    yylval.str = text;
    return STRING_LITERAL; 
}


")"                         { return RHCIRCLE; }
"("                         { return LHCIRCLE; }
"["                         { return LBRACKET; }
"]"                         { return RBRACKET; }
"}"                         { return RBRACE; }
"{"                         { return LBRACE; }
"="                         { return EQUALS; }
";"                         { return SEMICOLON; }
","                         { return COMMA; }
[ \t\r\n]+                  { /* Ignore whitespace */ }
.                           { yyerror("Invalid character"); }

%%