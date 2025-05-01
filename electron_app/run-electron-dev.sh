#!/bin/bash

# Create dist-electron directory if it doesn't exist
mkdir -p dist-electron

# Compile Electron files with TypeScript
echo "Compiling Electron scripts..."
npx tsc -p tsconfig.electron.json

# Start development server with specific port
echo "Starting Vite development server..."
npx vite --port 5173 --strictPort false &
VITE_PID=$!

# Wait for Vite server to be ready
echo "Waiting for Vite server to be ready..."
npx wait-on http://localhost:5173

# Run Electron with sandbox disabled
echo "Starting Electron app..."
NODE_ENV=development npx electron . --no-sandbox

# Clean up on exit
kill $VITE_PID 