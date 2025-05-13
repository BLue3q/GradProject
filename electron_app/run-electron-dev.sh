#!/bin/bash
mkdir -p dist-electron
echo "Compiling Electron scripts..."
npx tsc -p tsconfig.electron.json
echo "Starting Vite development server..."
npx vite --port 5173 --strictPort false &
VITE_PID=$!
echo "Waiting for Vite server to be ready..."
npx wait-on http://localhost:5173
echo "Starting Electron app..."
NODE_ENV=development npx electron . --no-sandbox
kill $VITE_PID 