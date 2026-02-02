#!/usr/bin/env node

/**
 * Ultra-robust startup script for AI Saham server
 * Handles port binding and syntax validation
 */

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const net = require('net');

// Get the server directory path
const serverDir = path.join(__dirname, '..');

// Function to execute command with promise
function execPromise(command) {
  return new Promise((resolve, reject) => {
    console.log(`🔍 Executing: ${command}`);
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.log(`⚠️ Command failed: ${command} - ${error.message}`);
        resolve({ error, stdout: stdout || '', stderr: stderr || '' });
      } else {
        console.log(`✅ Command success: ${command}`);
        resolve({ error: null, stdout: stdout || '', stderr: stderr || '' });
      }
    });
  });
}

// Function to kill processes on a specific port
async function killPort(port) {
  console.log(`🔍 Checking for processes on port ${port}...`);

  if (process.platform === 'win32') {
    try {
      // Windows MINGW64: Use netstat to find PIDs and kill Node processes
      console.log(`🔍 Finding Node processes on port ${port}...`);
      const result = await execPromise(`netstat -ano | findstr :${port}`);

      if (result.stdout) {
        const lines = result.stdout.split('\n').filter(line => line.includes(`:${port}`));
        const pids = [];

        lines.forEach(line => {
          const match = line.match(/\s+(\d+)\s*$/);
          if (match && match[1] && match[1] !== '0') {
            pids.push(match[1]);
          }
        });

        if (pids.length > 0) {
          console.log(`🛑 Killing Node processes on port ${port}: ${pids.join(', ')}`);
          for (const pid of pids) {
            try {
              // Verify process exists before killing
              await execPromise(`tasklist /FI "PID eq ${pid}" /NH`);
              await execPromise(`taskkill /F /PID ${pid}`);
              console.log(`✅ Killed PID: ${pid}`);
            } catch (error) {
              console.log(`⚠️ Could not kill PID ${pid}: ${error.message}`);
            }
          }
        } else {
          console.log(`✅ No processes found on port ${port}`);
        }
      } else {
        console.log(`✅ No processes found on port ${port}`);
      }
    } catch (error) {
      console.log(`⚠️ Error checking port ${port}: ${error.message}`);
    }
  } else {
    // Unix-like: Use fuser or lsof
    try {
      await execPromise(`fuser -k ${port}/tcp`);
      console.log(`✅ Killed processes on port ${port}`);
    } catch (error) {
      console.log(`⚠️ No processes found on port ${port} or fuser not available`);
    }
  }
}

// Function to check port availability with net.bind test
function checkPortAvailability(port) {
  return new Promise((resolve) => {
    console.log(`🔍 Testing port ${port} availability...`);

    const server = net.createServer();

    server.listen(port, () => {
      console.log(`✅ Port ${port} bound success`);
      server.once('close', () => resolve(true));
      server.close();
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.log(`⚠️ Port ${port} is in use`);
        resolve(false);
      } else {
        console.log(`⚠️ Port ${port} test failed: ${error.message}`);
        resolve(false);
      }
    });
  });
}

// Function to validate server.js syntax
async function validateServerSyntax() {
  console.log('🔍 Validating server.js syntax...');

  return new Promise((resolve) => {
    const serverPath = path.join(__dirname, '..', 'server.js');

    // Use Node.js syntax check
    const nodeCheck = spawn('node', ['-c', serverPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    nodeCheck.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    nodeCheck.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    nodeCheck.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Server syntax validation passed');
        resolve(true);
      } else {
        console.error('❌ Syntax error in server.js:');
        console.error(stderr || stdout);
        console.error('💡 Manual fix needed in server.js');
        resolve(false);
      }
    });

    nodeCheck.on('error', (error) => {
      console.error('❌ Error running syntax check:', error.message);
      resolve(false);
    });
  });
}

// Function to check for duplicate declarations
function checkDuplicateDeclarations() {
  console.log('🔍 Checking for duplicate declarations...');

  try {
    const serverPath = path.join(__dirname, '..', 'server.js');
    const content = fs.readFileSync(serverPath, 'utf8');

    // Check for duplicate stocksRouter declarations
    const stocksRouterMatches = content.match(/stocksRouter/g);
    if (stocksRouterMatches && stocksRouterMatches.length > 2) {
      console.warn('⚠️ Warning: Multiple stocksRouter references detected');
    }

    // Check for duplicate const declarations
    const constMatches = content.match(/const stocksRouter/g);
    if (constMatches && constMatches.length > 1) {
      console.error('❌ Error: Multiple const stocksRouter declarations found!');
      return false;
    }

    console.log('✅ No duplicate declarations found');
    return true;

  } catch (error) {
    console.error('❌ Error checking declarations:', error.message);
    return false;
  }
}

// Main startup function
async function startServer() {
  console.log('🚀 Starting AI Saham server with OpenBB integration...');

  try {
    // Step 1: Validate server syntax
    console.log('📋 Step 1: Validating server syntax...');
    const syntaxValid = await validateServerSyntax();
    if (!syntaxValid) {
      console.error('❌ Server syntax validation failed, aborting startup');
      process.exit(1);
    }

    // Step 2: Check for duplicate declarations
    console.log('📋 Step 2: Checking for duplicate declarations...');
    const noDuplicates = checkDuplicateDeclarations();
    if (!noDuplicates) {
      console.error('❌ Duplicate declarations found, aborting startup');
      process.exit(1);
    }

    // Step 3: Check port availability and kill if needed
    console.log('📋 Step 3: Checking port availability...');
    let port = 5000;

    for (let attempt = 0; attempt < 5; attempt++) {
      const portAvailable = await checkPortAvailability(port);

      if (portAvailable) {
        console.log(`✅ Port ${port} bound successfully`);
        break;
      } else {
        console.log(`⚠️ Port ${port} not available, killing processes...`);
        await killPort(port);
        port++;

        if (attempt === 4) {
          console.error('❌ Could not find available port after 5 attempts');
          process.exit(1);
        }
      }
    }

    // Step 5: Load and start server
    console.log('📋 Step 5: Loading server...');
    process.chdir(__dirname);

    // Set development mode if not already set
    if (!process.env.NODE_ENV) {
      process.env.NODE_ENV = 'development';
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('🔧 Dev mode: In-memory cache active');
    }

    try {
      require('../server');
      console.log('✅ Server loaded success');
    } catch (error) {
      console.error('❌ Error loading server:', error.message);
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error during startup:', error.message);
    process.exit(1);
  }
}

// Run startup if this script is executed directly
if (require.main === module) {
  startServer();
}

module.exports = { startServer, killPort, checkPortAvailability, validateServerSyntax };