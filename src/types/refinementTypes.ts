// src/types/refinementTypes.ts

export interface RefinementOption {
  id: string;
  label: string;
  description: string;
  action: RefinementAction;
  estimatedResultCount?: number;
  priority: 'high' | 'medium' | 'low';
}

export interface RefinementAction {
  type: 'filter' | 'reduce_scope' | 'paginate' | 'field_selection' | 'date_range';
  parameters: Record<string, any>;
  apiSpecific?: {
    clinicalTrials?: Record<string, any>;
    pubmed?: Record<string, any>;
    fda?: Record<string, any>;
  };
}

export interface RefinementContext {
  originalQuery: any;
  api: 'clinicalTrials' | 'pubmed' | 'fda' | 'multi-api';
  errorType: 'size_exceeded' | 'timeout' | 'rate_limit' | 'api_error';
  currentResultCount?: number;
  maxAllowedSize: number;
  actualSize: number;
  suggestedRefinements: RefinementOption[];
}

export interface RefinementSuggestion {
  title: string;
  description: string;
  options: RefinementOption[];
  canContinueWithoutRefinement: boolean;
  alternativeActions: string[];
}

export interface ProgressiveLoadingConfig {
  pageSize: number;
  maxPages: number;
  loadingStrategy: 'sequential' | 'priority_based' | 'user_controlled';
  autoLoad: boolean;
  showProgress: boolean;
}

export interface RefinementResult {
  success: boolean;
  refinedQuery: any;
  appliedRefinements: RefinementOption[];
  estimatedResultCount: number;
  message: string;
  nextSteps?: string[];
}

export interface UserRefinementChoice {
  selectedOptions: string[]; // IDs of selected refinement options
  customParameters?: Record<string, any>;
  loadingPreference?: 'all' | 'progressive' | 'sample';
  additionalInstructions?: string;
}

// Extended error types for refinement scenarios
export class RefinementError extends Error {
  public readonly code: string;
  public readonly refinementContext: RefinementContext;
  public readonly isRecoverable: boolean;
  public readonly timestamp: Date;

  constructor(
    message: string,
    code: string,
    refinementContext: RefinementContext,
    isRecoverable: boolean = true
  ) {
    super(message);
    this.name = 'RefinementError';
    this.code = code;
    this.refinementContext = refinementContext;
    this.isRecoverable = isRecoverable;
    this.timestamp = new Date();
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      refinementContext: this.refinementContext,
      isRecoverable: this.isRecoverable,
      timestamp: this.timestamp.toISOString()
    };
  }
}

export class ResponseSizeExceededError extends RefinementError {
  constructor(
    actualSize: number,
    maxSize: number,
    originalQuery: any,
    api: string,
    suggestedRefinements: RefinementOption[]
  ) {
    const context: RefinementContext = {
      originalQuery,
      api: api as any,
      errorType: 'size_exceeded',
      maxAllowedSize: maxSize,
      actualSize,
      suggestedRefinements
    };

    super(
      `Response size ${actualSize} bytes exceeds maximum allowed size of ${maxSize} bytes`,
      'RESPONSE_SIZE_EXCEEDED',
      context,
      true
    );
  }
}

// MCP Prompt interfaces for user interaction
export interface MCPPromptTemplate {
  name: string;
  description: string;
  arguments: Array<{
    name: string;
    description: string;
    required: boolean;
    type: string;
  }>;
}

export interface RefinementPromptArgs {
  originalQuery: string;
  api: string;
  errorMessage: string;
  currentResultCount?: number;
  maxAllowedSize: number;
  actualSize: number;
  suggestedRefinements: RefinementOption[];
  canContinueWithoutRefinement: boolean;
}

export interface PaginationPromptArgs {
  totalResults: number;
  pageSize: number;
  currentPage: number;
  totalPages: number;
  hasMore: boolean;
  loadingOptions: string[];
}

export interface FieldSelectionPromptArgs {
  availableFields: string[];
  currentFields: string[];
  estimatedSizeReduction: number;
  fieldDescriptions: Record<string, string>;
}

// Response wrapper for refinement interactions
export interface RefinementResponse<T> {
  success: boolean;
  data?: T;
  error?: RefinementError;
  requiresUserInput?: boolean;
  userPrompt?: {
    type: 'refinement' | 'pagination' | 'field_selection' | 'confirmation';
    message: string;
    options: any[];
    defaultChoice?: string;
  };
  metadata?: {
    originalSize?: number;
    processedSize?: number;
    truncated?: boolean;
    truncationSummary?: string;
    processingTime?: number;
    cacheKey?: string;
  };
}

// Utility types for search refinement
export interface SearchRefinementHistory {
  timestamp: Date;
  originalQuery: any;
  appliedRefinements: RefinementOption[];
  resultCount: number;
  successful: boolean;
  userFeedback?: 'helpful' | 'not_helpful' | 'partially_helpful';
}

export interface RefinementAnalytics {
  totalRefinements: number;
  successRate: number;
  mostCommonRefinements: string[];
  averageResultReduction: number;
  userSatisfactionScore: number;
  apiSpecificMetrics: Record<string, any>;
}

// Clinical Trials specific refinement types
export interface ClinicalTrialsRefinementOptions {
  phases: string[];
  statuses: string[];
  studyTypes: string[];
  dateRanges: Array<{
    label: string;
    from: string;
    to: string;
  }>;
  locationFilters: string[];
  sponsorTypes: string[];
  interventionTypes: string[];
}

// PubMed specific refinement types
export interface PubMedRefinementOptions {
  publicationTypes: string[];
  dateRanges: Array<{
    label: string;
    from: string;
    to: string;
  }>;
  journals: string[];
  languages: string[];
  studyTypes: string[];
  meshTerms: string[];
}

// Configuration for the refinement system
export interface RefinementConfig {
  enableAutoRefinement: boolean;
  maxRefinementAttempts: number;
  defaultPageSize: number;
  enableProgressiveLoading: boolean;
  enableUserFeedback: boolean;
  cacheRefinementHistory: boolean;
  refinementTimeoutMs: number;
  prioritizeRecentResults: boolean;
  enableSmartSuggestions: boolean;
}