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
// Helper function for resource path handling
const getResourcePath = (...segments) => {
    return process.env.NODE_ENV === 'production'
        ? path.join(process.resourcesPath, ...segments)
        : path.join(__dirname, '..', ...segments);
};
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
// Global debugging state
let debuggerProcess = null;
let isDebugging = false;
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
        const tryPorts = [5173, 5174, 5175, 5176, 5177, 5178, 5179, 5180, 5181, 5182, 5183, 5184, 5185, 5186, 5187, 5188, 5189];
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
// New IPC handler for parsing code and generating visualization data
electron_1.ipcMain.handle('parse-code', async (event, code) => {
    try {
        console.log('🔄 Starting code parsing...');
        // Create temporary file for code
        const timestamp = Date.now();
        const tempDir = path.join(tmpDir, `parse_${timestamp}`);
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        const cppFile = path.join(tempDir, 'input.cpp');
        fs.writeFileSync(cppFile, code);
        // Path to Python parser
        const parserPath = getResourcePath('backend', 'myparser.py');
        if (!fs.existsSync(parserPath)) {
            throw new Error(`Parser not found at: ${parserPath}`);
        }
        // Path for output JSON
        const dataJsonPath = getResourcePath('data', 'data.json');
        console.log(`📦 Running Python parser: ${parserPath}`);
        console.log(`💾 Output will be saved to: ${dataJsonPath}`);
        return new Promise((resolve) => {
            const pythonProcess = (0, child_process_1.spawn)('python3', [parserPath, cppFile], {
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: getResourcePath()
            });
            let output = '';
            let errorOutput = '';
            pythonProcess.stdout.on('data', (data) => {
                output += data.toString();
                console.log('Parser output:', data.toString());
            });
            pythonProcess.stderr.on('data', (data) => {
                errorOutput += data.toString();
                console.error('Parser error:', data.toString());
            });
            pythonProcess.on('close', (code) => {
                if (code === 0) {
                    try {
                        // Check if parser created output.json in current directory
                        const possibleOutputPaths = [
                            path.join(getResourcePath(), 'output.json'),
                            path.join(getResourcePath(), 'data', 'output.json'),
                            path.join(process.cwd(), 'output.json')
                        ];
                        let foundOutputPath = '';
                        for (const outputPath of possibleOutputPaths) {
                            if (fs.existsSync(outputPath)) {
                                foundOutputPath = outputPath;
                                break;
                            }
                        }
                        if (foundOutputPath) {
                            // Read the generated JSON and copy it to data/data.json
                            const jsonData = fs.readFileSync(foundOutputPath, 'utf8');
                            // Ensure data directory exists
                            const dataDir = getResourcePath('data');
                            if (!fs.existsSync(dataDir)) {
                                fs.mkdirSync(dataDir, { recursive: true });
                            }
                            // Write to data.json
                            fs.writeFileSync(dataJsonPath, jsonData);
                            console.log('✅ Parser completed successfully');
                            sendToRenderer('parse-complete', { dataPath: dataJsonPath });
                            resolve({
                                success: true,
                                message: 'Code parsed successfully',
                                dataPath: dataJsonPath
                            });
                        }
                        else {
                            resolve({
                                success: false,
                                message: `Parser completed but no output file found. Checked: ${possibleOutputPaths.join(', ')}`
                            });
                        }
                    }
                    catch (error) {
                        resolve({
                            success: false,
                            message: `Error processing parser output: ${error instanceof Error ? error.message : String(error)}`
                        });
                    }
                }
                else {
                    resolve({
                        success: false,
                        message: `Parser failed with exit code ${code}: ${errorOutput || output || 'Unknown error'}`
                    });
                }
            });
            pythonProcess.on('error', (err) => {
                resolve({
                    success: false,
                    message: `Failed to start parser: ${err.message}`
                });
            });
        });
    }
    catch (error) {
        return {
            success: false,
            message: `Parse code error: ${error instanceof Error ? error.message : String(error)}`
        };
    }
});
// Handle C++ compilation and execution
electron_1.ipcMain.handle('compile-cpp', async (event, code) => {
    // Clear any existing output before starting
    sendToRenderer('program-output', '');
    try {
        // Clean up any existing process
        cleanupProcess();
        // Create a temporary file for the C++ code
        const tempDir = path.join(os.tmpdir(), 'cpp-visualizer');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        // Preprocess the code first
        const preprocessorPath = getResourcePath('backend', 'code_preprocessor_frontend.py');
        let processedCode = code;
        if (fs.existsSync(preprocessorPath)) {
            try {
                // Run the preprocessor on the code
                const preprocessorProcess = (0, child_process_1.spawn)('python3', [preprocessorPath, '--string', code], {
                    stdio: ['pipe', 'pipe', 'pipe']
                });
                let preprocessorOutput = '';
                let preprocessorError = '';
                preprocessorProcess.stdout.on('data', (data) => {
                    preprocessorOutput += data.toString();
                });
                preprocessorProcess.stderr.on('data', (data) => {
                    preprocessorError += data.toString();
                });
                await new Promise((resolve) => {
                    preprocessorProcess.on('close', (code) => {
                        if (code === 0 && preprocessorOutput) {
                            // Extract the processed code from the output
                            const match = preprocessorOutput.match(/=== PREPROCESSED CODE ===([\s\S]*?)=== END PREPROCESSED CODE ===/);
                            if (match) {
                                processedCode = match[1].trim();
                            }
                        }
                        resolve();
                    });
                });
            }
            catch (preprocessError) {
                // If preprocessing fails, use original code
                console.warn('Preprocessing failed, using original code:', preprocessError);
            }
        }
        const cppFile = path.join(tempDir, 'main.cpp');
        const exeFile = path.join(tempDir, process.platform === 'win32' ? 'main.exe' : 'main');
        // Write the processed code to the temporary file
        fs.writeFileSync(cppFile, processedCode);
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
            let compileOutput = '';
            let compileError = '';
            // Capture compilation stdout
            compileProcess.stdout.on('data', (data) => {
                const output = data.toString();
                compileOutput += output;
                sendToRenderer('program-output', output);
            });
            // Capture compilation stderr
            compileProcess.stderr.on('data', (data) => {
                const output = data.toString();
                compileError += output;
                sendToRenderer('program-output', output);
            });
            compileProcess.on('close', (code) => {
                if (code === 0) {
                    // Compilation successful, now run the program
                    sendToRenderer('program-output', `\n=== Program Output ===\n`);
                    // Run the Python analysis in the background while executing the program
                    runPythonAnalysis(cppFile, processedCode);
                    runCompiledProgram(exeFile, resolve);
                }
                else {
                    resolve(`Compilation failed:\n${compileError || compileOutput}`);
                }
            });
            compileProcess.on('error', (err) => {
                resolve(`Compilation error: ${err.message}`);
            });
        });
    }
    catch (error) {
        return `System Error: ${error instanceof Error ? error.message : String(error)}`;
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
// Function to run compiled program
function runCompiledProgram(exeFile, resolve) {
    currentProcess = (0, child_process_1.spawn)(exeFile, [], {
        stdio: ['pipe', 'pipe', 'pipe']
    });
    let outputData = '';
    let hasOutput = false;
    // Handle stdout
    currentProcess.stdout?.on('data', (data) => {
        hasOutput = true;
        const output = data.toString();
        outputData += output;
        sendToRenderer('program-output', output);
    });
    // Handle stderr
    currentProcess.stderr?.on('data', (data) => {
        hasOutput = true;
        const output = data.toString();
        outputData += output;
        sendToRenderer('program-output', output);
    });
    // Handle program completion
    currentProcess.on('close', (exitCode) => {
        setTimeout(() => {
            if (!hasOutput && !outputData) {
                sendToRenderer('program-output', '[No output produced]\n');
            }
            sendToRenderer('program-finished', exitCode);
            currentProcess = null;
            resolve(outputData);
        }, 100);
    });
    // Handle potential errors
    currentProcess.on('error', (err) => {
        currentProcess = null;
        resolve(`Runtime Error: ${err.message}`);
    });
}
// Function to run Python analysis after C++ execution
async function runPythonAnalysis(cppFilePath, cppCode) {
    try {
        // Look for Python analysis scripts using the getResourcePath helper
        const parserPath = getResourcePath('backend', 'myparser.py');
        const lexerPath = getResourcePath('backend', 'mylexer.py');
        // Check which script exists
        let scriptPath = '';
        if (fs.existsSync(parserPath)) {
            scriptPath = parserPath;
        }
        else if (fs.existsSync(lexerPath)) {
            scriptPath = lexerPath;
        }
        else {
            console.log('No Python analysis script found - skipping analysis');
            return;
        }
        console.log(`Running background Python analysis: ${scriptPath}`);
        // Run the Python script with the C++ file as input
        const pythonProcess = (0, child_process_1.spawn)('python3', [scriptPath, cppFilePath], {
            stdio: ['pipe', 'pipe', 'pipe'],
            cwd: getResourcePath()
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
                // Check if output.json was created in various possible locations
                const possibleOutputPaths = [
                    getResourcePath('output.json'),
                    getResourcePath('data', 'output.json'),
                    path.join(process.cwd(), 'output.json')
                ];
                for (const outputJsonPath of possibleOutputPaths) {
                    if (fs.existsSync(outputJsonPath)) {
                        try {
                            // Read the output.json file
                            const jsonData = fs.readFileSync(outputJsonPath, 'utf8');
                            // Send the analysis data to the renderer for visualization
                            sendToRenderer('analysis-complete', jsonData);
                            console.log('Python analysis completed successfully');
                            return;
                        }
                        catch (jsonError) {
                            console.error('Error reading analysis results:', jsonError);
                        }
                    }
                }
                console.log('Python analysis completed but no output.json found');
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
        // Run code preprocessor using the correct path
        const preprocessorPath = getResourcePath('backend', 'code_preprocessor.py');
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
                    cwd: getResourcePath(),
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
// Handle GDB debugging
electron_1.ipcMain.handle('start-debugging', async (event, cppFileOrCode, breakpoints = []) => {
    try {
        console.log('Starting GDB debugging session...');
        sendToRenderer('program-output', 'Starting GDB debugging session...\n');
        // Clean up any existing debugging process
        if (debuggerProcess && !debuggerProcess.killed) {
            debuggerProcess.kill('SIGTERM');
            debuggerProcess = null;
        }
        let cppFile = cppFileOrCode;
        // If the input looks like code (not a file path), create a temporary file
        if (cppFileOrCode.includes('#include') || cppFileOrCode.includes('int main') || !fs.existsSync(cppFileOrCode)) {
            const tempDir = path.join(os.tmpdir(), 'cpp-visualizer');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            cppFile = path.join(tempDir, 'debug_temp.cpp');
            fs.writeFileSync(cppFile, cppFileOrCode);
            sendToRenderer('program-output', `Created temporary file: ${cppFile}\n`);
        }
        // Get the absolute path to the GDB debugger script
        const debuggerScript = getResourcePath('backend', 'gdb_debugger.py');
        // Check if the debugger script exists
        if (!fs.existsSync(debuggerScript)) {
            const errorMsg = `GDB debugger script not found: ${debuggerScript}`;
            sendToRenderer('program-output', `Error: ${errorMsg}\n`);
            return 'debugger-not-found';
        }
        // Check if the C++ file exists
        if (!fs.existsSync(cppFile)) {
            const errorMsg = `C++ file not found: ${cppFile}`;
            sendToRenderer('program-output', `Error: ${errorMsg}\n`);
            return 'cpp-file-not-found';
        }
        // Create breakpoints file if breakpoints are provided
        let breakpointsFile = '';
        if (breakpoints && breakpoints.length > 0) {
            const tempDir = path.join(os.tmpdir(), 'cpp-visualizer');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            breakpointsFile = path.join(tempDir, 'breakpoints.json');
            fs.writeFileSync(breakpointsFile, JSON.stringify(breakpoints, null, 2));
        }
        // Start the GDB debugger process
        const args = [debuggerScript, cppFile];
        if (breakpointsFile) {
            args.push(breakpointsFile);
        }
        debuggerProcess = (0, child_process_1.spawn)('python3', args, {
            cwd: getResourcePath(),
            stdio: ['pipe', 'pipe', 'pipe']
        });
        isDebugging = true;
        // Handle stdout from debugger
        debuggerProcess.stdout?.on('data', (data) => {
            const output = data.toString();
            sendToRenderer('debug-output', output);
        });
        // Handle stderr from debugger
        debuggerProcess.stderr?.on('data', (data) => {
            const output = data.toString();
            sendToRenderer('debug-error', output);
        });
        // Handle debugger process completion
        debuggerProcess.on('close', (code) => {
            console.log(`GDB debugger process finished with exit code: ${code}`);
            sendToRenderer('debug-session-ended', code);
            debuggerProcess = null;
            isDebugging = false;
        });
        // Handle debugger process errors
        debuggerProcess.on('error', (err) => {
            console.error('GDB debugger process error:', err);
            sendToRenderer('debug-error', `Debugger Error: ${err.message}`);
            debuggerProcess = null;
            isDebugging = false;
        });
        return 'debugging-started';
    }
    catch (error) {
        console.error('Error starting debugging:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        sendToRenderer('program-output', `\n[System] Debugging Error: ${errorMessage}\n`);
        return 'debugging-failed';
    }
});
// Handle stopping debugging
electron_1.ipcMain.on('stop-debugging', () => {
    if (debuggerProcess && !debuggerProcess.killed) {
        debuggerProcess.kill('SIGTERM');
        debuggerProcess = null;
        isDebugging = false;
        sendToRenderer('debug-output', 'Debugging session stopped by user\n');
    }
});
// Debug control commands
electron_1.ipcMain.on('debug-step-over', () => {
    if (debuggerProcess && isDebugging) {
        debuggerProcess.stdin?.write('step\n');
    }
});
electron_1.ipcMain.on('debug-step-into', () => {
    if (debuggerProcess && isDebugging) {
        debuggerProcess.stdin?.write('stepi\n');
    }
});
electron_1.ipcMain.on('debug-step-out', () => {
    if (debuggerProcess && isDebugging) {
        debuggerProcess.stdin?.write('finish\n');
    }
});
electron_1.ipcMain.on('debug-continue', () => {
    if (debuggerProcess && isDebugging) {
        debuggerProcess.stdin?.write('continue\n');
    }
});
electron_1.ipcMain.on('debug-run', () => {
    if (debuggerProcess && isDebugging) {
        debuggerProcess.stdin?.write('run\n');
    }
});
// Breakpoint management
electron_1.ipcMain.handle('set-breakpoint', async (event, file, line) => {
    if (debuggerProcess && isDebugging) {
        debuggerProcess.stdin?.write(`break ${file}:${line}\n`);
        return `Breakpoint set at ${file}:${line}`;
    }
    return 'No debugging session active';
});
electron_1.ipcMain.handle('remove-breakpoint', async (event, breakpointId) => {
    if (debuggerProcess && isDebugging) {
        debuggerProcess.stdin?.write(`delete ${breakpointId}\n`);
        return `Breakpoint ${breakpointId} removed`;
    }
    return 'No debugging session active';
});
// Expression evaluation
electron_1.ipcMain.handle('evaluate-expression', async (event, expression) => {
    if (debuggerProcess && isDebugging) {
        debuggerProcess.stdin?.write(`print ${expression}\n`);
        return `Evaluating: ${expression}`;
    }
    return 'No debugging session active';
});
// Send custom debug command
electron_1.ipcMain.on('debug-command', (event, command) => {
    if (debuggerProcess && isDebugging) {
        debuggerProcess.stdin?.write(`${command}\n`);
    }
});
// Handle Java blocks compilation
electron_1.ipcMain.handle('compile-blocks', async (event, blocksDir) => {
    try {
        console.log('Starting Java blocks compilation...');
        sendToRenderer('program-output', 'Starting Java blocks compilation...\n');
        // Get the absolute path to the Java compiler runner script
        const compilerScript = getResourcePath('backend', 'java_compiler_runner.py');
        // Check if the compiler script exists
        if (!fs.existsSync(compilerScript)) {
            const errorMsg = `Java compiler script not found: ${compilerScript}`;
            sendToRenderer('program-output', `Error: ${errorMsg}\n`);
            return 'compiler-not-found';
        }
        // Check if the blocks directory exists
        if (!fs.existsSync(blocksDir)) {
            const errorMsg = `Blocks directory not found: ${blocksDir}`;
            sendToRenderer('program-output', `Error: ${errorMsg}\n`);
            return 'blocks-dir-not-found';
        }
        return new Promise((resolve) => {
            // Start the Java compiler runner process
            const compilerProcess = (0, child_process_1.spawn)('python3', [compilerScript, blocksDir], {
                cwd: getResourcePath(),
                stdio: ['pipe', 'pipe', 'pipe']
            });
            let outputData = '';
            let errorData = '';
            // Handle stdout from compiler
            compilerProcess.stdout?.on('data', (data) => {
                const output = data.toString();
                outputData += output;
                sendToRenderer('program-output', output);
            });
            // Handle stderr from compiler
            compilerProcess.stderr?.on('data', (data) => {
                const output = data.toString();
                errorData += output;
                sendToRenderer('program-output', `[Compiler Error] ${output}`);
            });
            // Handle compiler process completion
            compilerProcess.on('close', (code) => {
                console.log(`Java compiler process finished with exit code: ${code}`);
                if (code === 0) {
                    sendToRenderer('program-output', '\n--- Compilation completed successfully ---\n');
                    // Check for compilation results file
                    const resultsFile = path.join(blocksDir, 'compilation_results.json');
                    if (fs.existsSync(resultsFile)) {
                        try {
                            const results = fs.readFileSync(resultsFile, 'utf8');
                            sendToRenderer('compilation-complete', JSON.parse(results));
                        }
                        catch (err) {
                            console.error('Error reading compilation results:', err);
                        }
                    }
                    resolve('compilation-successful');
                }
                else {
                    sendToRenderer('program-output', `\n--- Compilation failed with exit code: ${code} ---\n`);
                    resolve('compilation-failed');
                }
            });
            // Handle compiler process errors
            compilerProcess.on('error', (err) => {
                console.error('Java compiler process error:', err);
                sendToRenderer('program-output', `\n[System] Compiler Error: ${err.message}\n`);
                resolve('compilation-error');
            });
            // Set up timeout for compilation (5 minutes)
            const compilationTimeout = setTimeout(() => {
                compilerProcess.kill('SIGTERM');
                sendToRenderer('program-output', `\n[System] Compilation terminated due to timeout (5 minutes)\n`);
                resolve('compilation-timeout');
            }, 300000);
            // Clear timeout when process completes
            compilerProcess.on('close', () => {
                clearTimeout(compilationTimeout);
            });
        });
    }
    catch (error) {
        console.error('Error starting compilation:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        sendToRenderer('program-output', `\n[System] Compilation Error: ${errorMessage}\n`);
        return 'compilation-system-error';
    }
});
// Handle save-and-process pipeline
electron_1.ipcMain.handle('save-and-process', async (event, code) => {
    try {
        console.log('🔄 Starting save-and-process pipeline...');
        const backendDir = getResourcePath('backend');
        const testedCodeFile = path.join(backendDir, 'tested_code.txt');
        const outputJsonFile = path.join(backendDir, 'output.json');
        const testerScript = path.join(backendDir, 'tester_code.py');
        const preprocessorScript = path.join(backendDir, 'code_preprocessor.py');
        // Step 1: Clean code by removing cout statements and save to tested_code.txt
        console.log('📝 Cleaning code and saving to tested_code.txt...');
        // **AUTO-REMOVE COUT STATEMENTS**: Clean up output statements that break parsing
        const cleanCode = (originalCode) => {
            console.log('🧹 Removing cout statements for better parsing...');
            let cleaned = originalCode;
            // **PRECISE COUT REMOVAL**: Only remove complete cout statements, preserve other tokens
            // Remove simple cout statements (more precise patterns)
            cleaned = cleaned.replace(/^\s*std::cout\s*<<[^;]*;\s*$/gm, '');
            cleaned = cleaned.replace(/^\s*cout\s*<<[^;]*;\s*$/gm, '');
            // Remove cout with endl (more precise)
            cleaned = cleaned.replace(/^\s*std::cout\s*<<.*?<<\s*std::endl\s*;\s*$/gm, '');
            cleaned = cleaned.replace(/^\s*cout\s*<<.*?<<\s*endl\s*;\s*$/gm, '');
            // Remove standalone printf statements too
            cleaned = cleaned.replace(/^\s*printf\s*\([^)]*\)\s*;\s*$/gm, '');
            // **SAFER APPROACH**: Comment out instead of deleting to preserve line structure
            // This prevents token mangling issues
            cleaned = cleaned.replace(/^(\s*)(std::cout|cout)(\s*<<[^;]*;)(.*)$/gm, '$1// $2$3 // Auto-commented for parsing$4');
            // Remove excessive blank lines
            cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n');
            // Add comment to indicate cleaning
            const cleaningNote = '// Note: cout statements removed for parsing optimization\n';
            if (!cleaned.includes('// Note: cout statements removed')) {
                cleaned = cleaningNote + cleaned;
            }
            console.log(`🧹 Cleaned code: ${originalCode.length - cleaned.length} characters removed/commented`);
            return cleaned;
        };
        const cleanedCode = cleanCode(code);
        fs.writeFileSync(testedCodeFile, cleanedCode);
        sendToRenderer('program-output', `✅ Cleaned code saved to ${testedCodeFile}\n`);
        // Step 2: Run tester_code.py
        console.log('🔄 Running tester_code.py...');
        sendToRenderer('program-output', '🔄 Running parser (tester_code.py)...\n');
        const testerResult = await new Promise((resolve) => {
            const testerProcess = (0, child_process_1.spawn)('python3', [testerScript], {
                cwd: backendDir,
                stdio: ['pipe', 'pipe', 'pipe']
            });
            let testerOutput = '';
            let testerError = '';
            testerProcess.stdout?.on('data', (data) => {
                const output = data.toString();
                testerOutput += output;
                sendToRenderer('program-output', output);
            });
            testerProcess.stderr?.on('data', (data) => {
                const output = data.toString();
                testerError += output;
                sendToRenderer('program-output', `[Parser Error] ${output}`);
            });
            testerProcess.on('close', (code) => {
                if (code === 0) {
                    sendToRenderer('program-output', '✅ Parser completed successfully\n');
                    resolve(true);
                }
                else {
                    sendToRenderer('program-output', `❌ Parser failed with exit code: ${code}\n`);
                    resolve(false);
                }
            });
            testerProcess.on('error', (err) => {
                sendToRenderer('program-output', `❌ Parser process error: ${err.message}\n`);
                resolve(false);
            });
        });
        if (!testerResult) {
            return { success: false, message: 'Parser (tester_code.py) failed' };
        }
        // Check if output.json was created
        if (!fs.existsSync(outputJsonFile)) {
            return { success: false, message: 'output.json was not created by parser' };
        }
        // Step 3: Run code_preprocessor.py to process output.json
        console.log('🔄 Running code_preprocessor.py for block detection...');
        sendToRenderer('program-output', '🔄 Running block detection (code_preprocessor.py)...\n');
        const preprocessorResult = await new Promise((resolve) => {
            // Use the new pipeline method
            const preprocessorProcess = (0, child_process_1.spawn)('python3', ['-c', `
import sys
sys.path.append('.')
from code_preprocessor import CodeBlockPreprocessor

preprocessor = CodeBlockPreprocessor('code_blocks')
success = preprocessor.process_output_json_pipeline('output.json')
sys.exit(0 if success else 1)
`], {
                cwd: backendDir,
                stdio: ['pipe', 'pipe', 'pipe']
            });
            let preprocessorOutput = '';
            let preprocessorError = '';
            preprocessorProcess.stdout?.on('data', (data) => {
                const output = data.toString();
                preprocessorOutput += output;
                sendToRenderer('program-output', output);
            });
            preprocessorProcess.stderr?.on('data', (data) => {
                const output = data.toString();
                preprocessorError += output;
                sendToRenderer('program-output', `[Preprocessor Error] ${output}`);
            });
            preprocessorProcess.on('close', (code) => {
                if (code === 0) {
                    sendToRenderer('program-output', '✅ Block detection completed successfully\n');
                    resolve(true);
                }
                else {
                    sendToRenderer('program-output', `❌ Block detection failed with exit code: ${code}\n`);
                    resolve(false);
                }
            });
            preprocessorProcess.on('error', (err) => {
                sendToRenderer('program-output', `❌ Preprocessor process error: ${err.message}\n`);
                resolve(false);
            });
        });
        if (!preprocessorResult) {
            return { success: false, message: 'Block detection (code_preprocessor.py) failed' };
        }
        // Step 4: Load and send the results
        const analysisJsonFile = path.join(backendDir, 'code_blocks', 'analysis.json');
        if (fs.existsSync(analysisJsonFile)) {
            try {
                const analysisData = JSON.parse(fs.readFileSync(analysisJsonFile, 'utf8'));
                // Send analysis complete event
                sendToRenderer('analysis-complete', JSON.stringify(analysisData));
                sendToRenderer('program-output', '🎯 Pipeline completed! Analysis data sent to frontend.\n');
                return {
                    success: true,
                    message: 'Save-and-process pipeline completed successfully',
                    dataPath: analysisJsonFile
                };
            }
            catch (parseError) {
                return { success: false, message: `Failed to parse analysis results: ${parseError}` };
            }
        }
        else {
            return { success: false, message: 'Analysis results file not found' };
        }
    }
    catch (error) {
        console.error('Error in save-and-process pipeline:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        sendToRenderer('program-output', `❌ Pipeline Error: ${errorMessage}\n`);
        return { success: false, message: errorMessage };
    }
});
//# sourceMappingURL=main.js.map