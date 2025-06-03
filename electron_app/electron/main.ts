import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { exec, spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';

// Create temporary directory for compilation
const tmpDir = path.join(os.tmpdir(), 'cpp-visualizer');
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

// Store the currently running process
let currentProcess: ChildProcess | null = null;
let mainWindow: BrowserWindow | null = null;
// Track if the process is waiting for input
let inputMode = false;

// Function to clean up resources
const cleanupResources = (tempFile: string, outputFile: string) => {
  try {
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
  } catch (e) {
    console.error('Failed to delete temp files', e);
  }
};

const createWindow = () => {
  const win = new BrowserWindow({
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
    win.loadURL('http://localhost:5173'); // Updated port to match the running server
    // win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
};

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});



// Handle C++ compilation and execution
ipcMain.handle('compile-cpp', async (event, code: string) => {
  try {
    // Kill any existing process
    if (currentProcess) {
      currentProcess.kill();
      currentProcess = null;
    }

    // Create file paths
    const tempFile = path.join(tmpDir, 'temp.cpp');
    const outputFile = path.join(tmpDir, `output${process.platform === 'win32' ? '.exe' : ''}`);
    
    // Write code to temporary file
    fs.writeFileSync(tempFile, code);
    
    // Compile the code first
    return await new Promise<string>((resolve) => {
      const compiler = process.platform === 'win32' ? 'g++' : 'g++';
      const compileCommand = `${compiler} -o "${outputFile}" "${tempFile}"`;
      
      exec(compileCommand, (compileError, compileStdout, compileStderr) => {
        // If compilation failed
        if (compileError) {
          cleanupResources(tempFile, outputFile);
          return resolve(`Compilation Error:\n${compileStderr || compileError.message}`);
        }
        
        // Run the compiled executable using spawn instead of exec
        const execPath = process.platform === 'win32' ? outputFile : outputFile;
        
        // Use spawn to get access to stdin, stdout, stderr streams
        currentProcess = spawn(execPath, [], { stdio: ['pipe', 'pipe', 'pipe'] });
        
        let outputData = 'Program Output:\n';
        
        // Set up stdout handler
        if (currentProcess.stdout) {
          currentProcess.stdout.on('data', (data) => {
            const output = data.toString();
            outputData += output;
            
            // Check if the program is waiting for input
            // Common patterns: ends with ':', '?', or no newline after prompt
            const endsWithoutNewline = output.length > 0 && 
                                      !output.endsWith('\n') && 
                                      !output.endsWith('\r\n') &&
                                      output.trim().length > 0;
            
            // Check if this looks like an input prompt
            if (endsWithoutNewline) {
              // Set input mode to true to indicate we're waiting for input
              inputMode = true;
              
              // Notify the renderer process that we're waiting for input
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('input-required');
              }
            }
            
            // Send real-time output to the renderer
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('program-output', output);
            }
          });
        }
        
        // Set up stderr handler
        if (currentProcess.stderr) {
          currentProcess.stderr.on('data', (data) => {
            const output = data.toString();
            outputData += `Error: ${output}`;
            
            // Send real-time error output to the renderer
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('program-output', `Error: ${output}`);
            }
          });
        }
        
        // Handle process completion
        currentProcess.on('close', (exitCode) => {
          currentProcess = null;
          cleanupResources(tempFile, outputFile);
          
          // Send process completion event to the renderer
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('program-finished', exitCode);
          }
          
          // After C++ execution completes, run Python analysis
          runPythonAnalysis(tempFile, code);
          
          // Resolve the promise with the complete output
          resolve(outputData);
        });
        
        // Handle potential errors
        currentProcess.on('error', (err) => {
          currentProcess = null;
          cleanupResources(tempFile, outputFile);
          resolve(`Runtime Error: ${err.message}`);
        });
      });
    });
  } catch (error) {
    return `System Error: ${error instanceof Error ? error.message : String(error)}`;
  }
});

// Handle sending input to the running process
ipcMain.on('send-program-input', (_, input: string) => {
  if (currentProcess && currentProcess.stdin) {
    // Echo the input back to the terminal with a newline
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('program-output', input + '\r\n');
    }
    
    // Write input to stdin of the running process
    currentProcess.stdin.write(input + '\n');
    
    // Reset input mode to false after sending input
    inputMode = false;
  }
});

// Add a handler for checking input mode status
ipcMain.handle('check-input-mode', () => {
  return inputMode;
});

// Handle killing the currently running process
ipcMain.on('kill-running-process', () => {
  if (currentProcess) {
    currentProcess.kill();
    currentProcess = null;
  }
});

// Handle Python script execution
ipcMain.handle('run-python', async (event, scriptPath: string) => {
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
      fullScriptPath = path.join(app.getAppPath(), '..', scriptPath);
    }
    
    console.log(`Executing Python script: ${fullScriptPath}`);
    
    // Run the Python script using spawn with unbuffered mode
    // Set cwd to the script directory to ensure relative imports work
    // The -u flag ensures Python doesn't buffer stdout/stderr
    currentProcess = spawn('python3', ['-u', fullScriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false, // Don't use shell to avoid additional buffering
      cwd: path.dirname(fullScriptPath)
    });
    
    // Reset input mode
    inputMode = false;
    
    // Send the initial command to the terminal
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('program-output', `> python3 ${fullScriptPath}\r\n`);
    }

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
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('input-required');
          }
        }
        
        // Send real-time output to the renderer
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('program-output', output);
        }
      });
    }

    // Set up stderr handler
    if (currentProcess.stderr) {
      currentProcess.stderr.on('data', (data) => {
        const output = data.toString();
        outputData += `Error: ${output}`;
        
        // Send real-time error output to the renderer
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('program-output', `Error: ${output}`);
        }
      });
    }

    // Handle process completion
    currentProcess.on('close', (code) => {
      currentProcess = null;
      
      // Reset input mode
      inputMode = false;
      
      // Send process completion event to the renderer
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('program-finished', code);
      }
    });

    // Handle potential errors
    currentProcess.on('error', (err) => {
      currentProcess = null;
      return `Runtime Error: ${err.message}`;
    });

    return outputData;
  } catch (error) {
    return `System Error: ${error instanceof Error ? error.message : String(error)}`;
  }
});

// Function to run Python analysis after C++ execution
async function runPythonAnalysis(cppFilePath: string, cppCode: string) {
  try {
    // Look for Python analysis scripts in the root directory
    const rootDir = path.join(__dirname, '..', '..');
    const lexerPath = path.join(rootDir, 'mylexer.py');
    const parserPath = path.join(rootDir, 'myparser.py');
    
    // Check which script exists
    let scriptPath = '';
    if (fs.existsSync(lexerPath)) {
      scriptPath = lexerPath;
    } else if (fs.existsSync(parserPath)) {
      scriptPath = parserPath;
    } else {
      console.log('No Python analysis script found');
      return;
    }
    
    console.log(`Running Python analysis: ${scriptPath}`);
    
    // Run the Python script with the C++ file as input
    const pythonProcess = spawn('python3', [scriptPath, cppFilePath], {
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
          // Read the output.json file
          const jsonData = fs.readFileSync(outputJsonPath, 'utf8');
          
          // Send the analysis data to the renderer for visualization
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('analysis-complete', jsonData);
          }
        }
      } else {
        console.error(`Python analysis failed with exit code: ${code}`);
      }
    });
  } catch (error) {
    console.error('Error running Python analysis:', error);
  }
}
