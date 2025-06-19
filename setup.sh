#!/bin/bash

# 🚀 Medical Research MCP Suite - Setup Script

echo "🏥 Setting up Medical Research MCP Suite..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ and try again."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"

# Create environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "🔧 Creating .env file from template..."
    cp .env.example .env
    echo "✅ .env file created. Please edit it with your API keys if needed."
else
    echo "✅ .env file already exists"
fi

# Create logs directory if it doesn't exist
mkdir -p logs

# Build the project
echo "🔨 Building the project..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

echo "✅ Build completed successfully"

# Run tests
echo "🧪 Running tests..."
npm test

if [ $? -ne 0 ]; then
    echo "⚠️  Some tests failed, but setup is complete"
else
    echo "✅ All tests passed"
fi

echo ""
echo "🎉 Setup complete! Your Medical Research MCP Suite is ready to use."
echo ""
echo "Next steps:"
echo "1. Edit .env file with your API keys (optional - APIs work without keys but with rate limits)"
echo "2. Run 'npm run dev' to start the development server"
echo "3. Test with: echo '{\"method\":\"tools/list\",\"params\":{}}' | npm run dev"
echo ""
echo "For Claude Desktop integration, add this to your claude_desktop_config.json:"
echo '{'
echo '  "mcpServers": {'
echo '    "medical-research": {'
echo '      "command": "node",'
echo "      \"args\": [\"$(pwd)/dist/index.js\"]"
echo '    }'
echo '  }'
echo '}'
echo ""
echo "📚 Read README.md for full documentation and examples"
echo "🚀 Happy researching!"
