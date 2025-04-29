#!/bin/bash

# Ensure Emscripten is in the PATH
source ~/emsdk/emsdk_env.sh

# Create build directory
mkdir -p public/cpp

# Compile C++ code to WebAssembly
emcc src/cpp/compiler.cpp \
    -o public/cpp/compiler.js \
    -s WASM=1 \
    -s EXPORTED_RUNTIME_METHODS=['ccall','cwrap'] \
    -s EXPORTED_FUNCTIONS=['_compile_and_run'] \
    -s MODULARIZE=1 \
    -s ENVIRONMENT='web' \
    -s SINGLE_FILE=1 \
    -s ALLOW_MEMORY_GROWTH=1

echo "Emscripten build complete!" 