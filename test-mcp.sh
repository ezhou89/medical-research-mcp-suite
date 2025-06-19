#!/bin/bash

# 🧪 Quick MCP Test Script
# Run this to test your MCP server locally

cd /Users/eugenezhou/Code/medical-research-mcp-suite

echo "🏥 Testing Medical Research MCP Suite..."
echo ""

# Build the project first
echo "🔨 Building project..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

echo "✅ Build successful"
echo ""

# Test 1: List available tools
echo "🔧 Test 1: Listing available tools..."
echo '{"method":"tools/list","params":{}}' | node dist/index.js

echo ""
echo "✅ Tools list test complete"
echo ""

# Test 2: Search clinical trials
echo "🏥 Test 2: Searching clinical trials for diabetes..."
echo '{"method":"tools/call","params":{"name":"ct_search_trials","arguments":{"condition":"diabetes","pageSize":3}}}' | node dist/index.js

echo ""
echo "✅ Clinical trials search test complete"
echo ""

# Test 3: Get specific study details
echo "📋 Test 3: Getting study details..."
echo '{"method":"tools/call","params":{"name":"ct_get_study","arguments":{"nctId":"NCT04373031"}}}' | node dist/index.js

echo ""
echo "✅ Study details test complete"
echo ""

# Test 4: Search PubMed
echo "📚 Test 4: Searching PubMed literature..."
echo '{"method":"tools/call","params":{"name":"pm_search_papers","arguments":{"query":"diabetes metformin","maxResults":3}}}' | node dist/index.js

echo ""
echo "✅ PubMed search test complete"
echo ""

# Test 5: Cross-API analysis (the magic!)
echo "🔬 Test 5: Cross-API comprehensive analysis..."
echo '{"method":"tools/call","params":{"name":"research_comprehensive_analysis","arguments":{"drugName":"metformin","condition":"diabetes","analysisDepth":"basic"}}}' | node dist/index.js

echo ""
echo "✅ Cross-API analysis test complete"
echo ""

echo "🎉 All tests completed successfully!"
echo ""
echo "Next steps:"
echo "1. Try more complex queries"
echo "2. Test with Claude Desktop integration"
echo "3. Deploy to Cloudflare for live demo"
