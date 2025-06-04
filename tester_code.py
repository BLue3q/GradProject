import mylexer
from myparser import parser, generate_json,functions_dict,declarations_dict

with open("tested_code.txt", "r") as file:
    tested_code = file.read()

# Tokenize 
mylexer.lexer.input(tested_code)
# Parse and generate JSON
result = parser.parse(tested_code)
generate_json(result,functions_dict,declarations_dict)

# atifacts describe parser
# introduction
# project goals scope
# simialr projects and what difference
# parser tools , description of parser , grammer
# how to use parser
# problems and how solved
# json manual

# desktop application ,interface 
# how connected to parser via block diagram
# draw to the app how it works
# how to use the app
# manual for the app

# visualization
# tools
# what mean , how work
# how to use it
