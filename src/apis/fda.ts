// src/apis/fda.ts

import axios, { AxiosInstance } from 'axios';
import { ResponseSizeMonitor } from '../utils/responseSizeMonitor.js';
import { SearchRefinementService } from '../services/searchRefinementService.js';

export interface FDADrugSearchParams {
  drugName?: string;
  activeIngredient?: string;
  approvalStatus?: string;
  limit?: number;
}

export interface FDAAdverseEventParams {
  drugName: string;
  dateRange?: {
    from?: string;
    to?: string;
  };
  limit?: number;
}

export interface FDADrug {
  applicationNumber: string;
  sponsorName: string;
  brandName?: string;
  genericName?: string;
  activeIngredients: Array<{
    name: string;
    strength: string;
  }>;
  approvalDate: string;
  approvalStatus: string;
  indication: string;
  dosageForm: string;
  route: string;
}

export interface FDAAdverseEvent {
  reportId: string;
  drugName: string;
  eventDate: string;
  eventDescription: string;
  seriousness: string;
  outcome: string;
  patientAge?: number;
  patientSex?: string;
  reporterType: string;
}

export interface FDADrugSearchResponse {
  drugs: FDADrug[];
  totalCount: number;
}

export interface FDAAdverseEventResponse {
  events: FDAAdverseEvent[];
  totalCount: number;
  summary: {
    total: number;
    serious: number;
    hospitalizations: number;
    deaths: number;
    topEvents: Array<{
      event: string;
      count: number;
    }>;
  };
}

export class FDAClient {
  private axios: AxiosInstance;
  private readonly baseURL = 'https://api.fda.gov';
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly cacheTimeout = 3600000; // 1 hour
  private readonly apiKey?: string;
  private sizeMonitor: ResponseSizeMonitor;
  private refinementService: SearchRefinementService;
  private enableSizeMonitoring: boolean = true;

  constructor() {
    this.apiKey = process.env.FDA_API_KEY;
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
        // FDA API error occurred
        throw new Error(`FDA API Error: ${error.response?.status || 'Unknown'}`);
      }
    );
  }

  private getCacheKey(params: any): string {
    return `fda_${JSON.stringify(params)}`;
  }

  private isValidCache(timestamp: number): boolean {
    return Date.now() - timestamp < this.cacheTimeout;
  }

  async searchDrugs(params: FDADrugSearchParams): Promise<FDADrugSearchResponse> {
    const cacheKey = this.getCacheKey({ ...params, endpoint: 'drugs' });
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && this.isValidCache(cached.timestamp)) {
      return cached.data;
    }

    let searchQuery = '*'; // Declare outside try block

    try {
      // Build search query
      const searchTerms: string[] = [];
      
      if (params.drugName) {
        // Search both brand and generic names
        searchTerms.push(`(openfda.brand_name:"${params.drugName}"+OR+openfda.generic_name:"${params.drugName}"+OR+products.brand_name:"${params.drugName}"+OR+products.generic_name:"${params.drugName}")`);
      }
      
      if (params.activeIngredient) {
        // Try multiple field patterns for active ingredient search
        searchTerms.push(`products.active_ingredients.name:"${params.activeIngredient}"`);
      }
      
      if (params.approvalStatus) {
        searchTerms.push(`approval_status:"${params.approvalStatus}"`);
      }

      searchQuery = searchTerms.length > 0 ? searchTerms.join('+AND+') : '*';
      
      // FDA search query constructed
      
      const searchParams = new URLSearchParams();
      searchParams.append('search', searchQuery);
      searchParams.append('limit', (params.limit || 20).toString());
      
      if (this.apiKey) {
        searchParams.append('api_key', this.apiKey);
      }

      // FDA API request prepared
      
      const response = await this.axios.get('/drug/drugsfda.json', {
        params: searchParams,
      });

      const results = response.data.results || [];
      const drugs = results.map((drug: any) => this.transformDrug(drug));

      const result = {
        drugs,
        totalCount: response.data.meta?.results?.total || drugs.length,
      };

      // Check response size if monitoring is enabled
      if (this.enableSizeMonitoring) {
        const sizeCheck = this.sizeMonitor.checkSizeLimit(result, 'fda-drugs-search');
        
        if (!sizeCheck.withinLimit && sizeCheck.exceededInfo) {
          // FDA search result size exceeds limit
          // Note: Unlike clinical trials, we'll allow oversized FDA results for now
          // but log a warning for future refinement implementation
        }
      }

      // Cache the result
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now(),
      });

      return result;
    } catch (error: any) {
      // FDA search error occurred - check logs for details
      
      // If no results found, return empty array instead of error
      if (error.response?.status === 404 || 
          (error.response?.data?.error?.code === 'NOT_FOUND') ||
          error.message.includes('NOT_FOUND')) {
        // FDA API returned no results
        return {
          drugs: [],
          totalCount: 0,
        };
      }
      
      // Try alternative search strategy for any search that fails
      if (params.activeIngredient || params.drugName) {
        // Attempting alternative search strategies
        return await this.searchDrugsAlternative(params);
      }
      
      throw new Error(`Failed to search FDA drugs: ${error.response?.status} ${error.response?.statusText || error.message}`);
    }
  }

  private async searchDrugsAlternative(params: FDADrugSearchParams): Promise<FDADrugSearchResponse> {
    // Attempting alternative FDA search strategies
    
    let alternativeStrategies: string[] = [];
    
    // Add strategies for active ingredient search
    if (params.activeIngredient) {
      alternativeStrategies.push(
        `products.active_ingredients.name.exact:"${params.activeIngredient}"`,
        `active_ingredients.name:"${params.activeIngredient}"`,
        `products.active_ingredient:"${params.activeIngredient}"`,
        `active_ingredient:"${params.activeIngredient}"`,
        // Try partial matching
        `products.active_ingredients.name:${params.activeIngredient}*`,
        `active_ingredients.name:${params.activeIngredient}*`,
      );
    }
    
    // Add strategies for drug name search
    if (params.drugName) {
      alternativeStrategies.push(
        `products.brand_name.exact:"${params.drugName}"`,
        `products.generic_name.exact:"${params.drugName}"`,
        `openfda.brand_name.exact:"${params.drugName}"`,
        `openfda.generic_name.exact:"${params.drugName}"`,
        `brand_name:"${params.drugName}"`,
        `generic_name:"${params.drugName}"`,
        // Try partial matching
        `products.brand_name:${params.drugName}*`,
        `products.generic_name:${params.drugName}*`,
        `openfda.brand_name:${params.drugName}*`,
        `openfda.generic_name:${params.drugName}*`,
      );
    }

    for (const strategy of alternativeStrategies) {
      try {
        // Trying FDA search strategy
        
        const searchParams = new URLSearchParams();
        searchParams.append('search', strategy);
        searchParams.append('limit', (params.limit || 20).toString());
        
        if (this.apiKey) {
          searchParams.append('api_key', this.apiKey);
        }

        const response = await this.axios.get('/drug/drugsfda.json', {
          params: searchParams,
        });

        if (response.data.results && response.data.results.length > 0) {
          // FDA alternative search successful
          
          const results = response.data.results || [];
          const drugs = results.map((drug: any) => this.transformDrug(drug));

          return {
            drugs,
            totalCount: response.data.meta?.results?.total || drugs.length,
          };
        }
      } catch (error: any) {
        // FDA strategy failed
        continue; // Try next strategy
      }
    }

    // If all strategies fail, try a broader search
    const searchTerm = params.activeIngredient || params.drugName;
    if (searchTerm) {
      // Trying broad text search
      try {
        const searchParams = new URLSearchParams();
        searchParams.append('search', `"${searchTerm}"`); // Simple text search
        searchParams.append('limit', (params.limit || 20).toString());
        
        if (this.apiKey) {
          searchParams.append('api_key', this.apiKey);
        }

        const response = await this.axios.get('/drug/drugsfda.json', {
          params: searchParams,
        });

        if (response.data.results && response.data.results.length > 0) {
          // FDA broad text search successful
          
          const results = response.data.results || [];
          const drugs = results.map((drug: any) => this.transformDrug(drug));

          return {
            drugs,
            totalCount: response.data.meta?.results?.total || drugs.length,
          };
        }
      } catch (error: any) {
        // FDA broad search failed
      }
    }

    // All FDA search strategies exhausted
    return {
      drugs: [],
      totalCount: 0,
    };
  }

  async getAdverseEvents(params: FDAAdverseEventParams): Promise<FDAAdverseEventResponse> {
    const cacheKey = this.getCacheKey({ ...params, endpoint: 'adverse_events' });
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && this.isValidCache(cached.timestamp)) {
      return cached.data;
    }

    try {
      // Build search query for adverse events
      let searchQuery = `patient.drug.medicinalproduct:"${params.drugName}"`;
      
      // Add date range if specified
      if (params.dateRange) {
        if (params.dateRange.from && params.dateRange.to) {
          const fromDate = params.dateRange.from.replace(/-/g, '');
          const toDate = params.dateRange.to.replace(/-/g, '');
          searchQuery += `+AND+receivedate:[${fromDate}+TO+${toDate}]`;
        }
      }

      const searchParams = new URLSearchParams();
      searchParams.append('search', searchQuery);
      searchParams.append('limit', (params.limit || 100).toString());
      
      if (this.apiKey) {
        searchParams.append('api_key', this.apiKey);
      }

      const response = await this.axios.get('/drug/event.json', {
        params: searchParams,
      });

      const results = response.data.results || [];
      const events = results.map((event: any) => this.transformAdverseEvent(event));

      // Generate summary statistics
      const summary = this.generateAdverseEventSummary(events);

      const result = {
        events,
        totalCount: response.data.meta?.results?.total || events.length,
        summary,
      };

      // Check response size if monitoring is enabled
      if (this.enableSizeMonitoring) {
        const sizeCheck = this.sizeMonitor.checkSizeLimit(result, 'fda-adverse-events');
        
        if (!sizeCheck.withinLimit && sizeCheck.exceededInfo) {
          // FDA adverse events result size exceeds limit
        }
      }

      // Cache the result
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now(),
      });

      return result;
    } catch (error: any) {
      // If no results found, return empty array instead of error
      if (error.response?.status === 404) {
        return {
          events: [],
          totalCount: 0,
          summary: {
            total: 0,
            serious: 0,
            hospitalizations: 0,
            deaths: 0,
            topEvents: [],
          },
        };
      }
      throw new Error(`Failed to get adverse events: ${error}`);
    }
  }

  private transformDrug(drug: any): FDADrug {
    const products = drug.products || [];
    const product = products[0] || {};
    
    return {
      applicationNumber: drug.application_number || 'Unknown',
      sponsorName: drug.sponsor_name || 'Unknown',
      brandName: product.brand_name,
      genericName: product.generic_name,
      activeIngredients: (product.active_ingredients || []).map((ingredient: any) => ({
        name: ingredient.name || 'Unknown',
        strength: ingredient.strength || 'Unknown',
      })),
      approvalDate: product.marketing_status?.[0]?.marketing_start_date || 'Unknown',
      approvalStatus: product.marketing_status?.[0]?.marketing_category || 'Unknown',
      indication: product.te_code || 'Not specified',
      dosageForm: product.dosage_form || 'Unknown',
      route: product.route || 'Unknown',
    };
  }

  private transformAdverseEvent(event: any): FDAAdverseEvent {
    const patient = event.patient || {};
    const drugs = patient.drug || [];
    const reactions = patient.reaction || [];
    
    // Get the primary drug name
    const drugName = drugs[0]?.medicinalproduct || 'Unknown';
    
    // Get the primary reaction
    const primaryReaction = reactions[0]?.reactionmeddrapt || 'Unknown';
    
    return {
      reportId: event.safetyreportid || 'Unknown',
      drugName,
      eventDate: event.receivedate || 'Unknown',
      eventDescription: primaryReaction,
      seriousness: event.serious === '1' ? 'Serious' : 'Non-serious',
      outcome: reactions[0]?.reactionoutcome || 'Unknown',
      patientAge: patient.patientonsetage ? parseInt(patient.patientonsetage) : undefined,
      patientSex: patient.patientsex === '1' ? 'Male' : patient.patientsex === '2' ? 'Female' : 'Unknown',
      reporterType: event.primarysourcecountry || 'Unknown',
    };
  }

  private generateAdverseEventSummary(events: FDAAdverseEvent[]): any {
    const total = events.length;
    const serious = events.filter(e => e.seriousness === 'Serious').length;
    
    // Count hospitalizations and deaths (simplified)
    const hospitalizations = events.filter(e => 
      e.outcome.toLowerCase().includes('hospital') || 
      e.outcome === '2'
    ).length;
    
    const deaths = events.filter(e => 
      e.outcome.toLowerCase().includes('death') || 
      e.outcome === '5'
    ).length;

    // Generate top events
    const eventCounts = new Map<string, number>();
    events.forEach(event => {
      const description = event.eventDescription;
      eventCounts.set(description, (eventCounts.get(description) || 0) + 1);
    });

    const topEvents = Array.from(eventCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([event, count]) => ({ event, count }));

    return {
      total,
      serious,
      hospitalizations,
      deaths,
      topEvents,
    };
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
