#!/bin/bash

# OpenBB Startup Script for Windows Git Bash/MINGW64
# This script kills any process using port 5000 and starts the server

echo "🔍 Checking for processes on port 5000..."

# Find and kill processes on port 5000
PORT_5000_PIDS=$(netstat -ano | grep :5000 | awk '{print $5}' | tr '\n' ' ')

if [ ! -z "$PORT_5000_PIDS" ]; then
    echo "⚠️ Found processes using port 5000: $PORT_5000_PIDS"
    echo "🛑 Killing processes on port 5000..."

    for pid in $PORT_5000_PIDS; do
        if [ "$pid" != "0" ] && [ "$pid" != "" ]; then
            echo "Killing PID: $pid"
            taskkill //PID $pid //F 2>/dev/null || true
        fi
    done

    echo "⏳ Waiting 2 seconds for processes to terminate..."
    sleep 2
else
    echo "✅ No processes found on port 5000"
fi

echo "🚀 Starting AI Saham server..."

# Navigate to server directory and start the development server
cd ../
npm run dev