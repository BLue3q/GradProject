import mylexer
from myparser import parser, generate_json, functions_dict, classes_dict

with open("tested_code.txt", "r") as file:
    tested_code = file.read()

# Tokenize 
mylexer.lexer.input(tested_code)
# Parse and generate JSON
result = parser.parse(tested_code)
generate_json(result, functions_dict, classes_dict)