const { exec } = require('child_process');
const path = require('path');

console.log('Building Electron application...');

// Build the application
exec('npx electron-builder', (error, stdout, stderr) => {
  if (error) {
    console.error(`Build error: ${error}`);
    process.exit(1);
  }
  
  if (stderr) {
    console.error(`Build stderr: ${stderr}`);
  }
  
  if (stdout) {
    console.log(stdout);
  }
  
  console.log('Electron application built successfully!');
}); 