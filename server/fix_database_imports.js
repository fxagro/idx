#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function fixDatabaseImports() {
  const serverDir = path.join(__dirname);
  const filesToCheck = [];

  // Find all .js files that might have database imports
  function findJsFiles(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !file.startsWith('node_modules') && !file.startsWith('.git')) {
        findJsFiles(fullPath);
      } else if (file.endsWith('.js') && !file.includes('node_modules')) {
        filesToCheck.push(fullPath);
      }
    });
  }

  findJsFiles(serverDir);

  const oldPattern = /require\(['"]\.\.\/db['"]\)/g;
  const newImport = `const { pool } = require('../config/db')`;
  const oldImport = `const pool = require('../db')`;

  let fixedCount = 0;

  filesToCheck.forEach(file => {
    try {
      let content = fs.readFileSync(file, 'utf8');
      let originalContent = content;
      
      // Fix destructured imports
      content = content.replace(/const\s*{[^}]*pool[^}]*}\s*=\s*require\(['"]\.\.\/db['"]\)/g, newImport);
      
      // Fix non-destructured imports for certain files
      if (file.includes('routes/affiliate.js') || 
          file.includes('services/affiliateService.js') ||
          file.includes('routes/brokers.js') ||
          file.includes('routes/admin.js') ||
          file.includes('services/notificationService.js') ||
          file.includes('services/paymentService.js') ||
          file.includes('middleware/apiUsage.js')) {
        content = content.replace(/const\s+pool\s*=\s*require\(['"]\.\.\/db['"]\)/g, newImport);
      }
      
      // Fix require('../db') calls in affiliate.js inline queries
      content = content.replace(/require\(['"]\.\.\/db['"]\)\.query/g, 'pool.query');
      
      if (content !== originalContent) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`✅ Fixed: ${file}`);
        fixedCount++;
      }
    } catch (error) {
      console.error(`❌ Error processing ${file}:`, error.message);
    }
  });

  console.log(`\n🎉 Fixed ${fixedCount} files with database import issues`);
}

fixDatabaseImports();