// src/apis/clinicalTrials.ts

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { queryEnhancer, EnhancedQuery, QueryContext } from '../utils/query-enhancer.js';
import { relevanceScorer, ScoredStudy, ScoringContext } from '../utils/relevance-scorer.js';
import { drugKnowledgeGraph } from '../utils/drug-knowledge-graph.js';

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

  // Enhanced search methods using intelligent query enhancement and relevance scoring
  async searchStudiesEnhanced(params: StudySearchParams, context?: QueryContext): Promise<{
    studies: ScoredStudy[];
    totalCount: number;
    nextPageToken?: string;
    queryInfo: EnhancedQuery;
  }> {
    // Enhance the query using intelligent expansion
    const enhancedQuery = queryEnhancer.enhanceQuery(params, context);
    
    // Search using enhanced parameters
    const searchResponse = await this.searchStudies(enhancedQuery.enhancedQuery);
    
    // Score results for relevance
    const scoringContext: ScoringContext = {
      primaryDrug: params.query?.intervention,
      primaryIndication: params.query?.condition,
      intent: context?.intent || 'general'
    };
    
    const scoredStudies = relevanceScorer.scoreStudies(searchResponse.studies, scoringContext);
    
    return {
      studies: scoredStudies,
      totalCount: searchResponse.totalCount,
      nextPageToken: searchResponse.nextPageToken,
      queryInfo: enhancedQuery
    };
  }

  async getCompetitiveLandscape(drug: string, indication?: string, maxResults: number = 100): Promise<{
    primaryDrug: ScoredStudy[];
    competitors: { [drugName: string]: ScoredStudy[] };
    marketOverview: {
      totalStudies: number;
      activeStudies: number;
      phaseDistribution: { [phase: string]: number };
      topSponsors: { [sponsor: string]: number };
    };
    insights: string[];
  }> {
    const results = {
      primaryDrug: [] as ScoredStudy[],
      competitors: {} as { [drugName: string]: ScoredStudy[] },
      marketOverview: {
        totalStudies: 0,
        activeStudies: 0,
        phaseDistribution: {} as { [phase: string]: number },
        topSponsors: {} as { [sponsor: string]: number }
      },
      insights: [] as string[]
    };

    // Search for primary drug
    const primaryParams: StudySearchParams = {
      query: { intervention: drug, condition: indication },
      pageSize: 50
    };
    
    const primaryResponse = await this.searchStudiesEnhanced(primaryParams, {
      intent: 'competitive_analysis',
      timeHorizon: 'current',
      stakeholder: 'pharma_company'
    });
    
    results.primaryDrug = primaryResponse.studies.slice(0, maxResults / 4);
    
    // Get competitors and search for each
    const competitors = drugKnowledgeGraph.getCompetitors(drug, indication);
    
    for (const competitor of competitors.slice(0, 5)) { // Limit to top 5 competitors
      const competitorParams: StudySearchParams = {
        query: { intervention: competitor, condition: indication },
        pageSize: 30
      };
      
      const competitorResponse = await this.searchStudiesEnhanced(competitorParams, {
        intent: 'competitive_analysis',
        timeHorizon: 'current',
        stakeholder: 'pharma_company'
      });
      
      results.competitors[competitor] = competitorResponse.studies.slice(0, 20);
    }
    
    // Calculate market overview
    const allStudies = [
      ...results.primaryDrug,
      ...Object.values(results.competitors).flat()
    ];
    
    results.marketOverview.totalStudies = allStudies.length;
    results.marketOverview.activeStudies = allStudies.filter(s => 
      ['RECRUITING', 'ACTIVE_NOT_RECRUITING'].includes(s.study.protocolSection.statusModule.overallStatus)
    ).length;
    
    // Phase distribution
    allStudies.forEach(s => {
      const phases = s.study.protocolSection.designModule?.phases || ['UNKNOWN'];
      phases.forEach(phase => {
        results.marketOverview.phaseDistribution[phase] = 
          (results.marketOverview.phaseDistribution[phase] || 0) + 1;
      });
    });
    
    // Top sponsors
    allStudies.forEach(s => {
      const sponsor = s.study.protocolSection.sponsorCollaboratorsModule?.leadSponsor?.name || 'Unknown';
      results.marketOverview.topSponsors[sponsor] = 
        (results.marketOverview.topSponsors[sponsor] || 0) + 1;
    });
    
    // Generate insights
    results.insights = this.generateCompetitiveInsights(results, drug);
    
    return results;
  }

  async getProgressiveSearchResults(params: StudySearchParams, context?: QueryContext): Promise<{
    immediate: ScoredStudy[];
    expanded: ScoredStudy[];
    competitive: ScoredStudy[];
    hasMore: boolean;
    totalFound: number;
  }> {
    const strategies = queryEnhancer.generateSearchStrategies(params);
    const results = {
      immediate: [] as ScoredStudy[],
      expanded: [] as ScoredStudy[],
      competitive: [] as ScoredStudy[],
      hasMore: false,
      totalFound: 0
    };
    
    const scoringContext: ScoringContext = {
      primaryDrug: params.query?.intervention,
      primaryIndication: params.query?.condition,
      intent: context?.intent || 'competitive_analysis'
    };
    
    // Execute search strategies with size limits to prevent 1MB response
    for (const strategy of strategies.slice(0, 3)) { // Limit to 3 strategies
      const limitedQuery = {
        ...strategy.enhancedQuery,
        pageSize: 15 // Small page size to control response size
      };
      
      try {
        const response = await this.searchStudies(limitedQuery);
        const scored = relevanceScorer.scoreStudies(response.studies, scoringContext);
        
        // Categorize results based on strategy
        switch (strategy.searchStrategy) {
          case 'exact':
          case 'expanded':
            results.immediate.push(...scored.slice(0, 10));
            break;
          case 'competitive':
            results.competitive.push(...scored.slice(0, 10));
            break;
          default:
            results.expanded.push(...scored.slice(0, 10));
        }
        
        results.totalFound += response.totalCount;
        results.hasMore = results.hasMore || !!response.nextPageToken;
        
      } catch (error) {
        console.warn(`Strategy ${strategy.searchStrategy} failed:`, error);
      }
    }
    
    // Deduplicate and sort by relevance
    const seenIds = new Set<string>();
    
    results.immediate = results.immediate
      .filter(s => {
        const id = s.study.protocolSection.identificationModule.nctId;
        if (seenIds.has(id)) return false;
        seenIds.add(id);
        return true;
      })
      .sort((a, b) => b.relevanceScore.score - a.relevanceScore.score)
      .slice(0, 15);
    
    results.expanded = results.expanded
      .filter(s => {
        const id = s.study.protocolSection.identificationModule.nctId;
        if (seenIds.has(id)) return false;
        seenIds.add(id);
        return true;
      })
      .sort((a, b) => b.relevanceScore.score - a.relevanceScore.score)
      .slice(0, 10);
    
    results.competitive = results.competitive
      .filter(s => {
        const id = s.study.protocolSection.identificationModule.nctId;
        if (seenIds.has(id)) return false;
        seenIds.add(id);
        return true;
      })
      .sort((a, b) => b.relevanceScore.score - a.relevanceScore.score)
      .slice(0, 10);
    
    return results;
  }

  private generateCompetitiveInsights(landscape: any, primaryDrug: string): string[] {
    const insights: string[] = [];
    
    // Market activity insight
    const totalStudies = landscape.marketOverview.totalStudies;
    const activeStudies = landscape.marketOverview.activeStudies;
    const activityRate = totalStudies > 0 ? (activeStudies / totalStudies * 100).toFixed(1) : '0';
    
    insights.push(`Market shows ${activityRate}% active development (${activeStudies}/${totalStudies} studies)`);
    
    // Phase distribution insight
    const phases = landscape.marketOverview.phaseDistribution;
    const phase3Studies = phases['PHASE3'] || 0;
    const phase2Studies = phases['PHASE2'] || 0;
    
    if (phase3Studies > phase2Studies) {
      insights.push(`Late-stage development dominates with ${phase3Studies} Phase 3 studies vs ${phase2Studies} Phase 2`);
    } else if (phase2Studies > phase3Studies * 2) {
      insights.push(`Early-stage pipeline is active with ${phase2Studies} Phase 2 studies`);
    }
    
    // Competitive landscape insight
    const competitorCount = Object.keys(landscape.competitors).length;
    const competitorStudies = Object.values(landscape.competitors).flat().length;
    
    if (competitorStudies > landscape.primaryDrug.length) {
      insights.push(`Competitive pressure is high: ${competitorCount} competitors with ${competitorStudies} studies vs ${landscape.primaryDrug.length} for ${primaryDrug}`);
    }
    
    // Sponsor concentration insight
    const sponsors = landscape.marketOverview.topSponsors;
    const topSponsor = Object.entries(sponsors).sort(([,a], [,b]) => (b as number) - (a as number))[0];
    
    if (topSponsor && (topSponsor[1] as number) > 3) {
      insights.push(`${topSponsor[0]} leads development with ${topSponsor[1]} studies`);
    }
    
    return insights.slice(0, 4); // Limit to 4 key insights
  }
}
