#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import dotenv from 'dotenv';

// Import API clients
import { ClinicalTrialsClient } from './apis/clinicalTrials.js';
import { PubMedClient } from './apis/pubmed.js';
import { FDAClient } from './apis/fda.js';

// Import cross-API services
import { ResearchAnalyzer } from './services/researchAnalyzer.js';
import { DrugSafetyService } from './services/drugSafety.js';

dotenv.config();

// Configure production mode logging
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const LOG_LEVEL = process.env.LOG_LEVEL || (IS_PRODUCTION ? 'error' : 'debug');

export class MedicalResearchMCPServer {
  private server: Server;
  
  // Individual API clients
  private clinicalTrialsClient: ClinicalTrialsClient;
  private pubmedClient: PubMedClient;
  private fdaClient: FDAClient;
  
  // Cross-API services
  private researchAnalyzer: ResearchAnalyzer;
  private drugSafetyService: DrugSafetyService;
  
  // Client information for adaptive responses
  private clientInfo: {
    name?: string;
    version?: string;
    type?: string;
  } = {};

  constructor() {
    // Initialize API clients
    this.clinicalTrialsClient = new ClinicalTrialsClient();
    this.pubmedClient = new PubMedClient();
    this.fdaClient = new FDAClient();
    
    // Initialize cross-API services
    this.researchAnalyzer = new ResearchAnalyzer({
      clinicalTrials: this.clinicalTrialsClient,
      pubmed: this.pubmedClient,
      fda: this.fdaClient,
    });
    
    this.drugSafetyService = new DrugSafetyService({
      clinicalTrials: this.clinicalTrialsClient,
      fda: this.fdaClient,
    });

    this.server = new Server(
      {
        name: "medical-research-suite",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  /**
   * Detect client type from client name for adaptive responses
   */
  private detectClientType(clientName?: string): string {
    if (!clientName) return 'unknown';
    
    const name = clientName.toLowerCase();
    
    if (name.includes('vscode') || name.includes('vs code')) return 'vscode';
    if (name.includes('cursor')) return 'cursor';
    if (name.includes('claude') && name.includes('desktop')) return 'desktop';
    if (name.includes('claude') && name.includes('web')) return 'web';
    if (name.includes('slack')) return 'slack';
    if (name.includes('cli') || name.includes('terminal') || name.includes('command')) return 'cli';
    if (name.includes('browser') || name.includes('web')) return 'web';
    if (name.includes('typingmind')) return 'web';
    if (name.includes('continue')) return 'vscode';
    if (name.includes('windsurf')) return 'vscode';
    if (name.includes('tome')) return 'desktop';
    if (name.includes('cherry')) return 'desktop';
    
    return 'unknown';
  }

  /**
   * Set client information for adaptive responses
   * This can be called by clients or inferred from environment
   */
  public setClientInfo(name: string, version?: string) {
    this.clientInfo = {
      name: name.toLowerCase(),
      version,
      type: this.detectClientType(name)
    };
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          // Single API tools
          ...this.getClinicalTrialsTools(),
          ...this.getPubMedTools(),
          ...this.getFDATools(),
          
          // Cross-API workflow tools (THIS IS THE MAGIC!)
          ...this.getCrossAPITools(),
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        // Route to appropriate handler
        if (name.startsWith('ct_')) {
          return await this.handleClinicalTrialsCall(name, args);
        } else if (name.startsWith('pm_')) {
          return await this.handlePubMedCall(name, args);
        } else if (name.startsWith('fda_')) {
          return await this.handleFDACall(name, args);
        } else if (name.startsWith('research_')) {
          return await this.handleCrossAPICall(name, args);
        } else {
          throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error: any) {
        return {
          content: [{ type: "text", text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    });
  }

  // Handle prompt requests
  private async handlePromptRequest(name: string, args: any) {
    try {
      switch (name) {
        case 'search_refinement':
          return await this.generateSearchRefinementPrompt(args);
        case 'progressive_loading':
          return await this.generateProgressiveLoadingPrompt(args);
        case 'field_selection':
          return await this.generateFieldSelectionPrompt(args);
        default:
          throw new Error(`Unknown prompt: ${name}`);
      }
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `Error generating prompt: ${error.message}` }],
        isError: true,
      };
    }
  }

  private async generateSearchRefinementPrompt(args: any) {
    const {
      originalQuery,
      api,
      errorMessage,
      suggestedRefinements,
      currentResultCount,
      canContinueWithoutRefinement
    } = args;

    const refinementOptions = suggestedRefinements.map((ref: any, index: number) => 
      `${index + 1}. **${ref.label}** (${ref.priority} priority)\\n   ${ref.description}`
    ).join('\\n\\n');

    const promptText = `# Search Results Too Large - Refinement Required

**Original Query:** ${JSON.stringify(originalQuery, null, 2)}
**API:** ${api}
**Issue:** ${errorMessage}
${currentResultCount ? `**Current Results:** ${currentResultCount}` : ''}

## Suggested Refinements

${refinementOptions}

## Instructions

Please select one or more refinement options by number, or provide your own refinement parameters. For example:
- "Apply options 1 and 3"
- "Filter to Phase III trials from last 2 years"
- "Load first 50 results progressively"

${canContinueWithoutRefinement ? '**Note:** You can also choose to continue with truncated results.' : ''}

What would you like to do?`;

    return {
      content: [{
        type: "text",
        text: promptText,
      }],
    };
  }

  private async generateProgressiveLoadingPrompt(args: any) {
    const { totalResults, pageSize, currentPage, loadingOptions } = args;

    const options = loadingOptions.map((option: string, index: number) => 
      `${index + 1}. ${option}`
    ).join('\\n');

    const promptText = `# Progressive Loading Options

**Total Results Available:** ${totalResults}
**Current Page:** ${currentPage}
**Results per Page:** ${pageSize}

## Loading Options

${options}

How would you like to proceed with loading the remaining results?`;

    return {
      content: [{
        type: "text",
        text: promptText,
      }],
    };
  }

  private async generateFieldSelectionPrompt(args: any) {
    const { availableFields, currentFields, estimatedSizeReduction, fieldDescriptions } = args;

    const fieldList = availableFields.map((field: string) => 
      `- **${field}**: ${fieldDescriptions[field] || 'No description available'} ${currentFields.includes(field) ? '(currently selected)' : ''}`
    ).join('\\n');

    const promptText = `# Field Selection for Size Reduction

**Estimated Size Reduction:** ${estimatedSizeReduction}%

## Available Fields

${fieldList}

Please select which fields you'd like to include in the response to reduce the size. You can specify:
- Field names: "id, title, status, phase"
- Categories: "essential fields only", "basic info", "detailed info"

What fields would you like to include?`;

    return {
      content: [{
        type: "text",
        text: promptText,
      }],
    };
  }

  /**
   * Generate universal size limit guidance compatible with all MCP clients
   */
  private generateSizeLimitGuidance(originalQuery: any, error: any, clientType: string = 'unknown') {
    const condition = originalQuery.condition || 'your condition';
    const phase = originalQuery.phase || [];
    const status = originalQuery.status || [];
    
    // Generate refinement options
    const refinementOptions = [
      {
        title: "Focus on Advanced Trials",
        description: "Phase III trials with active recruitment",
        query: { 
          query: { condition },
          filter: { phase: ["PHASE3"], overallStatus: ["RECRUITING", "ACTIVE_NOT_RECRUITING"] },
          pageSize: 25 
        }
      },
      {
        title: "Recent Active Trials Only", 
        description: "Phase II & III trials currently recruiting",
        query: { 
          query: { condition },
          filter: { phase: ["PHASE2", "PHASE3"], overallStatus: ["RECRUITING"] },
          pageSize: 30 
        }
      },
      {
        title: "Completed Trials (Last 2 Years)",
        description: "Recently completed Phase III trials",
        query: { 
          query: { condition },
          filter: { phase: ["PHASE3"], overallStatus: ["COMPLETED"] },
          pageSize: 50 
        }
      }
    ];

    // Add condition-specific refinements
    if (condition.toLowerCase().includes('macular degeneration') || condition.toLowerCase().includes('amd')) {
      refinementOptions.push({
        title: "Anti-VEGF Trials",
        description: "Trials testing anti-VEGF therapies for AMD",
        query: { 
          query: {
            condition: "age-related macular degeneration",
            intervention: "ranibizumab OR aflibercept OR bevacizumab"
          } as any,
          filter: { phase: ["PHASE2", "PHASE3"], overallStatus: ["RECRUITING", "ACTIVE_NOT_RECRUITING"] },
          pageSize: 40 
        }
      });
    }

    // Generate output based on client type
    switch (clientType.toLowerCase()) {
      case 'vscode':
      case 'cursor':
        return this.generateIDEGuidance(condition, refinementOptions);
      case 'web':
      case 'browser':
        return this.generateWebGuidance(condition, refinementOptions);
      case 'cli':
      case 'terminal':
        return this.generateCLIGuidance(condition, refinementOptions);
      case 'slack':
        return this.generateSlackGuidance(condition, refinementOptions);
      default:
        return this.generateUniversalGuidance(condition, refinementOptions);
    }
  }

  private generateUniversalGuidance(condition: string, options: any[]) {
    const guidanceText = `# Search Results Too Large (1MB+ Response)

Your search for "${condition}" returned too many results to display. Here are specific refinement strategies:

## 🎯 Immediate Solutions

${options.map((option, i) => `
**Option ${i + 1}: ${option.title}**
${option.description}
\`\`\`json
${JSON.stringify(option.query, null, 2)}
\`\`\`
`).join('')}

## 🔄 Progressive Loading Strategy

1. **Start Small**: Use pageSize: 20-30 for initial exploration
2. **Refine & Expand**: Add more specific filters, then increase pageSize
3. **Focus by Phase**: Start with PHASE3, then expand to PHASE2 if needed

## 💡 Pro Tips

- **Active Development**: Focus on RECRUITING + ACTIVE_NOT_RECRUITING status
- **Market Leaders**: Search by sponsor (e.g., "Genentech", "Novartis")
- **Combination Approach**: Use multiple smaller queries rather than one large one

Copy any JSON query above and use it with the ct_search_trials tool!`;

    return {
      content: [{
        type: "text",
        text: guidanceText,
      }],
    };
  }

  private generateIDEGuidance(condition: string, options: any[]) {
    const guidanceText = `# 🚨 Search Results Too Large

Your search for **${condition}** exceeded the 1MB response limit. Use these refined searches:

## Quick Actions

${options.map((option, i) => `
### ${i + 1}. ${option.title}
*${option.description}*

\`\`\`typescript
// Copy this to your MCP tool call
ct_search_trials(${JSON.stringify(option.query, null, 2)})
\`\`\`
`).join('')}

## 📋 Best Practices for Large Datasets

- **Pagination**: Start with pageSize: 25-50
- **Phase Focus**: Begin with PHASE3 for market-ready drugs  
- **Status Filter**: Use ["RECRUITING", "ACTIVE_NOT_RECRUITING"] for active trials
- **Progressive Refinement**: Add filters incrementally

💡 **IDE Tip**: Use Command Palette to quickly execute MCP tools with these parameters.`;

    return {
      content: [{
        type: "text", 
        text: guidanceText,
      }],
    };
  }

  private generateWebGuidance(condition: string, options: any[]) {
    const guidanceText = `<div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 16px; margin: 8px 0;">
<h2>🚨 Search Results Too Large</h2>
<p>Your search for <strong>${condition}</strong> returned over 1MB of data. Please refine your search:</p>
</div>

<div style="display: grid; gap: 16px; margin: 16px 0;">
${options.map((option, i) => `
<div style="background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 6px; padding: 12px;">
<h3>Option ${i + 1}: ${option.title}</h3>
<p><em>${option.description}</em></p>
<details>
<summary>📋 Copy Query</summary>
<pre><code>${JSON.stringify(option.query, null, 2)}</code></pre>
</details>
</div>
`).join('')}
</div>

<div style="background: #d1ecf1; border: 1px solid #bee5eb; border-radius: 6px; padding: 12px;">
<h3>💡 Web Interface Tips</h3>
<ul>
<li>Use the browser's find function (Ctrl/Cmd+F) to search results</li>
<li>Bookmark successful queries for future use</li>
<li>Consider exporting large datasets to CSV for analysis</li>
</ul>
</div>`;

    return {
      content: [{
        type: "text",
        text: guidanceText,
      }],
    };
  }

  private generateCLIGuidance(condition: string, options: any[]) {
    const guidanceText = `
=== SEARCH RESULTS TOO LARGE ===

Search: "${condition}" 
Status: Exceeded 1MB response limit
Action: Refine search parameters

REFINEMENT OPTIONS:
${options.map((option, i) => `
[${i + 1}] ${option.title}
    ${option.description}
    Command: ct_search_trials '${JSON.stringify(option.query)}'
`).join('')}

BEST PRACTICES:
  • Start with pageSize: 25-50 for initial exploration
  • Filter by phase: ["PHASE3"] for advanced trials
  • Use status filters: ["RECRUITING"] for active studies
  • Add sponsor filters for competitive analysis

USAGE:
  Copy any command above and run in your MCP client
  Example: mcp-client ct_search_trials '{"condition":"${condition}","pageSize":25}'
`;

    return {
      content: [{
        type: "text",
        text: guidanceText,
      }],
    };
  }

  private generateSlackGuidance(condition: string, options: any[]) {
    const guidanceText = `:warning: *Search Results Too Large*

Your search for *${condition}* returned over 1MB of data. Here are some refined options:

${options.map((option, i) => `
:point_right: *Option ${i + 1}: ${option.title}*
${option.description}
\`\`\`
${JSON.stringify(option.query, null, 2)}
\`\`\`
`).join('')}

:bulb: *Pro Tips for Clinical Trials Research:*
• Start small with pageSize: 20-30
• Focus on Phase III for market-ready drugs
• Filter by RECRUITING status for active trials
• Use sponsor filters to analyze competition

:point_up: Copy any JSON above and use with the clinical trials search tool!`;

    return {
      content: [{
        type: "text",
        text: guidanceText,
      }],
    };
  }

  // Individual API tool definitions
  private getClinicalTrialsTools(): Tool[] {
    return [
      {
        name: "ct_search_trials",
        description: "Search ClinicalTrials.gov for studies with AI-enhanced results",
        inputSchema: {
          type: "object",
          properties: {
            condition: { 
              type: "string", 
              description: "Medical condition (e.g., 'diabetes', 'cancer')" 
            },
            intervention: { 
              type: "string", 
              description: "Treatment or drug name" 
            },
            phase: { 
              type: "array", 
              items: { type: "string" },
              description: "Study phases (PHASE1, PHASE2, PHASE3, PHASE4)"
            },
            status: { 
              type: "array", 
              items: { type: "string" },
              description: "Study status (RECRUITING, COMPLETED, etc.)"
            },
            pageSize: { 
              type: "number", 
              default: 20,
              minimum: 1,
              maximum: 100
            },
          },
        },
      },
      {
        name: "ct_get_study",
        description: "Get detailed study information by NCT ID with AI analysis",
        inputSchema: {
          type: "object",
          properties: {
            nctId: { 
              type: "string", 
              pattern: "^NCT\\d{8}$",
              description: "NCT identifier (e.g., 'NCT04373031')"
            },
          },
          required: ["nctId"],
        },
      },
    ];
  }

  private getPubMedTools(): Tool[] {
    return [
      {
        name: "pm_search_papers",
        description: "Search PubMed for research papers with enhanced analysis",
        inputSchema: {
          type: "object",
          properties: {
            query: { 
              type: "string",
              description: "Search query (e.g., 'diabetes AND metformin')"
            },
            maxResults: { 
              type: "number", 
              default: 20,
              minimum: 1,
              maximum: 100
            },
            publicationTypes: { 
              type: "array", 
              items: { type: "string" },
              description: "Filter by publication types"
            },
            dateRange: { 
              type: "object",
              properties: {
                from: { type: "string", description: "Start date (YYYY-MM-DD)" },
                to: { type: "string", description: "End date (YYYY-MM-DD)" },
              },
            },
          },
          required: ["query"],
        },
      },
    ];
  }

  private getFDATools(): Tool[] {
    return [
      {
        name: "fda_search_drugs",
        description: "Search FDA drug database with safety analysis",
        inputSchema: {
          type: "object",
          properties: {
            drugName: { 
              type: "string",
              description: "Drug name to search for"
            },
            activeIngredient: { 
              type: "string",
              description: "Active ingredient name"
            },
            approvalStatus: { 
              type: "string",
              description: "Approval status filter"
            },
          },
        },
      },
      {
        name: "fda_adverse_events",
        description: "Get adverse event reports for a drug with analysis",
        inputSchema: {
          type: "object",
          properties: {
            drugName: { 
              type: "string",
              description: "Drug name to analyze"
            },
            dateRange: { 
              type: "object",
              properties: {
                from: { type: "string" },
                to: { type: "string" },
              },
            },
          },
          required: ["drugName"],
        },
      },
    ];
  }

  // 🔥 CROSS-API TOOLS - This is where the magic happens!
  private getCrossAPITools(): Tool[] {
    return [
      {
        name: "research_comprehensive_analysis",
        description: "Comprehensive analysis combining clinical trials, literature, and safety data",
        inputSchema: {
          type: "object",
          properties: {
            drugName: { 
              type: "string",
              description: "Drug name to analyze"
            },
            condition: { 
              type: "string",
              description: "Medical condition"
            },
            analysisDepth: { 
              type: "string", 
              enum: ["basic", "detailed", "comprehensive"],
              default: "detailed",
            },
            reportFormat: {
              type: "string",
              enum: ["summary", "detailed", "comprehensive", "modular"],
              default: "summary",
              description: "Format of the report output"
            },
            outputFormat: {
              type: "string",
              enum: ["json", "markdown", "structured", "executive"],
              default: "structured",
              description: "Output format for the report"
            },
            maxTokens: {
              type: "number",
              minimum: 500,
              maximum: 100000,
              default: 8000,
              description: "Maximum tokens for the response"
            },
          },
          required: ["drugName", "condition"],
        },
      },
      {
        name: "research_drug_safety_profile",
        description: "Complete drug safety analysis across clinical trials and FDA reports",
        inputSchema: {
          type: "object",
          properties: {
            drugName: { 
              type: "string",
              description: "Drug name to analyze"
            },
            includeTrials: { 
              type: "boolean", 
              default: true 
            },
            includeFDA: { 
              type: "boolean", 
              default: true 
            },
            timeframe: { 
              type: "string", 
              default: "5years" 
            },
          },
          required: ["drugName"],
        },
      },
      {
        name: "research_competitive_landscape",
        description: "Analyze competitive landscape across all databases",
        inputSchema: {
          type: "object",
          properties: {
            targetCondition: { 
              type: "string",
              description: "Target medical condition"
            },
            competitorDrugs: { 
              type: "array", 
              items: { type: "string" },
              description: "List of competitor drugs to analyze"
            },
            includeGlobal: { 
              type: "boolean", 
              default: true 
            },
          },
          required: ["targetCondition"],
        },
      },
      {
        name: "research_executive_summary",
        description: "Generate executive summary for drug/condition analysis (context-friendly)",
        inputSchema: {
          type: "object",
          properties: {
            drugName: { 
              type: "string",
              description: "Drug name to analyze"
            },
            condition: { 
              type: "string",
              description: "Medical condition"
            },
            maxTokens: {
              type: "number",
              minimum: 500,
              maximum: 3000,
              default: 2000,
              description: "Maximum tokens for the summary"
            },
          },
          required: ["drugName", "condition"],
        },
      },
      {
        name: "research_clinical_details",
        description: "Detailed clinical trials analysis for specific drug/condition",
        inputSchema: {
          type: "object",
          properties: {
            drugName: { 
              type: "string",
              description: "Drug name to analyze"
            },
            condition: { 
              type: "string",
              description: "Medical condition"
            },
            focusPhase: {
              type: "array",
              items: { 
                type: "string",
                enum: ["PHASE1", "PHASE2", "PHASE3", "PHASE4"]
              },
              description: "Focus on specific trial phases"
            },
            includeCompleted: {
              type: "boolean",
              default: true,
              description: "Include completed trials"
            },
            maxTokens: {
              type: "number",
              minimum: 1000,
              maximum: 15000,
              default: 8000,
              description: "Maximum tokens for the response"
            },
          },
          required: ["drugName", "condition"],
        },
      },
      {
        name: "research_literature_details",
        description: "Detailed literature analysis for specific drug/condition",
        inputSchema: {
          type: "object",
          properties: {
            drugName: { 
              type: "string",
              description: "Drug name to analyze"
            },
            condition: { 
              type: "string",
              description: "Medical condition"
            },
            timeframe: {
              type: "string",
              enum: ["1year", "3years", "5years", "all"],
              default: "3years",
              description: "Publication timeframe"
            },
            publicationTypes: {
              type: "array",
              items: { type: "string" },
              description: "Filter by publication types"
            },
            maxTokens: {
              type: "number",
              minimum: 1000,
              maximum: 15000,
              default: 8000,
              description: "Maximum tokens for the response"
            },
          },
          required: ["drugName", "condition"],
        },
      },
      {
        name: "research_safety_details",
        description: "Detailed safety and FDA analysis for specific drug",
        inputSchema: {
          type: "object",
          properties: {
            drugName: { 
              type: "string",
              description: "Drug name to analyze"
            },
            includeAdverseEvents: {
              type: "boolean",
              default: true,
              description: "Include adverse event analysis"
            },
            includeApprovals: {
              type: "boolean",
              default: true,
              description: "Include FDA approval information"
            },
            maxTokens: {
              type: "number",
              minimum: 1000,
              maximum: 15000,
              default: 8000,
              description: "Maximum tokens for the response"
            },
          },
          required: ["drugName"],
        },
      },
      {
        name: "research_market_details",
        description: "Detailed market and competitive analysis for specific drug/condition",
        inputSchema: {
          type: "object",
          properties: {
            drugName: { 
              type: "string",
              description: "Drug name to analyze"
            },
            condition: { 
              type: "string",
              description: "Medical condition"
            },
            includeCompetitors: {
              type: "boolean",
              default: true,
              description: "Include competitive analysis"
            },
            marketScope: {
              type: "string",
              enum: ["global", "us", "eu"],
              default: "global",
              description: "Market scope for analysis"
            },
            maxTokens: {
              type: "number",
              minimum: 1000,
              maximum: 15000,
              default: 8000,
              description: "Maximum tokens for the response"
            },
          },
          required: ["drugName", "condition"],
        },
      },
    ];
  }

  // Cross-API handlers - These provide unique value!
  public async handleCrossAPICall(name: string, args: any) {
    switch (name) {
      case "research_comprehensive_analysis":
        return await this.comprehensiveAnalysis(args);
      
      case "research_drug_safety_profile":
        return await this.drugSafetyProfile(args);
      
      case "research_competitive_landscape":
        return await this.competitiveLandscape(args);
      
      case "research_executive_summary":
        return await this.executiveSummary(args);
      
      case "research_clinical_details":
        return await this.clinicalDetails(args);
      
      case "research_literature_details":
        return await this.literatureDetails(args);
      
      case "research_safety_details":
        return await this.safetyDetails(args);
      
      case "research_market_details":
        return await this.marketDetails(args);
      
      default:
        throw new Error(`Unknown cross-API tool: ${name}`);
    }
  }

  private async comprehensiveAnalysis(args: any) {
    const { 
      drugName, 
      condition, 
      analysisDepth = 'detailed',
      reportFormat = 'summary',
      outputFormat = 'structured',
      maxTokens = 8000
    } = args;

    try {
      // Step 1: Get clinical trials
      const trials = await this.clinicalTrialsClient.searchStudies({
        query: { 
          intervention: drugName,
          condition: condition,
        },
        pageSize: 50,
      });

      // Step 2: Get related literature  
      const literature = await this.pubmedClient.searchPapers({
        query: `${drugName} AND ${condition}`,
        maxResults: 30,
      });

      // Step 3: Get FDA data
      const fdaData = await this.fdaClient.searchDrugs({
        drugName: drugName,
      });

      // Step 4: Cross-analyze using our service
      const analysis = await this.researchAnalyzer.comprehensiveAnalysis({
        drugName,
        condition,
        trials: trials.studies,
        literature: literature.papers,
        fdaData: fdaData.drugs,
        depth: analysisDepth,
      });

      // Generate output based on format preferences
      const formattedOutput = this.formatAnalysisOutput(
        analysis, 
        trials, 
        literature, 
        fdaData, 
        reportFormat, 
        outputFormat, 
        maxTokens
      );

      return {
        content: [{
          type: "text",
          text: formattedOutput,
        }],
      };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: `Error in comprehensive analysis: ${error.message}`,
        }],
        isError: true,
      };
    }
  }

  private async drugSafetyProfile(args: any) {
    try {
      const result = await this.drugSafetyService.generateSafetyProfile(args);
      return {
        content: [{
          type: "text",
          text: JSON.stringify(result, null, 2),
        }],
      };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: `Error in drug safety analysis: ${error.message}`,
        }],
        isError: true,
      };
    }
  }

  private async competitiveLandscape(args: any) {
    // Implementation for competitive landscape analysis
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          message: "Competitive landscape analysis",
          targetCondition: args.targetCondition,
          competitorDrugs: args.competitorDrugs,
          note: "Full implementation coming soon"
        }, null, 2),
      }],
    };
  }

  /**
   * Format analysis output based on user preferences
   */
  private formatAnalysisOutput(
    analysis: any, 
    trials: any, 
    literature: any, 
    fdaData: any, 
    reportFormat: string, 
    outputFormat: string, 
    maxTokens: number
  ): string {
    const data = {
      summary: analysis.executiveSummary,
      clinicalTrials: {
        total: trials.studies?.length || 0,
        byPhase: analysis.trialsByPhase,
        recruitment: analysis.recruitmentStatus,
      },
      literature: {
        total: literature.papers?.length || 0,
        keyFindings: analysis.literatureKeyFindings,
        publicationTrends: analysis.publicationTrends,
      },
      fdaStatus: {
        approvalStatus: analysis.approvalStatus,
        adverseEvents: analysis.adverseEventSummary,
      },
      insights: analysis.keyInsights,
      riskAssessment: analysis.riskProfile,
      marketOpportunity: analysis.marketAnalysis,
      nextSteps: analysis.recommendedActions,
    };

    // Apply report format filtering
    let filteredData = data;
    if (reportFormat === 'summary') {
      filteredData = {
        summary: data.summary,
        clinicalTrials: { 
          total: data.clinicalTrials.total,
          byPhase: {},
          recruitment: {}
        },
        literature: { 
          total: data.literature.total,
          keyFindings: [],
          publicationTrends: {}
        },
        fdaStatus: {
          approvalStatus: data.fdaStatus.approvalStatus,
          adverseEvents: data.fdaStatus.adverseEvents
        },
        insights: data.insights?.slice(0, 3) || [],
        riskAssessment: { level: data.riskAssessment?.level },
        marketOpportunity: data.marketOpportunity,
        nextSteps: data.nextSteps?.slice(0, 2) || [],
      };
    } else if (reportFormat === 'modular') {
      return this.generateModularReportMenu(data);
    }

    // Apply output format
    switch (outputFormat) {
      case 'markdown':
        return this.formatAsMarkdown(filteredData, reportFormat);
      case 'executive':
        return this.formatAsExecutive(filteredData);
      case 'structured':
        return this.formatAsStructured(filteredData);
      case 'json':
      default:
        return JSON.stringify(filteredData, null, 2);
    }
  }

  private generateModularReportMenu(data: any): string {
    return `# 📊 Modular Research Report Available

Your comprehensive analysis has been prepared! Choose a section to explore:

## 🎯 Executive Summary
\`\`\`
research_executive_summary
{
  "drugName": "${data.drugName || 'your_drug'}",
  "condition": "${data.condition || 'your_condition'}"
}
\`\`\`

## 🧪 Clinical Trials Analysis (${data.clinicalTrials?.total || 0} trials)
\`\`\`
research_clinical_details
{
  "drugName": "${data.drugName || 'your_drug'}",
  "condition": "${data.condition || 'your_condition'}"
}
\`\`\`

## 📚 Literature Analysis (${data.literature?.total || 0} papers)
\`\`\`
research_literature_details
{
  "drugName": "${data.drugName || 'your_drug'}",
  "condition": "${data.condition || 'your_condition'}"
}
\`\`\`

## ⚠️ Safety & FDA Analysis
\`\`\`
research_safety_details
{
  "drugName": "${data.drugName || 'your_drug'}"
}
\`\`\`

## 🏢 Market Analysis
\`\`\`
research_market_details
{
  "drugName": "${data.drugName || 'your_drug'}",
  "condition": "${data.condition || 'your_condition'}"
}
\`\`\`

Copy and run any section above to get detailed analysis!`;
  }

  private formatAsMarkdown(data: any, reportFormat: string): string {
    const level = reportFormat === 'summary' ? 'Summary' : 'Detailed';
    const clientType = this.clientInfo.type || 'unknown';
    
    // Add client-specific markdown optimizations
    const useCollapsibleSections = clientType === 'web' || clientType === 'desktop';
    const useCodeBlocks = clientType === 'vscode' || clientType === 'cursor';
    
    let content = `# ${level} Research Analysis

## Executive Summary
${data.summary || 'Analysis pending'}

## Clinical Trials Overview
- **Total Trials**: ${data.clinicalTrials?.total || 0}
- **Phase Distribution**: ${JSON.stringify(data.clinicalTrials?.byPhase || {})}

## Literature Overview  
- **Total Papers**: ${data.literature?.total || 0}
- **Key Findings**: ${data.literature?.keyFindings?.join(', ') || 'None identified'}

## Key Insights
${data.insights?.map((insight: string, i: number) => `${i + 1}. ${insight}`).join('\n') || 'No insights available'}

## Risk Assessment
**Level**: ${data.riskAssessment?.level || 'Unknown'}

## Next Steps
${data.nextSteps?.map((step: string, i: number) => `${i + 1}. ${step}`).join('\n') || 'No recommendations available'}`;

    // Add client-specific enhancements
    if (useCollapsibleSections) {
      content += `

<details>
<summary>📊 Detailed Analysis Options</summary>

Use these tools for deeper analysis:
- \`research_clinical_details\` - Full clinical trials breakdown
- \`research_literature_details\` - Comprehensive literature review  
- \`research_safety_details\` - Safety and FDA analysis
- \`research_market_details\` - Market positioning analysis

</details>`;
    }

    if (useCodeBlocks) {
      content += `

\`\`\`typescript
// Quick Actions for IDE users
const detailedAnalysis = {
  clinical: () => research_clinical_details({ drugName, condition }),
  literature: () => research_literature_details({ drugName, condition }),
  safety: () => research_safety_details({ drugName }),
  market: () => research_market_details({ drugName, condition })
};
\`\`\``;
    }

    return content;
  }

  private formatAsExecutive(data: any): string {
    return `# Executive Brief

${data.summary || 'Analysis summary not available'}

## Key Metrics
- Clinical Trials: ${data.clinicalTrials?.total || 0}
- Literature: ${data.literature?.total || 0} papers
- Risk Level: ${data.riskAssessment?.level || 'Unknown'}

## Priority Actions
${data.nextSteps?.slice(0, 3).map((step: string, i: number) => `${i + 1}. ${step}`).join('\n') || 'No immediate actions identified'}`;
  }

  private formatAsStructured(data: any): string {
    return `# Structured Research Analysis

## OVERVIEW
${data.summary || 'Summary not available'}

## CLINICAL DEVELOPMENT
Trials: ${data.clinicalTrials?.total || 0}
Status: ${JSON.stringify(data.clinicalTrials?.recruitment || {})}

## LITERATURE BASE  
Papers: ${data.literature?.total || 0}
Trends: ${JSON.stringify(data.literature?.publicationTrends || {})}

## FDA STATUS
${data.fdaStatus?.approvalStatus || 'Status unknown'}

## RISK PROFILE
${data.riskAssessment?.level || 'Assessment pending'}: ${data.riskAssessment?.factors?.join(', ') || 'No factors identified'}

## RECOMMENDATIONS
${data.nextSteps?.map((step: string, i: number) => `${i + 1}. ${step}`).join('\n') || 'No recommendations available'}`;
  }

  // Individual API handlers (delegate to respective clients)
  public async handleClinicalTrialsCall(name: string, args: any) {
    const toolName = name.replace('ct_', '');
    
    switch (toolName) {
      case 'search_trials':
        // Use the enhanced search with refinement support
        const searchResult = await this.clinicalTrialsClient.searchStudiesWithRefinement(args);
        
        if (searchResult.success) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify(searchResult.data, null, 2),
            }],
          };
        } else {
          // Return adaptive size limit guidance based on detected client
          return this.generateSizeLimitGuidance(args, searchResult.error, this.clientInfo.type || 'unknown');
        }
      
      case 'get_study':
        const study = await this.clinicalTrialsClient.getStudyById(args.nctId);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(study, null, 2),
          }],
        };
      
      default:
        throw new Error(`Unknown clinical trials tool: ${toolName}`);
    }
  }

  public async handlePubMedCall(name: string, args: any) {
    const toolName = name.replace('pm_', '');
    
    switch (toolName) {
      case 'search_papers':
        const papers = await this.pubmedClient.searchPapers(args);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(papers, null, 2),
          }],
        };
      
      default:
        throw new Error(`Unknown PubMed tool: ${toolName}`);
    }
  }

  public async handleFDACall(name: string, args: any) {
    const toolName = name.replace('fda_', '');
    
    switch (toolName) {
      case 'search_drugs':
        const drugs = await this.fdaClient.searchDrugs(args);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(drugs, null, 2),
          }],
        };
      
      case 'adverse_events':
        const events = await this.fdaClient.getAdverseEvents(args);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(events, null, 2),
          }],
        };
      
      default:
        throw new Error(`Unknown FDA tool: ${toolName}`);
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Medical Research MCP Suite running on stdio");
  }

  // New modular analysis handlers
  private async executiveSummary(args: any) {
    const { drugName, condition, maxTokens = 2000 } = args;

    try {
      // Get limited data for summary
      const trials = await this.clinicalTrialsClient.searchStudies({
        query: { intervention: drugName, condition },
        pageSize: 10,
      });

      const literature = await this.pubmedClient.searchPapers({
        query: `${drugName} AND ${condition}`,
        maxResults: 10,
      });

      const fdaData = await this.fdaClient.searchDrugs({ drugName });

      const analysis = await this.researchAnalyzer.comprehensiveAnalysis({
        drugName,
        condition,
        trials: trials.studies,
        literature: literature.papers,
        fdaData: fdaData.drugs,
        depth: 'basic',
      });

      const summary = `# Executive Summary: ${drugName} for ${condition}

${analysis.executiveSummary}

## Key Statistics
- **Clinical Trials**: ${trials.studies?.length || 0} active studies
- **Literature**: ${literature.papers?.length || 0} relevant publications  
- **FDA Status**: ${analysis.approvalStatus}
- **Risk Level**: ${analysis.riskProfile?.level || 'Assessment pending'}

## Top Insights
${analysis.keyInsights?.slice(0, 3).map((insight: string, i: number) => `${i + 1}. ${insight}`).join('\n') || 'Analysis in progress'}

## Immediate Next Steps
${analysis.recommendedActions?.slice(0, 2).map((action: string, i: number) => `${i + 1}. ${action}`).join('\n') || 'Recommendations pending'}

---
*For detailed analysis, use the specific section tools (research_clinical_details, research_literature_details, etc.)*`;

      return {
        content: [{ type: "text", text: summary }],
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `Error generating executive summary: ${error.message}` }],
        isError: true,
      };
    }
  }

  private async clinicalDetails(args: any) {
    const { drugName, condition, focusPhase, includeCompleted = true, maxTokens = 8000 } = args;

    try {
      const searchParams: any = {
        query: { intervention: drugName, condition },
        pageSize: 50,
      };

      if (focusPhase?.length > 0) {
        searchParams.filter = { phase: focusPhase };
      }

      if (!includeCompleted) {
        searchParams.filter = { 
          ...searchParams.filter, 
          overallStatus: ['RECRUITING', 'ACTIVE_NOT_RECRUITING', 'ENROLLING_BY_INVITATION'] 
        };
      }

      const trials = await this.clinicalTrialsClient.searchStudies(searchParams);

      const phaseDistribution = trials.studies?.reduce((acc: any, study: any) => {
        const phase = study.protocolSection?.designModule?.phases?.[0] || 'Unknown';
        acc[phase] = (acc[phase] || 0) + 1;
        return acc;
      }, {}) || {};

      const statusDistribution = trials.studies?.reduce((acc: any, study: any) => {
        const status = study.protocolSection?.statusModule?.overallStatus || 'Unknown';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {}) || {};

      const report = `# Clinical Trials Analysis: ${drugName} for ${condition}

## Overview
- **Total Trials Found**: ${trials.studies?.length || 0}
- **Search Parameters**: ${JSON.stringify(searchParams, null, 2)}

## Phase Distribution
${Object.entries(phaseDistribution).map(([phase, count]) => `- **${phase}**: ${count} trials`).join('\n')}

## Status Distribution  
${Object.entries(statusDistribution).map(([status, count]) => `- **${status}**: ${count} trials`).join('\n')}

## Key Trials
${trials.studies?.slice(0, 5).map((study: any, i: number) => {
  const nctId = study.protocolSection?.identificationModule?.nctId || 'Unknown';
  const title = study.protocolSection?.identificationModule?.briefTitle || 'No title';
  const status = study.protocolSection?.statusModule?.overallStatus || 'Unknown';
  const phase = study.protocolSection?.designModule?.phases?.[0] || 'Unknown';
  
  return `### ${i + 1}. ${nctId}
**Title**: ${title}
**Status**: ${status} | **Phase**: ${phase}`;
}).join('\n\n') || 'No trials found'}

---
*Use ct_get_study with specific NCT IDs for detailed trial information*`;

      return {
        content: [{ type: "text", text: report }],
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `Error generating clinical details: ${error.message}` }],
        isError: true,
      };
    }
  }

  private async literatureDetails(args: any) {
    const { drugName, condition, timeframe = '3years', publicationTypes, maxTokens = 8000 } = args;

    try {
      const timeframeMap: Record<string, number> = {
        '1year': 1,
        '3years': 3, 
        '5years': 5,
        'all': 0
      };

      const years = timeframeMap[timeframe] || 3;
      const searchParams: any = {
        query: `${drugName} AND ${condition}`,
        maxResults: 30,
      };

      if (years > 0) {
        const fromDate = new Date();
        fromDate.setFullYear(fromDate.getFullYear() - years);
        searchParams.dateRange = {
          from: fromDate.toISOString().split('T')[0]
        };
      }

      if (publicationTypes?.length > 0) {
        searchParams.publicationTypes = publicationTypes;
      }

      const literature = await this.pubmedClient.searchPapers(searchParams);

      const yearDistribution = literature.papers?.reduce((acc: any, paper: any) => {
        const year = paper.publicationDate?.split('-')[0] || 'Unknown';
        acc[year] = (acc[year] || 0) + 1;
        return acc;
      }, {}) || {};

      const journalDistribution = literature.papers?.reduce((acc: any, paper: any) => {
        const journal = paper.journal || 'Unknown';
        acc[journal] = (acc[journal] || 0) + 1;
        return acc;
      }, {}) || {};

      const topJournals = Object.entries(journalDistribution)
        .sort(([,a], [,b]) => (b as number) - (a as number))
        .slice(0, 5);

      const report = `# Literature Analysis: ${drugName} for ${condition}

## Overview
- **Total Papers Found**: ${literature.papers?.length || 0}
- **Timeframe**: ${timeframe} (${years > 0 ? `last ${years} years` : 'all time'})
- **Search Query**: ${searchParams.query}

## Publication Timeline
${Object.entries(yearDistribution)
  .sort(([a], [b]) => b.localeCompare(a))
  .slice(0, 5)
  .map(([year, count]) => `- **${year}**: ${count} publications`)
  .join('\n')}

## Top Journals
${topJournals.map(([journal, count], i) => `${i + 1}. **${journal}**: ${count} papers`).join('\n')}

## Recent Key Publications
${literature.papers?.slice(0, 5).map((paper: any, i: number) => {
  return `### ${i + 1}. ${paper.title || 'No title'}
**Authors**: ${paper.authors?.join(', ') || 'Unknown'}
**Journal**: ${paper.journal || 'Unknown'} (${paper.publicationDate || 'No date'})
**PMID**: ${paper.pmid || 'Unknown'}`;
}).join('\n\n') || 'No recent publications found'}

---
*Use pm_search_papers with more specific queries for targeted literature searches*`;

      return {
        content: [{ type: "text", text: report }],
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `Error generating literature details: ${error.message}` }],
        isError: true,
      };
    }
  }

  private async safetyDetails(args: any) {
    const { drugName, includeAdverseEvents = true, includeApprovals = true, maxTokens = 8000 } = args;

    try {
      const fdaData = await this.fdaClient.searchDrugs({ drugName });
      
      let adverseEvents = null;
      if (includeAdverseEvents) {
        try {
          adverseEvents = await this.fdaClient.getAdverseEvents({ drugName });
        } catch (error) {
          // Adverse events might not be available for all drugs
        }
      }

      const safetyProfile = await this.drugSafetyService.generateSafetyProfile({
        drugName,
        includeTrials: true,
        includeFDA: true,
        timeframe: '5years',
      });

      const report = `# Safety Analysis: ${drugName}

## FDA Approval Status
${includeApprovals ? `
**Approved Products**: ${fdaData.drugs?.length || 0}
**Status**: ${fdaData.drugs?.[0] ? 'FDA Approved' : 'Not FDA Approved'}
${fdaData.drugs?.map((drug: any, i: number) => `
### Product ${i + 1}
- **Brand Name**: ${drug.brand_name || 'Generic'}
- **Application Number**: ${drug.application_number || 'Unknown'}
- **Approval Date**: ${drug.submission_status_date || 'Unknown'}
`).join('') || ''}
` : 'Approval information excluded'}

## Adverse Events Profile
${includeAdverseEvents && adverseEvents ? `
**Total Reports**: ${adverseEvents.totalCount || 0}
**Serious Events**: ${adverseEvents.summary?.serious || 0}
**Fatal Reports**: ${adverseEvents.summary?.deaths || 0}

### Most Common Events
${adverseEvents.summary?.topEvents?.slice(0, 5).map((eventData: any, i: number) => `${i + 1}. ${eventData.event} (${eventData.count} reports)`).join('\n') || 'No common events identified'}

### Recent Events (Sample)
${adverseEvents.events?.slice(0, 3).map((event: any, i: number) => `- ${event.eventDescription} (${event.seriousness})`).join('\n') || 'No recent events available'}
` : 'Adverse event data not available or excluded'}

## Overall Safety Assessment
**Risk Level**: ${safetyProfile.overallRiskLevel || 'Assessment pending'}

## Safety Recommendations
${safetyProfile.recommendations?.monitoringRecommendations?.map((rec: string, i: number) => `${i + 1}. ${rec}`).join('\n') || 'No specific recommendations available'}

---
*Use fda_adverse_events for more detailed adverse event analysis*`;

      return {
        content: [{ type: "text", text: report }],
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `Error generating safety details: ${error.message}` }],
        isError: true,
      };
    }
  }

  private async marketDetails(args: any) {
    const { drugName, condition, includeCompetitors = true, marketScope = 'global', maxTokens = 8000 } = args;

    try {
      // Get competitive landscape data
      const trials = await this.clinicalTrialsClient.searchStudies({
        query: { condition },
        pageSize: 100,
      });

      const fdaData = await this.fdaClient.searchDrugs({ drugName });

      // Analyze sponsors/competitors
      const sponsorAnalysis = trials.studies?.reduce((acc: any, study: any) => {
        const sponsor = study.protocolSection?.sponsorCollaboratorsModule?.leadSponsor?.name || 'Unknown';
        if (!acc[sponsor]) {
          acc[sponsor] = { trials: 0, phases: new Set() };
        }
        acc[sponsor].trials += 1;
        const phase = study.protocolSection?.designModule?.phases?.[0];
        if (phase) acc[sponsor].phases.add(phase);
        return acc;
      }, {}) || {};

      const topSponsors = Object.entries(sponsorAnalysis)
        .sort(([,a], [,b]) => (b as any).trials - (a as any).trials)
        .slice(0, 10);

      const report = `# Market Analysis: ${drugName} for ${condition}

## Market Landscape (${marketScope.toUpperCase()})
- **Total Active Trials**: ${trials.studies?.length || 0} for ${condition}
- **Market Scope**: ${marketScope}
- **FDA Status**: ${fdaData.drugs?.length ? 'Market Approved' : 'Pre-Market'}

${includeCompetitors ? `
## Competitive Landscape

### Top 10 Active Sponsors/Competitors
${topSponsors.map(([sponsor, data]: [string, any], i: number) => `${i + 1}. **${sponsor}**
   - Trials: ${data.trials}
   - Phases: ${Array.from(data.phases).join(', ')}`).join('\n')}

### Market Position Analysis
${drugName === topSponsors[0]?.[0] ? 
  `🏆 **${drugName}** appears to be a market leader with the most active trials` :
  `📊 **${drugName}** is ${topSponsors.findIndex(([sponsor]) => sponsor.toLowerCase().includes(drugName.toLowerCase())) + 1 > 0 ? 
    `ranked #${topSponsors.findIndex(([sponsor]) => sponsor.toLowerCase().includes(drugName.toLowerCase())) + 1}` : 
    'not among the top 10 sponsors'} in active trial count`}

### Development Stage Distribution
${Object.values(sponsorAnalysis).reduce((acc: any, data: any) => {
  Array.from(data.phases).forEach((phase: any) => {
    acc[phase] = (acc[phase] || 0) + 1;
  });
  return acc;
}, {})}
` : 'Competitive analysis excluded'}

## Market Opportunity Assessment
- **Competition Level**: ${topSponsors.length > 5 ? 'High' : topSponsors.length > 2 ? 'Moderate' : 'Low'}
- **Development Activity**: ${trials.studies?.length || 0 > 50 ? 'Very Active' : 'Moderate'}
- **Market Maturity**: ${fdaData.drugs?.length ? 'Established' : 'Emerging'}

## Strategic Recommendations
1. ${trials.studies?.length || 0 > 20 ? 'Highly competitive market - differentiation strategy critical' : 'Moderate competition - opportunity for market entry'}
2. ${fdaData.drugs?.length ? 'Proven regulatory pathway available' : 'Pioneer market opportunity with regulatory risk'}
3. Focus on ${topSponsors.length > 0 ? `competing with ${topSponsors[0]?.[0]} (market leader)` : 'establishing market presence'}

---
*Use research_competitive_landscape for broader competitive analysis across multiple conditions*`;

      return {
        content: [{ type: "text", text: report }],
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `Error generating market details: ${error.message}` }],
        isError: true,
      };
    }
  }
}

// Start the unified server
const server = new MedicalResearchMCPServer();
server.run().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
