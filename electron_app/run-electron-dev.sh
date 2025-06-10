#!/bin/bash

# Create dist-electron directory
mkdir -p dist-electron

echo "🔧 Compiling Electron scripts..."
npx tsc -p tsconfig.electron.json

echo "🚀 Starting Vite development server..."
# Start Vite and find available port
npx vite --host localhost --port 5173 --strictPort false &
VITE_PID=$!

echo "⏳ Waiting for Vite server to be ready..."
# Wait for any available port that Vite chooses
npx wait-on http://localhost:5173 http://localhost:5174 http://localhost:5175 http://localhost:5176 http://localhost:5177 --timeout 30000

echo "⚡ Starting Electron app..."
NODE_ENV=development npx electron . --no-sandbox

# Cleanup
echo "🧹 Cleaning up..."
kill $VITE_PID 2>/dev/null || true 