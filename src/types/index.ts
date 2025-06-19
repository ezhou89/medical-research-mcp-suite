// src/types/index.ts

export * from './common.js';

// Re-export types from API modules
export type { 
  StudySearchParams, 
  Study, 
  SearchResponse 
} from '../apis/clinicalTrials.js';

export type { 
  PubMedSearchParams, 
  PubMedPaper, 
  PubMedSearchResponse 
} from '../apis/pubmed.js';

export type { 
  FDADrugSearchParams, 
  FDAAdverseEventParams, 
  FDADrug, 
  FDAAdverseEvent, 
  FDADrugSearchResponse, 
  FDAAdverseEventResponse 
} from '../apis/fda.js';

// Re-export service types
export type { 
  ResearchAnalysisParams, 
  ResearchAnalysisResult, 
  ServiceDependencies as ResearchServiceDependencies 
} from '../services/researchAnalyzer.js';

export type { 
  DrugSafetyParams, 
  DrugSafetyProfile, 
  ServiceDependencies as SafetyServiceDependencies 
} from '../services/drugSafety.js';

// Tool parameter types for MCP
export interface MCPToolParameters {
  // Clinical Trials tools
  ct_search_trials: {
    condition?: string;
    intervention?: string;
    phase?: string[];
    status?: string[];
    pageSize?: number;
  };
  
  ct_get_study: {
    nctId: string;
  };
  
  // PubMed tools
  pm_search_papers: {
    query: string;
    maxResults?: number;
    publicationTypes?: string[];
    dateRange?: {
      from?: string;
      to?: string;
    };
  };
  
  // FDA tools
  fda_search_drugs: {
    drugName?: string;
    activeIngredient?: string;
    approvalStatus?: string;
  };
  
  fda_adverse_events: {
    drugName: string;
    dateRange?: {
      from?: string;
      to?: string;
    };
  };
  
  // Cross-API research tools
  research_comprehensive_analysis: {
    drugName: string;
    condition: string;
    analysisDepth?: 'basic' | 'detailed' | 'comprehensive';
  };
  
  research_drug_safety_profile: {
    drugName: string;
    includeTrials?: boolean;
    includeFDA?: boolean;
    timeframe?: string;
  };
  
  research_competitive_landscape: {
    targetCondition: string;
    competitorDrugs?: string[];
    includeGlobal?: boolean;
  };
}

// MCP response types
export interface MCPToolResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}

// Tool categories for organization
export interface ToolCategory {
  name: string;
  description: string;
  tools: string[];
  icon?: string;
}

export const TOOL_CATEGORIES: ToolCategory[] = [
  {
    name: 'Clinical Trials',
    description: 'Search and analyze clinical trial data from ClinicalTrials.gov',
    tools: ['ct_search_trials', 'ct_get_study'],
    icon: '🏥',
  },
  {
    name: 'Research Literature',
    description: 'Discover and analyze scientific publications from PubMed',
    tools: ['pm_search_papers'],
    icon: '📚',
  },
  {
    name: 'Drug Safety',
    description: 'Access FDA drug approval and adverse event data',
    tools: ['fda_search_drugs', 'fda_adverse_events'],
    icon: '💊',
  },
  {
    name: 'Cross-Database Analysis',
    description: 'Comprehensive analysis combining multiple data sources',
    tools: [
      'research_comprehensive_analysis',
      'research_drug_safety_profile',
      'research_competitive_landscape',
    ],
    icon: '🔬',
  },
];

// Server configuration
export interface ServerConfig {
  name: string;
  version: string;
  description: string;
  capabilities: string[];
  supportedFormats: string[];
  maxRequestSize: number;
  timeout: number;
}

export const DEFAULT_SERVER_CONFIG: ServerConfig = {
  name: 'medical-research-suite',
  version: '1.0.0',
  description: 'AI-enhanced medical research MCP server',
  capabilities: [
    'clinical_trials_search',
    'literature_discovery',
    'drug_safety_analysis',
    'cross_database_correlation',
    'ai_enhanced_insights',
  ],
  supportedFormats: ['json', 'text'],
  maxRequestSize: 10 * 1024 * 1024, // 10MB
  timeout: 30000, // 30 seconds
};
