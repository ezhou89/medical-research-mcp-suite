// src/services/searchRefinementService.ts

import {
  RefinementOption,
  RefinementAction,
  RefinementContext,
  RefinementSuggestion,
  RefinementResult,
  UserRefinementChoice,
  ResponseSizeExceededError,
  RefinementResponse,
  SearchRefinementHistory,
  ClinicalTrialsRefinementOptions,
  PubMedRefinementOptions,
  RefinementConfig,
  MCPPromptTemplate,
  RefinementPromptArgs,
  PaginationPromptArgs,
  FieldSelectionPromptArgs
} from '../types/refinementTypes.js';
import { StudySearchParams } from '../apis/clinicalTrials.js';
import { ResponseSizeMonitor } from '../utils/responseSizeMonitor.js';

export class SearchRefinementService {
  private static instance: SearchRefinementService;
  private config: RefinementConfig;
  private refinementHistory: SearchRefinementHistory[] = [];
  private sizeMonitor: ResponseSizeMonitor;

  private constructor(config: Partial<RefinementConfig> = {}) {
    this.config = {
      enableAutoRefinement: true,
      maxRefinementAttempts: 3,
      defaultPageSize: 50,
      enableProgressiveLoading: true,
      enableUserFeedback: true,
      cacheRefinementHistory: true,
      refinementTimeoutMs: 30000,
      prioritizeRecentResults: true,
      enableSmartSuggestions: true,
      ...config
    };
    this.sizeMonitor = ResponseSizeMonitor.getInstance();
  }

  static getInstance(config?: Partial<RefinementConfig>): SearchRefinementService {
    if (!SearchRefinementService.instance) {
      SearchRefinementService.instance = new SearchRefinementService(config);
    }
    return SearchRefinementService.instance;
  }

  /**
   * Generate MCP prompt templates for user interaction
   */
  getMCPPromptTemplates(): MCPPromptTemplate[] {
    return [
      {
        name: 'search_refinement',
        description: 'Help users refine their search when results are too large',
        arguments: [
          {
            name: 'originalQuery',
            description: 'The original search query that produced too many results',
            required: true,
            type: 'string'
          },
          {
            name: 'api',
            description: 'The API being searched (clinicalTrials, pubmed, fda)',
            required: true,
            type: 'string'
          },
          {
            name: 'errorMessage',
            description: 'The error message explaining why refinement is needed',
            required: true,
            type: 'string'
          },
          {
            name: 'suggestedRefinements',
            description: 'Array of suggested refinement options',
            required: true,
            type: 'array'
          },
          {
            name: 'currentResultCount',
            description: 'Current number of results (if known)',
            required: false,
            type: 'number'
          },
          {
            name: 'canContinueWithoutRefinement',
            description: 'Whether the user can proceed without refinement',
            required: false,
            type: 'boolean'
          }
        ]
      },
      {
        name: 'progressive_loading',
        description: 'Offer progressive loading options for large result sets',
        arguments: [
          {
            name: 'totalResults',
            description: 'Total number of results available',
            required: true,
            type: 'number'
          },
          {
            name: 'pageSize',
            description: 'Number of results per page',
            required: true,
            type: 'number'
          },
          {
            name: 'currentPage',
            description: 'Current page number',
            required: true,
            type: 'number'
          },
          {
            name: 'loadingOptions',
            description: 'Available loading strategies',
            required: true,
            type: 'array'
          }
        ]
      },
      {
        name: 'field_selection',
        description: 'Help users select which fields to include to reduce response size',
        arguments: [
          {
            name: 'availableFields',
            description: 'List of available fields',
            required: true,
            type: 'array'
          },
          {
            name: 'currentFields',
            description: 'Currently selected fields',
            required: true,
            type: 'array'
          },
          {
            name: 'estimatedSizeReduction',
            description: 'Estimated size reduction percentage',
            required: true,
            type: 'number'
          },
          {
            name: 'fieldDescriptions',
            description: 'Descriptions of what each field contains',
            required: true,
            type: 'object'
          }
        ]
      }
    ];
  }

  /**
   * Analyze a size exceeded error and generate refinement suggestions
   */
  analyzeAndSuggestRefinements(
    originalQuery: any,
    api: string,
    actualSize: number,
    maxSize: number
  ): RefinementSuggestion {
    const refinementOptions: RefinementOption[] = [];

    // Generate API-specific refinement options
    if (api === 'clinicalTrials') {
      refinementOptions.push(...this.generateClinicalTrialsRefinements(originalQuery));
    } else if (api === 'pubmed') {
      refinementOptions.push(...this.generatePubMedRefinements(originalQuery));
    }

    // Add general refinement options
    refinementOptions.push(...this.generateGeneralRefinements(originalQuery, actualSize, maxSize));

    // Sort by priority
    refinementOptions.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    return {
      title: `Search Results Too Large (${this.sizeMonitor.formatSize(actualSize)})`,
      description: `Your search returned ${this.sizeMonitor.formatSize(actualSize)} of data, which exceeds the maximum allowed size of ${this.sizeMonitor.formatSize(maxSize)}. Please select one or more refinement options to narrow your search.`,
      options: refinementOptions,
      canContinueWithoutRefinement: actualSize < maxSize * 1.5, // Allow if not too far over
      alternativeActions: [
        'Load results in smaller batches',
        'Export results to a file for offline analysis',
        'Use more specific search terms',
        'Contact support for assistance with large datasets'
      ]
    };
  }

  /**
   * Generate Clinical Trials specific refinement options
   */
  private generateClinicalTrialsRefinements(query: StudySearchParams): RefinementOption[] {
    const options: RefinementOption[] = [];

    // Phase filters
    if (!query.filter?.phase || query.filter.phase.length === 0) {
      options.push({
        id: 'phase_3_only',
        label: 'Phase III Trials Only',
        description: 'Focus on Phase III clinical trials, which are typically the most relevant for clinical practice',
        action: {
          type: 'filter',
          parameters: { phase: ['PHASE3'] }
        },
        priority: 'high'
      });

      options.push({
        id: 'phase_2_3',
        label: 'Phase II & III Trials',
        description: 'Include Phase II and III trials, excluding early phase studies',
        action: {
          type: 'filter',
          parameters: { phase: ['PHASE2', 'PHASE3'] }
        },
        priority: 'medium'
      });
    }

    // Status filters
    if (!query.filter?.overallStatus || query.filter.overallStatus.length === 0) {
      options.push({
        id: 'active_recruiting',
        label: 'Active & Recruiting Trials',
        description: 'Show only trials that are currently active and recruiting participants',
        action: {
          type: 'filter',
          parameters: { overallStatus: ['ACTIVE_NOT_RECRUITING', 'RECRUITING'] }
        },
        priority: 'high'
      });

      options.push({
        id: 'completed_recent',
        label: 'Recently Completed Trials',
        description: 'Show completed trials from the last 2 years',
        action: {
          type: 'filter',
          parameters: { 
            overallStatus: ['COMPLETED'],
            dateRange: { from: new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString() }
          }
        },
        priority: 'medium'
      });
    }

    // Date range filters
    options.push({
      id: 'last_5_years',
      label: 'Last 5 Years',
      description: 'Include only trials started in the last 5 years',
      action: {
        type: 'date_range',
        parameters: {
          from: new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000).toISOString()
        }
      },
      priority: 'medium'
    });

    // Study type filters
    if (!query.filter?.studyType || query.filter.studyType.length === 0) {
      options.push({
        id: 'interventional_only',
        label: 'Interventional Studies Only',
        description: 'Focus on interventional studies (exclude observational studies)',
        action: {
          type: 'filter',
          parameters: { studyType: ['INTERVENTIONAL'] }
        },
        priority: 'medium'
      });
    }

    // Pagination options
    options.push({
      id: 'reduce_page_size',
      label: 'Load First 25 Results',
      description: 'Load the first 25 most relevant results with option to load more',
      action: {
        type: 'paginate',
        parameters: { pageSize: 25 }
      },
      priority: 'low'
    });

    return options;
  }

  /**
   * Generate PubMed specific refinement options
   */
  private generatePubMedRefinements(query: any): RefinementOption[] {
    const options: RefinementOption[] = [];

    // Publication type filters
    options.push({
      id: 'clinical_trials_only',
      label: 'Clinical Trials Only',
      description: 'Focus on clinical trial publications',
      action: {
        type: 'filter',
        parameters: { publicationType: ['Clinical Trial'] }
      },
      priority: 'high'
    });

    options.push({
      id: 'systematic_reviews',
      label: 'Systematic Reviews & Meta-Analyses',
      description: 'Show only systematic reviews and meta-analyses',
      action: {
        type: 'filter',
        parameters: { publicationType: ['Systematic Review', 'Meta-Analysis'] }
      },
      priority: 'high'
    });

    // Date range filters
    options.push({
      id: 'last_3_years',
      label: 'Last 3 Years',
      description: 'Include only publications from the last 3 years',
      action: {
        type: 'date_range',
        parameters: {
          from: new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000).toISOString()
        }
      },
      priority: 'medium'
    });

    // Language filters
    options.push({
      id: 'english_only',
      label: 'English Language Only',
      description: 'Include only English language publications',
      action: {
        type: 'filter',
        parameters: { language: ['English'] }
      },
      priority: 'medium'
    });

    return options;
  }

  /**
   * Generate general refinement options applicable to all APIs
   */
  private generateGeneralRefinements(query: any, actualSize: number, maxSize: number): RefinementOption[] {
    const options: RefinementOption[] = [];

    // Field selection
    options.push({
      id: 'essential_fields_only',
      label: 'Essential Fields Only',
      description: 'Include only the most important fields to reduce response size',
      action: {
        type: 'field_selection',
        parameters: { 
          fields: ['id', 'title', 'status', 'phase', 'conditions', 'interventions'] 
        }
      },
      priority: 'high'
    });

    // Pagination
    const recommendedPageSize = Math.floor(maxSize / (actualSize / (query.pageSize || 100)));
    options.push({
      id: 'progressive_loading',
      label: `Load ${recommendedPageSize} Results at a Time`,
      description: 'Load results in manageable chunks with option to continue',
      action: {
        type: 'paginate',
        parameters: { pageSize: Math.max(10, recommendedPageSize) }
      },
      priority: 'medium'
    });

    return options;
  }

  /**
   * Apply user-selected refinements to a query
   */
  applyRefinements(
    originalQuery: any,
    selectedRefinements: RefinementOption[],
    customParameters?: Record<string, any>
  ): RefinementResult {
    let refinedQuery = { ...originalQuery };
    const appliedRefinements: RefinementOption[] = [];

    try {
      for (const refinement of selectedRefinements) {
        refinedQuery = this.applyRefinementAction(refinedQuery, refinement.action);
        appliedRefinements.push(refinement);
      }

      // Apply custom parameters if provided
      if (customParameters) {
        refinedQuery = { ...refinedQuery, ...customParameters };
      }

      // Record in history
      if (this.config.cacheRefinementHistory) {
        this.refinementHistory.push({
          timestamp: new Date(),
          originalQuery,
          appliedRefinements,
          resultCount: 0, // Will be updated when results are fetched
          successful: true
        });
      }

      return {
        success: true,
        refinedQuery,
        appliedRefinements,
        estimatedResultCount: this.estimateResultCount(refinedQuery, appliedRefinements),
        message: `Applied ${appliedRefinements.length} refinement(s) to your search`,
        nextSteps: [
          'Execute the refined search',
          'Review results and apply additional refinements if needed',
          'Use progressive loading for large result sets'
        ]
      };
    } catch (error) {
      return {
        success: false,
        refinedQuery: originalQuery,
        appliedRefinements: [],
        estimatedResultCount: 0,
        message: `Failed to apply refinements: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Apply a single refinement action to a query
   */
  private applyRefinementAction(query: any, action: RefinementAction): any {
    const refinedQuery = { ...query };

    switch (action.type) {
      case 'filter':
        refinedQuery.filter = { ...refinedQuery.filter, ...action.parameters };
        break;
      case 'date_range':
        refinedQuery.dateRange = action.parameters;
        break;
      case 'paginate':
        refinedQuery.pageSize = action.parameters.pageSize;
        if (action.parameters.pageToken) {
          refinedQuery.pageToken = action.parameters.pageToken;
        }
        break;
      case 'field_selection':
        refinedQuery.fields = action.parameters.fields;
        break;
      case 'reduce_scope':
        // Apply scope reduction parameters
        Object.assign(refinedQuery, action.parameters);
        break;
    }

    return refinedQuery;
  }

  /**
   * Estimate result count based on applied refinements
   */
  private estimateResultCount(query: any, refinements: RefinementOption[]): number {
    // This is a simplified estimation - in a real implementation,
    // you might use historical data or API-specific estimation logic
    let baseEstimate = 1000;
    let reductionFactor = 1;

    for (const refinement of refinements) {
      switch (refinement.action.type) {
        case 'filter':
          reductionFactor *= 0.3; // Filters typically reduce by ~70%
          break;
        case 'date_range':
          reductionFactor *= 0.4; // Date ranges reduce by ~60%
          break;
        case 'paginate':
          return Math.min(baseEstimate * reductionFactor, query.pageSize || 50);
        case 'field_selection':
          // Field selection doesn't reduce count, just response size
          break;
      }
    }

    return Math.floor(baseEstimate * reductionFactor);
  }

  /**
   * Create a user-friendly error response for oversized results
   */
  createRefinementErrorResponse<T>(
    originalQuery: any,
    api: string,
    actualSize: number,
    maxSize: number
  ): RefinementResponse<T> {
    const suggestion = this.analyzeAndSuggestRefinements(originalQuery, api, actualSize, maxSize);

    return {
      success: false,
      error: new ResponseSizeExceededError(
        actualSize,
        maxSize,
        originalQuery,
        api,
        suggestion.options
      ),
      requiresUserInput: true,
      userPrompt: {
        type: 'refinement',
        message: suggestion.description,
        options: suggestion.options.map(option => ({
          id: option.id,
          label: option.label,
          description: option.description,
          priority: option.priority
        })),
        defaultChoice: suggestion.options[0]?.id
      },
      metadata: {
        originalSize: actualSize,
        processingTime: Date.now()
      }
    };
  }

  /**
   * Get refinement history for analytics
   */
  getRefinementHistory(): SearchRefinementHistory[] {
    return [...this.refinementHistory];
  }

  /**
   * Clear refinement history
   */
  clearRefinementHistory(): void {
    this.refinementHistory = [];
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RefinementConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): RefinementConfig {
    return { ...this.config };
  }
}