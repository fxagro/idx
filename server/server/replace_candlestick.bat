@echo off
cd /d %~dp0
node -e "const fs=require('fs');const c=fs.readFileSync('routes/stocks.js','utf8');const f=fs.readFileSync('candlestick_fix.js','utf8');const s=c.indexOf('// GET /api/stocks/candlestick - Get candlestick chart data for a stock');const e=c.indexOf('// GET /api/stocks/bandar');if(s!==-1&&e!==-1){fs.writeFileSync('routes/stocks.js',c.substring(0,s)+f+c.substring(e));console.log('SUCCESS');}else{console.log('FAILED');}"
