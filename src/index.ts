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
      
      default:
        throw new Error(`Unknown cross-API tool: ${name}`);
    }
  }

  private async comprehensiveAnalysis(args: any) {
    const { drugName, condition, analysisDepth } = args;

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

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            summary: analysis.executiveSummary,
            clinicalTrials: {
              total: trials.studies.length,
              byPhase: analysis.trialsByPhase,
              recruitment: analysis.recruitmentStatus,
            },
            literature: {
              total: literature.papers.length,
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
          }, null, 2),
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
          // Return refinement error for user interaction
          throw searchResult.error;
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
}

// Start the unified server
const server = new MedicalResearchMCPServer();
server.run().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
