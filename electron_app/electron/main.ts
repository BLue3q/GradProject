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

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
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
    // Create file paths
    const tempFile = path.join(tmpDir, 'temp.cpp');
    const outputFile = path.join(tmpDir, `output${process.platform === 'win32' ? '.exe' : ''}`);
    
    // Write code to temporary file
    fs.writeFileSync(tempFile, code);
    
    // Compile and run the code
    return await new Promise<string>((resolve) => {
      // First compile the code
      const compiler = process.platform === 'win32' ? 'g++' : 'g++';
      const compileCommand = `${compiler} -o "${outputFile}" "${tempFile}"`;
      
      exec(compileCommand, (compileError, compileStdout, compileStderr) => {
        // If compilation failed
        if (compileError) {
          // Clean up temp file
          try {
            fs.unlinkSync(tempFile);
          } catch (e) {
            console.error('Failed to delete temp file', e);
          }
          
          return resolve(`Compilation Error:\n${compileStderr || compileError.message}`);
        }
        
        // Run the compiled executable
        const runCommand = process.platform === 'win32' ? `"${outputFile}"` : `"${outputFile}"`;
        
        exec(runCommand, (runError, runStdout, runStderr) => {
          // Clean up temp files
          try {
            fs.unlinkSync(tempFile);
            fs.unlinkSync(outputFile);
          } catch (e) {
            console.error('Failed to delete temp files', e);
          }
          
          if (runError) {
            return resolve(`Runtime Error:\n${runStderr || runError.message}`);
          }
          
          resolve(`Program Output:\n${runStdout}`);
        });
      });
    });
  } catch (error) {
    return `System Error: ${error instanceof Error ? error.message : String(error)}`;
  }
});
