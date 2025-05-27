#!/bin/bash

# Navigate to the electron app directory
cd "$(dirname "$0")/electron_app" || exit 1

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install || exit 1
fi

# Build Vite assets in watch mode and start Electron
echo "Starting Electron in development mode..."

# Run both Vite and Electron using concurrently (must be installed globally or in devDeps)
npx concurrently -k \
  "npx vite" \
  "wait-on tcp:5173 && npx electron . --no-sandbox"