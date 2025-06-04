"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
// Create temporary directory for compilation
const tmpDir = path.join(os.tmpdir(), 'cpp-visualizer');
if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
}
// Store the currently running process
let currentProcess = null;
let mainWindow = null;
// Track if the process is waiting for input
let inputMode = false;
// Add deduplication for events
let lastEventSent = '';
let lastEventTime = 0;
const sendToRenderer = (channel, data) => {
    if (!mainWindow || mainWindow.isDestroyed())
        return;
    // Deduplicate identical events sent within 100ms
    const eventKey = `${channel}:${typeof data === 'string' ? data : JSON.stringify(data)}`;
    const now = Date.now();
    if (eventKey === lastEventSent && now - lastEventTime < 100) {
        console.log(`Deduplicating event: ${channel}`);
        return;
    }
    lastEventSent = eventKey;
    lastEventTime = now;
    mainWindow.webContents.send(channel, data);
};
// Function to clean up resources
const cleanupProcess = () => {
    if (currentProcess && !currentProcess.killed) {
        try {
            currentProcess.kill('SIGTERM');
            console.log('Cleaned up existing process');
        }
        catch (e) {
            console.warn('Failed to kill existing process:', e);
        }
        currentProcess = null;
    }
};
const createWindow = () => {
    const win = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    // Save reference to the main window
    mainWindow = win;
    if (process.env.NODE_ENV === 'development') {
        // Try different ports that Vite might be using
        const tryPorts = [5173, 5174, 5175, 5176, 5177, 5178, 5179, 5180];
        let connected = false;
        const tryNextPort = (index) => {
            if (index >= tryPorts.length) {
                console.error('Could not connect to Vite dev server on any port');
                win.loadFile(path.join(__dirname, '../dist/index.html'));
                return;
            }
            const port = tryPorts[index];
            const url = `http://localhost:${port}`;
            console.log(`Trying to connect to Vite dev server at ${url}`);
            win.loadURL(url).catch(() => {
                console.log(`Port ${port} failed, trying next...`);
                tryNextPort(index + 1);
            });
        };
        tryNextPort(0);
        // win.webContents.openDevTools();
    }
    else {
        win.loadFile(path.join(__dirname, '../dist/index.html'));
    }
};
electron_1.app.whenReady().then(createWindow);
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
electron_1.app.on('activate', () => {
    if (electron_1.BrowserWindow.getAllWindows().length === 0)
        createWindow();
});
// Handle C++ compilation and execution
electron_1.ipcMain.handle('compile-cpp', async (event, code) => {
    // Clear any existing output before starting
    sendToRenderer('program-output', '');
    try {
        console.log('Starting C++ compilation...');
        sendToRenderer('program-output', 'Compiling...\n');
        // Clean up any existing process
        cleanupProcess();
        // Create a temporary file for the C++ code
        const tempDir = path.join(os.tmpdir(), 'cpp-visualizer');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        const cppFile = path.join(tempDir, 'main.cpp');
        const exeFile = path.join(tempDir, process.platform === 'win32' ? 'main.exe' : 'main');
        // Write the code to the temporary file
        fs.writeFileSync(cppFile, code);
        // Compile the C++ code
        const compileArgs = process.platform === 'win32'
            ? ['-o', exeFile, cppFile]
            : ['-o', exeFile, cppFile];
        const compiler = process.platform === 'win32' ? 'g++' : 'g++';
        return new Promise((resolve, reject) => {
            const compileProcess = (0, child_process_1.spawn)(compiler, compileArgs, {
                cwd: tempDir,
                stdio: ['pipe', 'pipe', 'pipe']
            });
            let compileError = '';
            compileProcess.stderr.on('data', (data) => {
                compileError += data.toString();
            });
            compileProcess.on('error', (err) => {
                const errorMsg = err.message;
                sendToRenderer('program-output', `Compilation Error:\n${errorMsg}\n`);
                resolve('compilation-failed');
            });
            compileProcess.on('close', (code) => {
                if (code !== 0) {
                    // Compilation failed
                    const errorMsg = compileError || 'Unknown compilation error';
                    sendToRenderer('program-output', `Compilation Error:\n${errorMsg}\n`);
                    resolve('compilation-failed');
                    return;
                }
                // Check if executable was created
                if (!fs.existsSync(exeFile)) {
                    sendToRenderer('program-output', 'Compilation Error: Executable not created\n');
                    resolve('compilation-failed');
                    return;
                }
                // Compilation successful, now run the program
                console.log('C++ compilation successful, running program...');
                sendToRenderer('program-output', 'Compilation successful. Running program...\n');
                sendToRenderer('program-output', '\n--- Program Output ---\n');
                // Run the compiled program
                currentProcess = (0, child_process_1.spawn)(exeFile, [], {
                    cwd: tempDir,
                    stdio: ['pipe', 'pipe', 'pipe']
                });
                // Track program state
                let hasOutput = false;
                let outputBuffer = '';
                let errorBuffer = '';
                // Handle stdout
                currentProcess.stdout?.on('data', (data) => {
                    hasOutput = true;
                    const output = data.toString();
                    outputBuffer += output;
                    // Real-time output streaming
                    sendToRenderer('program-output', output);
                });
                // Handle stderr as regular output (some C++ programs output to stderr)
                currentProcess.stderr?.on('data', (data) => {
                    hasOutput = true;
                    const output = data.toString();
                    errorBuffer += output;
                    // Check if it's actually an error or just regular output to stderr
                    // For now, treat it as regular output unless it contains error keywords
                    if (output.toLowerCase().includes('error') ||
                        output.toLowerCase().includes('exception') ||
                        output.toLowerCase().includes('fault')) {
                        sendToRenderer('program-output', `[Error] ${output}`);
                    }
                    else {
                        sendToRenderer('program-output', output);
                    }
                });
                // Handle program completion
                currentProcess.on('close', (exitCode) => {
                    console.log(`Program finished with exit code: ${exitCode}`);
                    // Use a timeout to ensure all output is captured
                    setTimeout(() => {
                        if (!hasOutput && !outputBuffer && !errorBuffer) {
                            sendToRenderer('program-output', '[No output produced]\n');
                        }
                        sendToRenderer('program-output', `\n--- Program finished with exit code: ${exitCode} ---\n`);
                        sendToRenderer('program-finished', exitCode);
                        currentProcess = null;
                        resolve('execution-completed');
                    }, 100); // Small delay to ensure all output is processed
                });
                // Handle program errors
                currentProcess.on('error', (err) => {
                    console.error('Program runtime error:', err);
                    sendToRenderer('program-output', `\n[System] Runtime Error: ${err.message}\n`);
                    currentProcess = null;
                    resolve('execution-failed');
                });
                // Set up a timeout for the program execution (30 seconds)
                const executionTimeout = setTimeout(() => {
                    if (currentProcess && !currentProcess.killed) {
                        console.log('Terminating program due to timeout');
                        currentProcess.kill('SIGTERM');
                        sendToRenderer('program-output', `\n[System] Program terminated due to timeout (30 seconds)\n`);
                        resolve('spawn-failed');
                    }
                }, 30000);
                // Clear timeout when process completes
                currentProcess.on('close', () => {
                    clearTimeout(executionTimeout);
                });
            });
        });
    }
    catch (error) {
        console.error('System error during compilation:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        sendToRenderer('program-output', `\n[System] System Error: ${errorMessage}\n`);
        return 'system-error';
    }
});
// Handle user input for interactive programs
electron_1.ipcMain.on('send-program-input', (event, input) => {
    if (currentProcess && currentProcess.stdin && inputMode) {
        currentProcess.stdin.write(input + '\n');
        inputMode = false; // Reset input mode
        sendToRenderer('program-output', input + '\r\n');
    }
});
// Kill running process when requested
electron_1.ipcMain.on('kill-running-process', () => {
    cleanupProcess();
});
// Check if the process is waiting for input
electron_1.ipcMain.handle('check-input-mode', () => {
    return inputMode;
});
// Handle Python script execution
electron_1.ipcMain.handle('run-python', async (event, scriptPath) => {
    try {
        // Kill any existing process
        if (currentProcess) {
            currentProcess.kill();
            currentProcess = null;
        }
        // Normalize the script path - if it's a relative path, make it absolute
        let fullScriptPath = scriptPath;
        if (!path.isAbsolute(scriptPath)) {
            // For scripts in the root directory (like tester_code.py)
            fullScriptPath = path.join(electron_1.app.getAppPath(), '..', scriptPath);
        }
        console.log(`Executing Python script: ${fullScriptPath}`);
        // Run the Python script using spawn with unbuffered mode
        // Set cwd to the script directory to ensure relative imports work
        // The -u flag ensures Python doesn't buffer stdout/stderr
        currentProcess = (0, child_process_1.spawn)('python3', ['-u', fullScriptPath], {
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: false, // Don't use shell to avoid additional buffering
            cwd: path.dirname(fullScriptPath)
        });
        // Reset input mode
        inputMode = false;
        // Send the initial command to the terminal
        sendToRenderer('program-output', `> python3 ${fullScriptPath}\r\n`);
        let outputData = '';
        // Set up stdout handler
        if (currentProcess.stdout) {
            currentProcess.stdout.on('data', (data) => {
                const output = data.toString();
                outputData += output;
                // If the output ends without a newline and isn't just whitespace,
                // it might be an input prompt - set input mode to true
                const endsWithoutNewline = output.length > 0 &&
                    !output.endsWith('\n') &&
                    !output.endsWith('\r\n') &&
                    output.trim().length > 0;
                // Check if this looks like an input prompt
                if (endsWithoutNewline) {
                    // Set input mode to true to indicate we're waiting for input
                    inputMode = true;
                    // Notify the renderer process that we're waiting for input
                    sendToRenderer('input-required', true);
                }
                // Send real-time output to the renderer
                sendToRenderer('program-output', output);
            });
        }
        // Set up stderr handler
        if (currentProcess.stderr) {
            currentProcess.stderr.on('data', (data) => {
                const output = data.toString();
                outputData += `Error: ${output}`;
                // Send real-time error output to the renderer
                sendToRenderer('program-output', `Error: ${output}`);
            });
        }
        // Handle process completion
        currentProcess.on('close', (code) => {
            currentProcess = null;
            // Reset input mode
            inputMode = false;
            // Send process completion event to the renderer
            sendToRenderer('program-finished', code);
        });
        // Handle potential errors
        currentProcess.on('error', (err) => {
            currentProcess = null;
            return `Runtime Error: ${err.message}`;
        });
        return outputData;
    }
    catch (error) {
        return `System Error: ${error instanceof Error ? error.message : String(error)}`;
    }
});
// Function to run Python analysis after C++ execution
async function runPythonAnalysis(cppFilePath, cppCode) {
    try {
        // Look for Python analysis scripts in the root directory
        const rootDir = path.join(__dirname, '..', '..');
        const lexerPath = path.join(rootDir, 'mylexer.py');
        const parserPath = path.join(rootDir, 'myparser.py');
        // Check which script exists
        let scriptPath = '';
        if (fs.existsSync(lexerPath)) {
            scriptPath = lexerPath;
        }
        else if (fs.existsSync(parserPath)) {
            scriptPath = parserPath;
        }
        else {
            console.log('No Python analysis script found - skipping analysis');
            return;
        }
        console.log(`Running background Python analysis: ${scriptPath}`);
        // Run the Python script with the C++ file as input
        const pythonProcess = (0, child_process_1.spawn)('python3', [scriptPath, cppFilePath], {
            stdio: ['pipe', 'pipe', 'pipe'],
            cwd: rootDir
        });
        let analysisOutput = '';
        pythonProcess.stdout.on('data', (data) => {
            analysisOutput += data.toString();
        });
        pythonProcess.stderr.on('data', (data) => {
            console.error('Python analysis error:', data.toString());
        });
        pythonProcess.on('close', (code) => {
            if (code === 0) {
                // Check if output.json was created
                const outputJsonPath = path.join(rootDir, 'output.json');
                if (fs.existsSync(outputJsonPath)) {
                    try {
                        // Read the output.json file
                        const jsonData = fs.readFileSync(outputJsonPath, 'utf8');
                        // Send the analysis data to the renderer for visualization (not main output)
                        sendToRenderer('analysis-complete', jsonData);
                        console.log('Python analysis completed successfully');
                    }
                    catch (jsonError) {
                        console.error('Error reading analysis results:', jsonError);
                    }
                }
                else {
                    console.log('Python analysis completed but no output.json found');
                }
            }
            else {
                console.error(`Python analysis failed with exit code: ${code}`);
            }
        });
        pythonProcess.on('error', (err) => {
            console.error('Python analysis process error:', err);
        });
    }
    catch (error) {
        console.error('Error setting up Python analysis:', error);
    }
}
// Handle code analysis and preprocessing
electron_1.ipcMain.handle('analyze-code', async (event, code) => {
    let tempDir = '';
    try {
        const timestamp = Date.now();
        tempDir = path.join(tmpDir, `analysis_${timestamp}`);
        // Create analysis directory
        try {
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
        }
        catch (dirError) {
            return `Directory creation error: ${dirError instanceof Error ? dirError.message : String(dirError)}`;
        }
        // Write code to temporary file
        const cppFile = path.join(tempDir, 'input.cpp');
        try {
            fs.writeFileSync(cppFile, code);
        }
        catch (writeError) {
            return `File write error: ${writeError instanceof Error ? writeError.message : String(writeError)}`;
        }
        // Run code preprocessor
        const preprocessorPath = path.join(__dirname, '..', '..', 'code_preprocessor.py');
        const blocksDir = path.join(tempDir, 'code_blocks');
        // Check if preprocessor exists
        if (!fs.existsSync(preprocessorPath)) {
            return `Preprocessor not found: ${preprocessorPath}`;
        }
        return await new Promise((resolve) => {
            let pythonProcess = null;
            let hasTimedOut = false;
            try {
                pythonProcess = (0, child_process_1.spawn)('python3', [preprocessorPath, cppFile, blocksDir], {
                    stdio: ['pipe', 'pipe', 'pipe'],
                    cwd: path.join(__dirname, '..', '..'),
                    timeout: 60000
                });
                // Set up timeout
                const timeoutId = setTimeout(() => {
                    hasTimedOut = true;
                    if (pythonProcess) {
                        pythonProcess.kill('SIGTERM');
                    }
                }, 60000);
                let output = '';
                let errorOutput = '';
                if (pythonProcess.stdout) {
                    pythonProcess.stdout.on('data', (data) => {
                        try {
                            output += data.toString();
                            // Send real-time updates
                            sendToRenderer('analysis-progress', data.toString());
                        }
                        catch (err) {
                            console.error('Error handling analysis stdout:', err);
                        }
                    });
                }
                if (pythonProcess.stderr) {
                    pythonProcess.stderr.on('data', (data) => {
                        errorOutput += data.toString();
                    });
                }
                pythonProcess.on('close', (code) => {
                    clearTimeout(timeoutId);
                    if (hasTimedOut) {
                        resolve('Analysis timeout: Process took longer than 60 seconds');
                        return;
                    }
                    if (code === 0) {
                        try {
                            // Check for analysis results
                            const analysisFile = path.join(blocksDir, 'analysis.json');
                            const summaryFile = path.join(blocksDir, 'blocks_summary.json');
                            if (fs.existsSync(analysisFile) && fs.existsSync(summaryFile)) {
                                const analysisData = fs.readFileSync(analysisFile, 'utf8');
                                const summaryData = fs.readFileSync(summaryFile, 'utf8');
                                // Send analysis complete event
                                sendToRenderer('code-analysis-complete', {
                                    analysis: JSON.parse(analysisData),
                                    summary: JSON.parse(summaryData),
                                    blocksDir: blocksDir
                                });
                                resolve(`Analysis completed successfully. Blocks saved to: ${blocksDir}`);
                            }
                            else {
                                resolve(`Analysis completed with warnings: ${output || 'No output'}`);
                            }
                        }
                        catch (resultError) {
                            resolve(`Analysis result processing error: ${resultError instanceof Error ? resultError.message : String(resultError)}`);
                        }
                    }
                    else {
                        resolve(`Analysis failed (exit code ${code}): ${errorOutput || output || 'Unknown error'}`);
                    }
                });
                pythonProcess.on('error', (err) => {
                    clearTimeout(timeoutId);
                    resolve(`Analysis process error: ${err.message}`);
                });
            }
            catch (spawnError) {
                resolve(`Failed to start analysis: ${spawnError instanceof Error ? spawnError.message : String(spawnError)}`);
            }
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Analyze-code error:', error);
        return `Analysis error: ${errorMessage}`;
    }
});
//# sourceMappingURL=main.js.map