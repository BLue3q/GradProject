const { exec } = require('child_process');
const path = require('path');

console.log('Building Electron scripts...');

// Build TypeScript files for main process
exec('npx tsc -p tsconfig.electron.json', (error, stdout, stderr) => {
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
  
  console.log('Electron scripts built successfully!');
}); 