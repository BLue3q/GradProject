%{
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

void yyerror(const char *s);
int yylex();

FILE *jsonFile;
int firstEntry = 1;
char *currentType = NULL;
%}

%union {
    char* str;
    int num;
}

%token <str> TYPE IDENTIFIER CHAR_LITERAL STRING_LITERAL
%token <num> NUMBER
%token EQUALS SEMICOLON COMMA LBRACE RBRACE LBRACKET RBRACKET MAIN LHCIRCLE RHCIRCLE
%type <str> array_values array_values_2d value

%%

stmt_list:
    | stmt_list stmt
    ;

stmt:
    TYPE { currentType = $1; } var_list SEMICOLON {
        free(currentType);
        currentType = NULL;
    }
    |TYPE MAIN LHCIRCLE RHCIRCLE LBRACE RBRACE{
         
    }
    ;

var_list:
    declarator
    | var_list COMMA declarator
    ;

declarator:
    IDENTIFIER {
        fprintf(jsonFile, "%s    {\"name\": \"%s\", \"type\": \"%s\"}",
                firstEntry ? "" : ",\n", $1, currentType);
        firstEntry = 0;
        free($1);
    }
    | IDENTIFIER EQUALS NUMBER {
        fprintf(jsonFile, "%s    {\"name\": \"%s\", \"type\": \"%s\", \"value\": %d}",
                firstEntry ? "" : ",\n", $1, currentType, $3);
        firstEntry = 0;
        free($1);
    }
    | IDENTIFIER EQUALS CHAR_LITERAL {
        fprintf(jsonFile, "%s    {\"name\": \"%s\", \"type\": \"%s\", \"value\": \"%s\"}",
                firstEntry ? "" : ",\n", $1, currentType, $3);
        firstEntry = 0;
        free($1);
        free($3);
    }
    | IDENTIFIER EQUALS STRING_LITERAL {
        fprintf(jsonFile, "%s    {\"name\": \"%s\", \"type\": \"%s\", \"value\": \"%s\"}",
                firstEntry ? "" : ",\n", $1, currentType, $3);
        firstEntry = 0;
        free($1);
        free($3);
    }
    | IDENTIFIER LBRACKET NUMBER RBRACKET {
        fprintf(jsonFile, "%s    {\"name\": \"%s\", \"type\": \"%s\", \"size\": %d, \"values\": []}",
                firstEntry ? "" : ",\n", $1, currentType, $3);
        firstEntry = 0;
        free($1);
    }
    | IDENTIFIER LBRACKET NUMBER RBRACKET EQUALS LBRACE array_values RBRACE {
        fprintf(jsonFile, "%s    {\"name\": \"%s\", \"type\": \"%s\", \"size\": %d, \"values\": [%s]}",
                firstEntry ? "" : ",\n", $1, currentType, $3, $7);
        firstEntry = 0;
        free($1);
        free($7);
    }
    | IDENTIFIER LBRACKET NUMBER RBRACKET LBRACKET NUMBER RBRACKET {
        fprintf(jsonFile, "%s    {\"name\": \"%s\", \"type\": \"%s\", \"size\": [%d, %d], \"values\": []}",
                firstEntry ? "" : ",\n", $1, currentType, $3, $6);
        firstEntry = 0;
        free($1);
    }
    | IDENTIFIER LBRACKET NUMBER RBRACKET LBRACKET NUMBER RBRACKET EQUALS LBRACE array_values_2d RBRACE {
        fprintf(jsonFile, "%s    {\"name\": \"%s\", \"type\": \"%s\", \"size\": [%d, %d], \"values\": [%s]}",
                firstEntry ? "" : ",\n", $1, currentType, $3, $6, $10);
        firstEntry = 0;
        free($1);
        free($10);
    };


array_values:
      value {
          $$ = strdup($1);
      }
    | array_values COMMA value {
          asprintf(&$$, "%s, %s", $1, $3);
          free($1);
          free($3);
      };

value:
      NUMBER {
          asprintf(&$$, "%d", $1);
      }
    | STRING_LITERAL {
          asprintf(&$$, "\"%s\"", $1);
          free($1);
      }
    | CHAR_LITERAL {
          asprintf(&$$, "'%s'", $1);
          free($1);
      };

array_values_2d:
      LBRACE array_values RBRACE {
          asprintf(&$$, "[%s]", $2);
          free($2);
      }
    | array_values_2d COMMA LBRACE array_values RBRACE {
          asprintf(&$$, "%s,[%s]", $1, $4);
          free($1);
          free($4);
      };
%%

int main() {
    jsonFile = fopen("output.json", "w");
    if (!jsonFile) {
        fprintf(stderr, "Error opening JSON file\n");
        return 1;
    }

    fprintf(jsonFile, "{\n  \"variables\": [\n");
    yyparse();
    fprintf(jsonFile, "\n  ]\n}\n");
    fclose(jsonFile);
    return 0;
}

void yyerror(const char *s) {
    fprintf(stderr, "Error: %s\n", s);
}
