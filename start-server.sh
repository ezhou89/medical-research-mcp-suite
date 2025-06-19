#!/bin/bash

# Medical Research MCP Suite Startup Script
# This script ensures the server starts from the correct directory

cd "/Users/eugenezhou/Code/medical-research-mcp-suite"

# Create logs directory if it doesn't exist
mkdir -p logs

# Use full path to node for better compatibility and log errors
exec /Users/eugenezhou/.nvm/versions/node/v22.16.0/bin/node dist/index.js 2>>logs/error.log