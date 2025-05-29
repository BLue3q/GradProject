import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';

// Create temporary directory for compilation
const tmpDir = path.join(os.tmpdir(), 'cpp-visualizer');
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

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

  // Add a debug log to confirm the environment and URL being loaded
  console.log('Environment:', process.env.NODE_ENV);
  console.log('Loading URL:', process.env.NODE_ENV === 'development' ? 'http://localhost:5173' : path.join(__dirname, '../dist/index.html'));

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173');
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
ipcMain.handle('compile-cpp', async (_, code: string) => {
  try {
    const tempFile = path.join(tmpDir, 'temp.cpp');
    const outputFile = path.join(tmpDir, `output${process.platform === 'win32' ? '.exe' : ''}`);
    
    fs.writeFileSync(tempFile, code);
    
    return await new Promise<string>((resolve) => {
      const compiler = process.platform === 'win32' ? 'g++' : 'g++';
      const compileCommand = `${compiler} -o "${outputFile}" "${tempFile}"`;
      
      exec(compileCommand, (compileError, compileStdout, compileStderr) => {
        if (compileError) {
          try {
            fs.unlinkSync(tempFile);
          } catch (e) {
            console.error('Failed to delete temp file', e);
          }
          return resolve(`Compilation Error:\n${compileStderr || compileError.message}`);
        }
        
        // Use spawn instead of exec to handle interactive input/output
        const { spawn } = require('child_process');
        const child = spawn(outputFile, [], {
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let output = '';
        let isWaitingForInput = false;

        child.stdout.on('data', (data) => {
          output += data.toString();
          if (output.includes('enter your name:')) {
            isWaitingForInput = true;
            resolve(`${output}\nWaiting for input...`);
          }
        });

        child.stderr.on('data', (data) => {
          output += `Error: ${data}`;
        });

        child.on('close', (code) => {
          if (!isWaitingForInput) {
            resolve(output);
          }
        });

        // Kill the process after a timeout (optional)
        setTimeout(() => {
          if (!child.killed) {
            child.kill();
            resolve('Process timed out');
          }
        }, 10000); // 10 second timeout
      });
    });
  } catch (error) {
    return `System Error: ${error instanceof Error ? error.message : String(error)}`;
  }
});
