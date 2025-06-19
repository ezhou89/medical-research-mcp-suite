# 🧪 Testing Guide for Medical Research MCP Suite

## **Quick Start Testing (5 minutes)**

### **1. Basic Functionality Test**
```bash
cd /Users/eugenezhou/Code/medical-research-mcp-suite

# Make test script executable and run it
chmod +x test-mcp.sh
./test-mcp.sh
```

This will test:
- ✅ MCP server starts correctly
- ✅ Tools are listed properly
- ✅ Clinical trials search works
- ✅ PubMed search works
- ✅ Cross-API analysis works

---

## **Manual Testing Commands**

### **Test 1: List All Available Tools**
```bash
echo '{"method":"tools/list","params":{}}' | npm run dev
```

**Expected Output:**
```json
{
  "tools": [
    {
      "name": "ct_search_trials",
      "description": "Search ClinicalTrials.gov for studies with AI-enhanced results"
    },
    {
      "name": "research_comprehensive_analysis", 
      "description": "Comprehensive analysis combining clinical trials, literature, and safety data"
    }
    // ... more tools
  ]
}
```

### **Test 2: Search Clinical Trials**
```bash
echo '{"method":"tools/call","params":{"name":"ct_search_trials","arguments":{"condition":"diabetes","intervention":"metformin","pageSize":5}}}' | npm run dev
```

**Expected Output:**
- JSON response with clinical trials data
- Study summaries and metadata
- NCT IDs and study details

### **Test 3: Get Specific Study**
```bash
echo '{"method":"tools/call","params":{"name":"ct_get_study","arguments":{"nctId":"NCT04373031"}}}' | npm run dev
```

**Expected Output:**
- Detailed study information for that specific NCT ID
- Enhanced analysis and key points

### **Test 4: PubMed Literature Search**
```bash
echo '{"method":"tools/call","params":{"name":"pm_search_papers","arguments":{"query":"diabetes AND metformin","maxResults":5}}}' | npm run dev
```

**Expected Output:**
- PubMed papers related to diabetes and metformin
- Paper titles, authors, abstracts

### **Test 5: FDA Drug Search**
```bash
echo '{"method":"tools/call","params":{"name":"fda_search_drugs","arguments":{"drugName":"metformin"}}}' | npm run dev
```

**Expected Output:**
- FDA-approved drug information
- Approval dates and details

### **Test 6: Cross-API Comprehensive Analysis** (🔥 **The Magic!**)
```bash
echo '{"method":"tools/call","params":{"name":"research_comprehensive_analysis","arguments":{"drugName":"pembrolizumab","condition":"lung cancer","analysisDepth":"detailed"}}}' | npm run dev
```

**Expected Output:**
- Combined analysis from all databases
- Risk assessments and market insights
- Executive summary and recommendations

### **Test 7: Drug Safety Profile**
```bash
echo '{"method":"tools/call","params":{"name":"research_drug_safety_profile","arguments":{"drugName":"metformin","timeframe":"5years","includeTrials":true,"includeFDA":true}}}' | npm run dev
```

**Expected Output:**
- Comprehensive safety analysis
- Clinical trial safety data
- FDA adverse event data
- Risk assessments and recommendations

---

## **Automated Test Suite**

### **Run All Tests**
```bash
npm test
```

### **Run Specific Test Files**
```bash
# Test clinical trials API
npm test -- clinicalTrials.test.ts

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm test -- --watch
```

### **Test Individual Components**
```bash
# Test API clients directly
npm test -- --testNamePattern="ClinicalTrialsClient"

# Test validation
npm test -- --testNamePattern="Validator"

# Test caching
npm test -- --testNamePattern="Cache"
```

---

## **Integration Testing with Claude Desktop**

### **1. Add to Claude Desktop Config**

Add this to your `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "medical-research": {
      "command": "node",
      "args": ["/Users/eugenezhou/Code/medical-research-mcp-suite/dist/index.js"],
      "env": {
        "NODE_ENV": "development"
      }
    }
  }
}
```

### **2. Restart Claude Desktop**
- Close Claude Desktop completely
- Reopen it
- Look for "medical-research" in available tools

### **3. Test in Claude Desktop**

Ask Claude:
> "Can you search for clinical trials about diabetes using metformin? Use the medical research tools."

> "Analyze the drug safety profile for pembrolizumab using the comprehensive analysis tool."

> "What clinical trials are currently recruiting for lung cancer treatments?"

---

## **Performance Testing**

### **Test Response Times**
```bash
# Time how long searches take
time echo '{"method":"tools/call","params":{"name":"ct_search_trials","arguments":{"condition":"cancer","pageSize":10}}}' | npm run dev
```

### **Test Caching**
```bash
# Run same query twice - second should be faster
echo '{"method":"tools/call","params":{"name":"ct_search_trials","arguments":{"condition":"diabetes","pageSize":5}}}' | npm run dev

# Run again immediately (should be cached)
echo '{"method":"tools/call","params":{"name":"ct_search_trials","arguments":{"condition":"diabetes","pageSize":5}}}' | npm run dev
```

### **Test Error Handling**
```bash
# Test invalid NCT ID
echo '{"method":"tools/call","params":{"name":"ct_get_study","arguments":{"nctId":"INVALID"}}}' | npm run dev

# Test empty search
echo '{"method":"tools/call","params":{"name":"ct_search_trials","arguments":{"condition":""}}}' | npm run dev
```

---

## **Load Testing**

### **Test Multiple Concurrent Requests**
```bash
# Run multiple searches in parallel
for i in {1..5}; do
    echo '{"method":"tools/call","params":{"name":"ct_search_trials","arguments":{"condition":"diabetes","pageSize":3}}}' | npm run dev &
done
wait
```

---

## **Debugging & Logs**

### **Check Logs**
```bash
# View all logs
tail -f logs/combined.log

# View only errors
tail -f logs/error.log

# Watch logs in real-time during testing
tail -f logs/combined.log &
npm run dev
```

### **Debug Mode**
```bash
# Run with debug logging
LOG_LEVEL=debug npm run dev
```

### **Test with Verbose Output**
```bash
# Add debug info to your test
echo '{"method":"tools/call","params":{"name":"ct_search_trials","arguments":{"condition":"diabetes","pageSize":3}}}' | LOG_LEVEL=debug npm run dev
```

---

## **Common Issues & Solutions**

### **❌ "Command not found" errors**
```bash
# Make sure you're in the right directory
cd /Users/eugenezhou/Code/medical-research-mcp-suite

# Make sure dependencies are installed
npm install

# Make sure project is built
npm run build
```

### **❌ API timeout errors**
```bash
# Check your internet connection
curl -I https://clinicaltrials.gov

# Test with smaller queries
echo '{"method":"tools/call","params":{"name":"ct_search_trials","arguments":{"condition":"diabetes","pageSize":1}}}' | npm run dev
```

### **❌ JSON parsing errors**
- Make sure JSON is properly formatted
- Use single quotes for the outer shell command
- Use double quotes inside the JSON

### **❌ Rate limiting**
- Wait a few minutes between large requests
- Use smaller page sizes
- Check if you need API keys

---

## **Testing Checklist**

### **Basic Functionality ✅**
- [ ] MCP server starts without errors
- [ ] Tools list returns all expected tools
- [ ] Clinical trials search works
- [ ] PubMed search works
- [ ] FDA search works
- [ ] Cross-API analysis works

### **Data Quality ✅**
- [ ] Search results contain valid data
- [ ] NCT IDs are properly formatted
- [ ] Papers have titles and abstracts
- [ ] Error messages are helpful

### **Performance ✅**
- [ ] Responses come back within 10 seconds
- [ ] Caching works (second request faster)
- [ ] Memory usage stays reasonable
- [ ] No memory leaks over time

### **Error Handling ✅**
- [ ] Invalid inputs return error messages
- [ ] Network failures are handled gracefully
- [ ] Rate limits don't crash the server
- [ ] Malformed JSON is handled properly

### **Claude Desktop Integration ✅**
- [ ] Server appears in Claude's tool list
- [ ] Tools can be called from Claude
- [ ] Responses are properly formatted
- [ ] Claude can use the results effectively

---

## **🎯 Quick Success Test**

Run this single command to verify everything works:

```bash
cd /Users/eugenezhou/Code/medical-research-mcp-suite && npm run build && echo '{"method":"tools/call","params":{"name":"research_comprehensive_analysis","arguments":{"drugName":"metformin","condition":"diabetes","analysisDepth":"basic"}}}' | npm run dev
```

If this returns a comprehensive analysis combining clinical trials, literature, and FDA data, **your MCP server is working perfectly!** 🎉

---

**Ready to test? Start with the quick test script and work your way through the manual tests!**
