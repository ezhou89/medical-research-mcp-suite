// src/apis/clinicalTrials.ts

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { ResponseSizeMonitor } from '../utils/responseSizeMonitor.js';
import { SearchRefinementService } from '../services/searchRefinementService.js';
import { RefinementResponse, ResponseSizeExceededError, RefinementError } from '../types/refinementTypes.js';

export interface StudySearchParams {
  query?: {
    condition?: string;
    intervention?: string;
    title?: string;
    sponsor?: string;
    location?: string;
    ids?: string[];
  };
  filter?: {
    overallStatus?: string[];
    phase?: string[];
    studyType?: string[];
    results?: 'with' | 'without';
  };
  sort?: {
    field: string;
    direction: 'asc' | 'desc';
  }[];
  pageSize?: number;
  pageToken?: string;
  fields?: string[];
}

export interface Study {
  protocolSection: {
    identificationModule: {
      nctId: string;
      orgStudyIdInfo: {
        id: string;
      };
      briefTitle: string;
      officialTitle?: string;
    };
    statusModule: {
      overallStatus: string;
      startDateStruct?: {
        date: string;
        type: string;
      };
      completionDateStruct?: {
        date: string;
        type: string;
      };
    };
    conditionsModule?: {
      conditions: string[];
    };
    interventionsModule?: {
      interventions: Array<{
        type: string;
        name: string;
        description?: string;
      }>;
    };
    eligibilityModule?: {
      eligibilityCriteria?: string;
      healthyVolunteers?: boolean;
      sex?: string;
      minimumAge?: string;
      maximumAge?: string;
    };
    designModule?: {
      studyType: string;
      phases?: string[];
      designInfo?: {
        allocation?: string;
        interventionModel?: string;
        primaryPurpose?: string;
        maskingInfo?: {
          masking: string;
        };
      };
    };
    outcomesModule?: {
      primaryOutcomes?: Array<{
        measure: string;
        description?: string;
        timeFrame?: string;
      }>;
      secondaryOutcomes?: Array<{
        measure: string;
        description?: string;
        timeFrame?: string;
      }>;
    };
    sponsorCollaboratorsModule?: {
      leadSponsor?: {
        name: string;
      };
    };
  };
}

export interface SearchResponse {
  studies: Study[];
  totalCount: number;
  nextPageToken?: string;
}

export interface EnhancedSearchResponse extends SearchResponse {
  sizeMetrics?: {
    responseSize: number;
    estimatedMemoryUsage: number;
    truncated: boolean;
    truncationSummary?: string;
  };
  refinementSuggestions?: Array<{
    id: string;
    label: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
  }>;
}

export class ClinicalTrialsClient {
  private axios: AxiosInstance;
  private readonly baseURL = 'https://clinicaltrials.gov/api/v2';
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly cacheTimeout = 3600000; // 1 hour
  private sizeMonitor: ResponseSizeMonitor;
  private refinementService: SearchRefinementService;
  private enableSizeMonitoring: boolean = true;

  constructor(options: { enableSizeMonitoring?: boolean } = {}) {
    this.enableSizeMonitoring = options.enableSizeMonitoring ?? true;
    this.sizeMonitor = ResponseSizeMonitor.getInstance();
    this.refinementService = SearchRefinementService.getInstance();
    
    this.axios = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'User-Agent': 'Medical-Research-MCP-Suite/1.0.0',
        'Accept': 'application/json',
      },
    });

    // Add response interceptor for error handling
    this.axios.interceptors.response.use(
      (response) => response,
      (error) => {
        // ClinicalTrials API error occurred
        throw new Error(`ClinicalTrials API Error: ${error.response?.status || 'Unknown'}`);
      }
    );
  }

  private getCacheKey(params: any): string {
    return JSON.stringify(params);
  }

  private isValidCache(timestamp: number): boolean {
    return Date.now() - timestamp < this.cacheTimeout;
  }

  private buildQueryParams(params: StudySearchParams): URLSearchParams {
    const searchParams = new URLSearchParams();

    // Add query parameters
    if (params.query) {
      if (params.query.condition) {
        searchParams.append('query.cond', params.query.condition);
      }
      if (params.query.intervention) {
        searchParams.append('query.intr', params.query.intervention);
      }
      if (params.query.title) {
        searchParams.append('query.titles', params.query.title);
      }
      if (params.query.sponsor) {
        searchParams.append('query.spons', params.query.sponsor);
      }
      if (params.query.location) {
        searchParams.append('query.locn', params.query.location);
      }
      if (params.query.ids) {
        searchParams.append('query.id', params.query.ids.join(','));
      }
    }

    // Add filters
    if (params.filter) {
      if (params.filter.overallStatus) {
        searchParams.append('filter.overallStatus', params.filter.overallStatus.join(','));
      }
      if (params.filter.phase) {
        searchParams.append('filter.phase', params.filter.phase.join(','));
      }
      if (params.filter.studyType) {
        searchParams.append('filter.studyType', params.filter.studyType.join(','));
      }
      if (params.filter.results) {
        searchParams.append('filter.hasResults', params.filter.results === 'with' ? 'true' : 'false');
      }
    }

    // Add sorting
    if (params.sort) {
      const sortString = params.sort
        .map(s => `${s.field}:${s.direction}`)
        .join(',');
      searchParams.append('sort', sortString);
    }

    // Add pagination
    if (params.pageSize) {
      searchParams.append('pageSize', params.pageSize.toString());
    }
    if (params.pageToken) {
      searchParams.append('pageToken', params.pageToken);
    }

    // Add fields selection
    if (params.fields && params.fields.length > 0) {
      searchParams.append('fields', params.fields.join(','));
    }

    return searchParams;
  }

  async searchStudies(params: StudySearchParams): Promise<SearchResponse> {
    const cacheKey = this.getCacheKey(params);
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && this.isValidCache(cached.timestamp)) {
      return cached.data;
    }

    const queryParams = this.buildQueryParams(params);
    
    try {
      const response: AxiosResponse = await this.axios.get('/studies', {
        params: queryParams,
      });

      const result = {
        studies: response.data.studies || [],
        totalCount: response.data.totalCount || 0,
        nextPageToken: response.data.nextPageToken,
      };

      // Check response size if monitoring is enabled
      if (this.enableSizeMonitoring) {
        const sizeCheck = this.sizeMonitor.checkSizeLimit(result, 'clinicalTrials-search');
        
        if (!sizeCheck.withinLimit && sizeCheck.exceededInfo) {
          // Response is too large, throw refinement error
          throw new ResponseSizeExceededError(
            sizeCheck.exceededInfo.actualSize,
            sizeCheck.exceededInfo.maxSize,
            params,
            'clinicalTrials',
            this.refinementService.analyzeAndSuggestRefinements(
              params,
              'clinicalTrials',
              sizeCheck.exceededInfo.actualSize,
              sizeCheck.exceededInfo.maxSize
            ).options
          );
        }
      }

      // Cache the result
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now(),
      });

      return result;
    } catch (error) {
      // Check if this is a refinement error and preserve it
      if (error instanceof ResponseSizeExceededError) {
        throw error;
      }
      throw new Error(`Failed to search studies: ${error}`);
    }
  }

  async getStudyById(nctId: string): Promise<Study | null> {
    const cacheKey = `study_${nctId}`;
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && this.isValidCache(cached.timestamp)) {
      return cached.data;
    }

    try {
      const response: AxiosResponse = await this.axios.get(`/studies/${nctId}`);
      
      const study = response.data.studies?.[0] || null;
      
      // Cache the result
      this.cache.set(cacheKey, {
        data: study,
        timestamp: Date.now(),
      });

      return study;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw new Error(`Failed to get study ${nctId}: ${error}`);
    }
  }

  async getAllPages(params: StudySearchParams, maxPages: number = 10): Promise<Study[]> {
    const allStudies: Study[] = [];
    let pageToken: string | undefined = params.pageToken;
    let pagesProcessed = 0;
    let accumulatedSize = 0;

    do {
      const searchParams = { ...params, pageToken };
      
      try {
        const response = await this.searchStudies(searchParams);
        
        // Check accumulated size if monitoring is enabled
        if (this.enableSizeMonitoring) {
          const newSize = this.sizeMonitor.calculateSize(response.studies);
          accumulatedSize += newSize;
          
          // Check if adding this page would exceed size limits
          if (accumulatedSize > this.sizeMonitor.getConfig().maxResponseSize) {
            // Accumulated response size exceeds limits
            break;
          }
        }
        
        allStudies.push(...response.studies);
        pageToken = response.nextPageToken;
        pagesProcessed++;
        
        // Prevent infinite loops
        if (pagesProcessed >= maxPages) {
          // Reached maximum page limit
          break;
        }
        
      } catch (error) {
        // If we hit a size limit error during pagination, return what we have
        if (error instanceof ResponseSizeExceededError) {
          // Size limit reached during pagination
          break;
        }
        throw error;
      }
      
    } while (pageToken);

    return allStudies;
  }

  /**
   * Search with enhanced response including size metrics and refinement suggestions
   */
  async searchStudiesWithRefinement(params: StudySearchParams): Promise<RefinementResponse<SearchResponse>> {
    try {
      const result = await this.searchStudies(params);
      
      // Calculate size metrics
      const sizeCheck = this.sizeMonitor.checkSizeLimit(result, 'clinicalTrials-search');
      
      return {
        success: true,
        data: result,
        metadata: {
          originalSize: sizeCheck.metrics.responseSize,
          processedSize: sizeCheck.metrics.responseSize,
          truncated: sizeCheck.metrics.truncated,
          processingTime: Date.now()
        }
      };
    } catch (error) {
      if (error instanceof ResponseSizeExceededError) {
        return this.refinementService.createRefinementErrorResponse(
          params,
          'clinicalTrials',
          error.refinementContext.actualSize,
          error.refinementContext.maxAllowedSize
        );
      }
      
      // Create a proper RefinementError for non-refinement errors
      const refinementError = error instanceof RefinementError ? error : 
        new RefinementError(
          error instanceof Error ? error.message : 'Unknown error occurred',
          'SEARCH_ERROR',
          {
            originalQuery: params,
            api: 'clinicalTrials',
            errorType: 'api_error',
            maxAllowedSize: this.sizeMonitor.getConfig().maxResponseSize,
            actualSize: 0,
            suggestedRefinements: []
          },
          false
        );
        
      return {
        success: false,
        error: refinementError,
        requiresUserInput: false
      };
    }
  }

  /**
   * Get a sample of studies for preview purposes
   */
  async getStudiesSample(params: StudySearchParams, sampleSize: number = 10): Promise<SearchResponse> {
    const sampleParams = { ...params, pageSize: sampleSize };
    return this.searchStudies(sampleParams);
  }

  /**
   * Progressive loading with size monitoring
   */
  async loadStudiesProgressively(
    params: StudySearchParams,
    onBatch: (studies: Study[], isLast: boolean) => void,
    maxPages: number = 10
  ): Promise<{ totalLoaded: number; stoppedDueToSize: boolean }> {
    let totalLoaded = 0;
    let pageToken: string | undefined = params.pageToken;
    let pagesProcessed = 0;
    let accumulatedSize = 0;
    let stoppedDueToSize = false;

    do {
      const searchParams = { ...params, pageToken };
      
      try {
        const response = await this.searchStudies(searchParams);
        
        // Check accumulated size
        if (this.enableSizeMonitoring) {
          const newSize = this.sizeMonitor.calculateSize(response.studies);
          accumulatedSize += newSize;
          
          if (accumulatedSize > this.sizeMonitor.getConfig().maxResponseSize) {
            stoppedDueToSize = true;
            break;
          }
        }
        
        const isLast = !response.nextPageToken || pagesProcessed >= maxPages - 1;
        onBatch(response.studies, isLast);
        
        totalLoaded += response.studies.length;
        pageToken = response.nextPageToken;
        pagesProcessed++;
        
      } catch (error) {
        if (error instanceof ResponseSizeExceededError) {
          stoppedDueToSize = true;
          break;
        }
        throw error;
      }
      
    } while (pageToken && pagesProcessed < maxPages);

    return { totalLoaded, stoppedDueToSize };
  }

  /**
   * Enable or disable size monitoring
   */
  setSizeMonitoring(enabled: boolean): void {
    this.enableSizeMonitoring = enabled;
  }

  /**
   * Get size monitoring configuration
   */
  getSizeMonitoringConfig() {
    return this.sizeMonitor.getConfig();
  }

  /**
   * Update size monitoring configuration
   */
  updateSizeMonitoringConfig(config: any): void {
    this.sizeMonitor.updateConfig(config);
  }

  clearCache(): void {
    this.cache.clear();
  }
}
