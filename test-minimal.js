#!/usr/bin/env node

// Minimal MCP server test to isolate the read_file issue

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  {
    name: "medical-research-test",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Simple test tools only
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "test_simple",
        description: "Simple test tool",
        inputSchema: {
          type: "object",
          properties: {
            message: {
              type: "string",
              description: "Test message"
            }
          }
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "test_simple") {
      return {
        content: [
          {
            type: "text",
            text: `Test successful: ${args?.message || "No message provided"}`
          }
        ]
      };
    } else {
      throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Minimal Medical Research Test Server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});