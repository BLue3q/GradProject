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
    // Add a debug log to confirm the environment and URL being loaded
    console.log('Environment:', process.env.NODE_ENV);
    console.log('Loading URL:', process.env.NODE_ENV === 'development' ? 'http://localhost:5173' : path.join(__dirname, '../dist/index.html'));
    if (process.env.NODE_ENV === 'development') {
        win.loadURL('http://localhost:5173');
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
electron_1.ipcMain.handle('compile-cpp', async (_, code) => {
    try {
        const tempFile = path.join(tmpDir, 'temp.cpp');
        const outputFile = path.join(tmpDir, `output${process.platform === 'win32' ? '.exe' : ''}`);
        fs.writeFileSync(tempFile, code);
        return await new Promise((resolve) => {
            const compiler = process.platform === 'win32' ? 'g++' : 'g++';
            const compileCommand = `${compiler} -o "${outputFile}" "${tempFile}"`;
            (0, child_process_1.exec)(compileCommand, (compileError, compileStdout, compileStderr) => {
                if (compileError) {
                    try {
                        fs.unlinkSync(tempFile);
                    }
                    catch (e) {
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
    }
    catch (error) {
        return `System Error: ${error instanceof Error ? error.message : String(error)}`;
    }
});
//# sourceMappingURL=main.js.map