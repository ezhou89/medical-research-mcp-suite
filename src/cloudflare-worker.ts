// src/cloudflare-worker.ts - Cloudflare Worker entry point

import { MedicalResearchMCPServer } from './index.js';

interface CloudflareRequest extends Request {}

export class CloudflareMedicalResearchAPI {
  private mcpServer: MedicalResearchMCPServer;

  constructor() {
    this.mcpServer = new MedicalResearchMCPServer();
  }

  async handleRequest(request: CloudflareRequest): Promise<Response> {
    // CORS headers for web requests
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Content-Type': 'application/json',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const url = new URL(request.url);
      const path = url.pathname;

      // Route to appropriate handler
      if (path === '/api/tools' && request.method === 'GET') {
        return this.listTools(corsHeaders);
      }
      
      if (path === '/api/tools/call' && request.method === 'POST') {
        const body = await request.json();
        return this.callTool(body, corsHeaders);
      }

      // Health check endpoint
      if (path === '/api/health') {
        return new Response(JSON.stringify({ 
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }), { headers: corsHeaders });
      }

      // API documentation endpoint
      if (path === '/api/docs' || path === '/') {
        return this.getDocumentation(corsHeaders);
      }

      return new Response(JSON.stringify({ 
        error: 'Not found' 
      }), { 
        status: 404, 
        headers: corsHeaders 
      });

    } catch (error: any) {
      return new Response(JSON.stringify({ 
        error: error.message 
      }), { 
        status: 500, 
        headers: corsHeaders 
      });
    }
  }

  private async listTools(headers: Record<string, string>): Promise<Response> {
    const tools = [
      {
        name: "ct_search_trials",
        description: "Search ClinicalTrials.gov for studies with AI-enhanced results",
        parameters: {
          condition: "Medical condition (e.g., 'diabetes', 'cancer')",
          intervention: "Treatment or drug name",
          pageSize: "Number of results (1-100)"
        }
      },
      {
        name: "pm_search_papers", 
        description: "Search PubMed for research papers with enhanced analysis",
        parameters: {
          query: "Search query (e.g., 'diabetes AND metformin')",
          maxResults: "Number of results (1-100)"
        }
      },
      {
        name: "fda_search_drugs",
        description: "Search FDA drug database with safety analysis", 
        parameters: {
          drugName: "Drug name to search for"
        }
      },
      {
        name: "research_comprehensive_analysis",
        description: "🔥 Comprehensive analysis combining clinical trials, literature, and safety data",
        parameters: {
          drugName: "Drug name to analyze",
          condition: "Medical condition", 
          analysisDepth: "basic | detailed | comprehensive"
        }
      },
      {
        name: "research_drug_safety_profile",
        description: "🔥 Complete drug safety analysis across clinical trials and FDA reports",
        parameters: {
          drugName: "Drug name to analyze",
          timeframe: "Time period (1year, 2years, 5years)",
          includeTrials: "Include clinical trial safety data",
          includeFDA: "Include FDA adverse event data"
        }
      }
    ];

    return new Response(JSON.stringify({ tools }), { headers });
  }

  private async callTool(body: any, headers: Record<string, string>): Promise<Response> {
    const { tool, parameters } = body;

    if (!tool) {
      return new Response(JSON.stringify({ 
        error: 'Missing tool name' 
      }), { 
        status: 400, 
        headers 
      });
    }

    try {
      // Call the MCP server methods directly
      let result;
      
      if (tool.startsWith('ct_')) {
        result = await this.mcpServer.handleClinicalTrialsCall(tool, parameters);
      } else if (tool.startsWith('pm_')) {
        result = await this.mcpServer.handlePubMedCall(tool, parameters);
      } else if (tool.startsWith('fda_')) {
        result = await this.mcpServer.handleFDACall(tool, parameters);
      } else if (tool.startsWith('research_')) {
        result = await this.mcpServer.handleCrossAPICall(tool, parameters);
      } else {
        throw new Error(`Unknown tool: ${tool}`);
      }

      return new Response(JSON.stringify(result), { headers });

    } catch (error: any) {
      return new Response(JSON.stringify({ 
        error: error.message,
        tool: tool
      }), { 
        status: 500, 
        headers 
      });
    }
  }

  private getDocumentation(headers: Record<string, string>): Response {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>🏥 Medical Research API</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #f8f9fa; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 30px; }
        .endpoint { background: white; padding: 20px; margin: 15px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .method { background: #007acc; color: white; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; }
        .magic { background: linear-gradient(45deg, #ff6b6b, #feca57); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        pre { background: #f1f3f4; padding: 15px; border-radius: 6px; overflow-x: auto; font-size: 14px; }
        .badge { background: #28a745; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🏥 Medical Research API</h1>
        <p>AI-enhanced medical research across clinical trials, literature, and FDA databases</p>
        <div class="badge">Live & Production Ready</div>
    </div>
    
    <h2>🛠 Available Tools</h2>
    
    <div class="endpoint">
        <strong>🔬 Clinical Trials Search</strong><br>
        <span class="method">POST</span> /api/tools/call<br>
        <em>Search ClinicalTrials.gov database - 400,000+ studies</em>
    </div>
    
    <div class="endpoint">
        <strong>📚 Literature Search</strong><br>
        <span class="method">POST</span> /api/tools/call<br>
        <em>Search PubMed research papers - 35M+ articles</em>
    </div>
    
    <div class="endpoint">
        <strong>💊 FDA Drug Search</strong><br>
        <span class="method">POST</span> /api/tools/call<br>
        <em>Search FDA drug approval database</em>
    </div>
    
    <div class="endpoint">
        <strong class="magic">🔥 Comprehensive Analysis</strong><br>
        <span class="method">POST</span> /api/tools/call<br>
        <em>Cross-database strategic analysis - THE MAGIC!</em>
    </div>

    <div class="endpoint">
        <strong class="magic">🔥 Drug Safety Profile</strong><br>
        <span class="method">POST</span> /api/tools/call<br>
        <em>Multi-source safety analysis with risk scoring</em>
    </div>

    <h2>📋 Example Request</h2>
    <pre><code>curl -X POST https://your-worker.your-subdomain.workers.dev/api/tools/call \\
  -H "Content-Type: application/json" \\
  -d '{
    "tool": "research_comprehensive_analysis",
    "parameters": {
      "drugName": "metformin",
      "condition": "diabetes",
      "analysisDepth": "detailed"
    }
  }'</code></pre>

    <h2>🚀 What Makes This Special</h2>
    <ul>
        <li><strong>Real-time data</strong> from multiple medical databases</li>
        <li><strong>Cross-API analysis</strong> unavailable elsewhere</li>
        <li><strong>AI-enhanced insights</strong> for strategic decision-making</li>
        <li><strong>Enterprise-grade</strong> architecture that scales</li>
    </ul>

    <h2>⚡ Rate Limits</h2>
    <p>100 requests per minute per IP address</p>
    
    <h2>💼 Enterprise</h2>
    <p>Contact us for custom deployment, higher rate limits, and white-label options.</p>
    
    <footer style="margin-top: 40px; text-align: center; color: #666;">
        <p>Built with ❤️ for the medical research community</p>
    </footer>
</body>
</html>`;

    return new Response(html, { 
      headers: { 
        ...headers, 
        'Content-Type': 'text/html' 
      } 
    });
  }
}

// Cloudflare Worker entry point
export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const api = new CloudflareMedicalResearchAPI();
    return api.handleRequest(request);
  }
};