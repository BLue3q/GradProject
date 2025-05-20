# C++ Code Visualizer

An Electron desktop application for writing, compiling, and running C++ code.

## Features

- Code editor for writing C++ code
- Compile and run C++ code using the system's g++ compiler
- View program output and compilation errors in real-time
- (Coming soon) Visualization of code execution

## Prerequisites

- Node.js (v16+)
- npm or yarn
- g++ compiler installed and accessible in your PATH

## Getting Started

### Installation

```bash
# Navigate to the app directory
cd electron_app

# Install dependencies
npm install
```

### Running the Application

The easiest way to run the application in development mode is to use the provided shell script:

```bash
# Make sure the script is executable
chmod +x run-electron-dev.sh

# Run the application
./run-electron-dev.sh
```

This script will:
1. Compile the TypeScript files for Electron
2. Start the Vite development server
3. Launch Electron and connect to the development server

### Using the Application

1. Write your C++ code in the editor on the left side
2. Click "Run Code" to compile and execute your code
3. View the output in the panel on the top right
4. The visualization panel (bottom right) will be used for future visualization features

## Troubleshooting

If you encounter any issues:

- Make sure g++ is installed and in your PATH
- Ensure all dependencies are installed with `npm install`
- Check that TypeScript is correctly compiling the Electron files
