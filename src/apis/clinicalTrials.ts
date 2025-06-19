// src/apis/clinicalTrials.ts

import axios, { AxiosInstance, AxiosResponse } from 'axios';

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

export class ClinicalTrialsClient {
  private axios: AxiosInstance;
  private readonly baseURL = 'https://clinicaltrials.gov/api/v2';
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly cacheTimeout = 3600000; // 1 hour

  constructor() {
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
        console.error('ClinicalTrials API Error:', error.response?.data || error.message);
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

      // Cache the result
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now(),
      });

      return result;
    } catch (error) {
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

    do {
      const searchParams = { ...params, pageToken };
      const response = await this.searchStudies(searchParams);
      
      allStudies.push(...response.studies);
      pageToken = response.nextPageToken;
      pagesProcessed++;
      
      // Prevent infinite loops
      if (pagesProcessed >= maxPages) {
        console.warn(`Reached maximum page limit (${maxPages}). Stopping pagination.`);
        break;
      }
      
    } while (pageToken);

    return allStudies;
  }

  clearCache(): void {
    this.cache.clear();
  }
}
