#!/usr/bin/env node

// Test script to verify MCP server produces clean JSON output
// This simulates what Claude Code expects from the MCP server

import { spawn } from 'child_process';
import { promises as fs } from 'fs';

async function testMCPJsonOutput() {
  console.log('🧪 Testing MCP Server JSON Output Compliance\n');

  // Start the MCP server
  const serverProcess = spawn('node', ['dist/index.js'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'production' }
  });

  let jsonMessages = [];
  let nonJsonOutput = [];
  let validJson = true;

  // Collect output
  serverProcess.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    
    lines.forEach(line => {
      if (line.trim()) {
        try {
          const parsed = JSON.parse(line);
          jsonMessages.push(parsed);
        } catch (error) {
          nonJsonOutput.push(line);
          validJson = false;
        }
      }
    });
  });

  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 1: Send initialize request
  console.log('📋 Test 1: Initialize MCP Server');
  const initRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {
        roots: {
          listChanged: false
        },
        sampling: {}
      },
      clientInfo: {
        name: 'test-client',
        version: '1.0.0'
      }
    }
  };

  serverProcess.stdin.write(JSON.stringify(initRequest) + '\n');
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 2: List tools
  console.log('📋 Test 2: List Tools');
  const listToolsRequest = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {}
  };

  serverProcess.stdin.write(JSON.stringify(listToolsRequest) + '\n');
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 3: Test FDA search (previously problematic)
  console.log('📋 Test 3: FDA Search (Previously Problematic)');
  const fdaSearchRequest = {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'fda_search_drugs',
      arguments: {
        activeIngredient: 'ranibizumab'
      }
    }
  };

  serverProcess.stdin.write(JSON.stringify(fdaSearchRequest) + '\n');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Test 4: Test PubMed search (previously problematic)
  console.log('📋 Test 4: PubMed Search (Previously Problematic)');
  const pubmedSearchRequest = {
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/call',
    params: {
      name: 'pm_search_papers',
      arguments: {
        query: 'age-related macular degeneration',
        maxResults: 5
      }
    }
  };

  serverProcess.stdin.write(JSON.stringify(pubmedSearchRequest) + '\n');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Close server
  serverProcess.kill();

  // Report results
  console.log('\n🔍 MCP JSON Output Analysis:');
  console.log(`  ✅ Valid JSON messages: ${jsonMessages.length}`);
  console.log(`  ❌ Non-JSON output lines: ${nonJsonOutput.length}`);
  
  if (validJson) {
    console.log('\n✅ SUCCESS: All output is valid JSON!');
    console.log('  🎉 MCP protocol compliance: PASSED');
    console.log('  🎉 Claude Code compatibility: READY');
  } else {
    console.log('\n❌ FAILURE: Found non-JSON output:');
    nonJsonOutput.forEach((line, index) => {
      console.log(`  ${index + 1}. "${line}"`);
    });
  }

  // Show sample valid JSON responses
  if (jsonMessages.length > 0) {
    console.log('\n📝 Sample Valid JSON Responses:');
    jsonMessages.slice(0, 2).forEach((msg, index) => {
      console.log(`  ${index + 1}. ${msg.method || 'response'}: ${JSON.stringify(msg).substring(0, 100)}...`);
    });
  }

  return validJson;
}

// Run the test
testMCPJsonOutput().then(success => {
  if (success) {
    console.log('\n🎉 MCP Server is ready for Claude Code!');
    process.exit(0);
  } else {
    console.log('\n❌ MCP Server needs more fixes before Claude Code integration');
    process.exit(1);
  }
}).catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});