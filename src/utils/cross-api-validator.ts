// src/utils/cross-api-validator.ts

import { Study } from '../apis/clinicalTrials.js';

export interface ValidationResult {
  isValid: boolean;
  confidence: number; // 0-1
  discrepancies: Discrepancy[];
  enrichedData: EnrichedStudyData;
  sources: DataSource[];
}

export interface Discrepancy {
  field: string;
  clinicalTrialsValue: any;
  externalValue: any;
  source: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
}

export interface EnrichedStudyData {
  originalStudy: Study;
  enrichments: {
    fdaApprovalStatus?: FDAApprovalInfo;
    publicationData?: PublicationEnrichment;
    patentInformation?: PatentInfo;
    companyFinancials?: CompanyFinancials;
    regulatoryMilestones?: RegulatoryMilestone[];
    competitorAnalysis?: CompetitorAnalysis;
    marketMetrics?: MarketMetrics;
  };
  validationMetadata: {
    lastValidated: Date;
    validationSources: string[];
    overallConfidence: number;
    knownLimitations: string[];
  };
}

export interface FDAApprovalInfo {
  approvalStatus: 'approved' | 'investigational' | 'withdrawn' | 'unknown';
  approvalDate?: Date;
  indication: string;
  fdaDesignations: string[]; // breakthrough, fast-track, orphan, etc.
  regulatoryActions: RegulatoryAction[];
}

export interface RegulatoryAction {
  date: Date;
  action: string;
  description: string;
  source: string;
}

export interface PublicationEnrichment {
  relatedPublications: {
    pmid: string;
    title: string;
    journal: string;
    publicationDate: Date;
    authors: string[];
    abstract: string;
    relevanceScore: number;
  }[];
  citationMetrics: {
    totalCitations: number;
    recentCitations: number; // Last 2 years
    impactFactor: number;
  };
  keyFindings: string[];
}

export interface PatentInfo {
  relatedPatents: {
    patentNumber: string;
    title: string;
    assignee: string;
    filingDate: Date;
    expirationDate: Date;
    status: 'active' | 'expired' | 'pending';
  }[];
  patentLandscape: {
    competitorPatents: number;
    freedomToOperate: 'clear' | 'limited' | 'blocked';
    keyPatentHolders: string[];
  };
}

export interface CompanyFinancials {
  marketCap?: number;
  revenue?: number;
  rdSpending?: number;
  rdPercentage?: number;
  cashPosition?: number;
  debtRatio?: number;
  lastUpdated: Date;
}

export interface CompetitorAnalysis {
  directCompetitors: {
    drug: string;
    company: string;
    developmentStage: string;
    differentiators: string[];
    marketPosition: string;
  }[];
  marketShare: {
    currentLeader: string;
    marketSharePercentage: number;
    trendDirection: 'growing' | 'stable' | 'declining';
  };
  competitiveAdvantages: string[];
  threats: string[];
}

export interface MarketMetrics {
  marketSize: {
    current: number;
    projected: number;
    currency: string;
    year: number;
  };
  patientPopulation: {
    eligible: number;
    treated: number;
    unmet: number;
    geography: string;
  };
  pricingBenchmarks: {
    averagePrice: number;
    priceRange: { min: number; max: number };
    reimbursementRate: number;
  };
}

export interface RegulatoryMilestone {
  date: Date;
  milestone: string;
  agency: string;
  outcome: string;
  significance: 'low' | 'medium' | 'high';
}

export interface DataSource {
  name: string;
  endpoint: string;
  lastQueried: Date;
  responseTime: number;
  reliability: number; // 0-1
  dataFreshness: number; // 0-1
}

export class CrossAPIValidator {
  private validationCache = new Map<string, ValidationResult>();
  private cacheTimeout = 24 * 60 * 60 * 1000; // 24 hours
  
  private dataSources = {
    fda: {
      orangeBook: 'https://www.fda.gov/drugs/drug-approvals-and-databases/orange-book-data-files',
      drugLabels: 'https://api.fda.gov/drug/label.json',
      enforcement: 'https://api.fda.gov/drug/enforcement.json'
    },
    pubmed: {
      search: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi',
      fetch: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi'
    },
    patents: {
      uspto: 'https://developer.uspto.gov/api-catalog',
      epo: 'https://ops.epo.org/3.2/'
    },
    financial: {
      sec: 'https://data.sec.gov/submissions/',
      yahoo: 'https://query1.finance.yahoo.com/v8/finance/chart/'
    }
  };

  async validateAndEnrichStudy(study: Study): Promise<ValidationResult> {
    const studyId = study.protocolSection.identificationModule.nctId;
    
    // Check cache first
    const cached = this.validationCache.get(studyId);
    if (cached && this.isCacheValid(cached)) {
      return cached;
    }

    console.log(`Cross-validating study: ${studyId}`);

    const sources: DataSource[] = [];
    const discrepancies: Discrepancy[] = [];
    let overallConfidence = 0.8; // Start with high confidence

    try {
      // 1. Validate with FDA data
      const fdaValidation = await this.validateWithFDA(study);
      sources.push(fdaValidation.source);
      discrepancies.push(...fdaValidation.discrepancies);
      overallConfidence = Math.min(overallConfidence, fdaValidation.confidence);

      // 2. Enrich with PubMed publications
      const pubmedEnrichment = await this.enrichWithPubMed(study);
      sources.push(pubmedEnrichment.source);

      // 3. Validate company information
      const companyValidation = await this.validateCompanyInfo(study);
      sources.push(companyValidation.source);
      discrepancies.push(...companyValidation.discrepancies);

      // 4. Enrich with patent data
      const patentEnrichment = await this.enrichWithPatents(study);
      if (patentEnrichment.source) sources.push(patentEnrichment.source);

      // 5. Get market intelligence
      const marketIntelligence = await this.gatherMarketIntelligence(study);

      // Compile enriched data
      const enrichedData: EnrichedStudyData = {
        originalStudy: study,
        enrichments: {
          fdaApprovalStatus: fdaValidation.fdaInfo,
          publicationData: pubmedEnrichment.publications,
          patentInformation: patentEnrichment.patents,
          companyFinancials: companyValidation.financials,
          regulatoryMilestones: await this.gatherRegulatoryMilestones(study),
          competitorAnalysis: marketIntelligence.competitors,
          marketMetrics: marketIntelligence.metrics
        },
        validationMetadata: {
          lastValidated: new Date(),
          validationSources: sources.map(s => s.name),
          overallConfidence,
          knownLimitations: this.identifyKnownLimitations(discrepancies)
        }
      };

      const result: ValidationResult = {
        isValid: discrepancies.filter(d => d.severity === 'high').length === 0,
        confidence: overallConfidence,
        discrepancies,
        enrichedData,
        sources
      };

      // Cache result
      this.validationCache.set(studyId, result);
      
      return result;

    } catch (error) {
      console.error('Error in cross-validation:', error);
      
      // Return basic validation on error
      return {
        isValid: true,
        confidence: 0.5,
        discrepancies: [],
        enrichedData: {
          originalStudy: study,
          enrichments: {},
          validationMetadata: {
            lastValidated: new Date(),
            validationSources: [],
            overallConfidence: 0.5,
            knownLimitations: ['Validation failed due to API errors']
          }
        },
        sources: []
      };
    }
  }

  private async validateWithFDA(study: Study): Promise<{
    confidence: number;
    discrepancies: Discrepancy[];
    fdaInfo?: FDAApprovalInfo;
    source: DataSource;
  }> {
    const startTime = Date.now();
    const discrepancies: Discrepancy[] = [];
    
    try {
      // Extract drug names from interventions
      const interventions = this.extractInterventions(study);
      const conditions = this.extractConditions(study);
      
      // Query FDA Orange Book
      const fdaData = await this.queryFDAOrangeBook(interventions);
      
      // Query FDA Drug Labels
      const labelData = await this.queryFDADrugLabels(interventions);
      
      // Cross-validate information
      if (fdaData && labelData) {
        // Check for discrepancies in indications
        const studyConditions = conditions.map(c => c.toLowerCase());
        const fdaIndications = labelData.indications.map((i: any) => i.toLowerCase());
        
        const indicationMatch = studyConditions.some(condition =>
          fdaIndications.some((indication: string) => 
            indication.includes(condition) || condition.includes(indication)
          )
        );

        if (!indicationMatch && fdaData.approvalStatus === 'approved') {
          discrepancies.push({
            field: 'indication',
            clinicalTrialsValue: studyConditions,
            externalValue: fdaIndications,
            source: 'FDA',
            severity: 'medium',
            description: 'Study indication does not match FDA approved indications'
          });
        }
      }

      const responseTime = Date.now() - startTime;
      
      return {
        confidence: discrepancies.length === 0 ? 0.9 : 0.7,
        discrepancies,
        fdaInfo: fdaData || undefined,
        source: {
          name: 'FDA',
          endpoint: this.dataSources.fda.orangeBook,
          lastQueried: new Date(),
          responseTime,
          reliability: 0.95,
          dataFreshness: 0.8
        }
      };

    } catch (error) {
      console.error('FDA validation error:', error);
      
      return {
        confidence: 0.5,
        discrepancies: [{
          field: 'fda_validation',
          clinicalTrialsValue: 'unknown',
          externalValue: 'error',
          source: 'FDA',
          severity: 'low',
          description: 'Unable to validate with FDA data'
        }],
        source: {
          name: 'FDA',
          endpoint: this.dataSources.fda.orangeBook,
          lastQueried: new Date(),
          responseTime: Date.now() - startTime,
          reliability: 0.5,
          dataFreshness: 0.5
        }
      };
    }
  }

  private async enrichWithPubMed(study: Study): Promise<{
    publications?: PublicationEnrichment;
    source: DataSource;
  }> {
    const startTime = Date.now();
    
    try {
      const interventions = this.extractInterventions(study);
      const conditions = this.extractConditions(study);
      
      // Search for related publications
      const searchTerms = [...interventions, ...conditions].join(' AND ');
      const publications = await this.searchPubMed(searchTerms);
      
      // Calculate relevance scores
      const scoredPublications = publications.map(pub => ({
        ...pub,
        relevanceScore: this.calculatePublicationRelevance(pub, study)
      }));

      // Get citation metrics
      const citationMetrics = await this.getCitationMetrics(scoredPublications);
      
      const responseTime = Date.now() - startTime;

      return {
        publications: {
          relatedPublications: scoredPublications.slice(0, 10), // Top 10 most relevant
          citationMetrics,
          keyFindings: this.extractKeyFindings(scoredPublications)
        },
        source: {
          name: 'PubMed',
          endpoint: this.dataSources.pubmed.search,
          lastQueried: new Date(),
          responseTime,
          reliability: 0.9,
          dataFreshness: 0.9
        }
      };

    } catch (error) {
      console.error('PubMed enrichment error:', error);
      
      return {
        source: {
          name: 'PubMed',
          endpoint: this.dataSources.pubmed.search,
          lastQueried: new Date(),
          responseTime: Date.now() - startTime,
          reliability: 0.5,
          dataFreshness: 0.5
        }
      };
    }
  }

  private async validateCompanyInfo(study: Study): Promise<{
    confidence: number;
    discrepancies: Discrepancy[];
    financials?: CompanyFinancials;
    source: DataSource;
  }> {
    const startTime = Date.now();
    const discrepancies: Discrepancy[] = [];
    
    try {
      const sponsor = study.protocolSection.sponsorCollaboratorsModule?.leadSponsor?.name;
      if (!sponsor) {
        return {
          confidence: 0.5,
          discrepancies: [],
          source: {
            name: 'SEC',
            endpoint: this.dataSources.financial.sec,
            lastQueried: new Date(),
            responseTime: Date.now() - startTime,
            reliability: 0.5,
            dataFreshness: 0.5
          }
        };
      }

      // Get company financial information
      const financials = await this.getCompanyFinancials(sponsor);
      
      // Validate sponsor existence and status
      const companyExists = await this.validateCompanyExists(sponsor);
      
      if (!companyExists) {
        discrepancies.push({
          field: 'sponsor',
          clinicalTrialsValue: sponsor,
          externalValue: 'not_found',
          source: 'SEC',
          severity: 'medium',
          description: 'Sponsor company not found in SEC database'
        });
      }

      const responseTime = Date.now() - startTime;

      return {
        confidence: discrepancies.length === 0 ? 0.8 : 0.6,
        discrepancies,
        financials,
        source: {
          name: 'SEC',
          endpoint: this.dataSources.financial.sec,
          lastQueried: new Date(),
          responseTime,
          reliability: 0.85,
          dataFreshness: 0.7
        }
      };

    } catch (error) {
      console.error('Company validation error:', error);
      
      return {
        confidence: 0.5,
        discrepancies: [],
        source: {
          name: 'SEC',
          endpoint: this.dataSources.financial.sec,
          lastQueried: new Date(),
          responseTime: Date.now() - startTime,
          reliability: 0.5,
          dataFreshness: 0.5
        }
      };
    }
  }

  private async enrichWithPatents(study: Study): Promise<{
    patents?: PatentInfo;
    source?: DataSource;
  }> {
    const startTime = Date.now();
    
    try {
      const interventions = this.extractInterventions(study);
      const sponsor = study.protocolSection.sponsorCollaboratorsModule?.leadSponsor?.name;
      
      // Search for related patents
      const patents = await this.searchPatents(interventions, sponsor);
      
      if (patents.length === 0) {
        return {};
      }

      const responseTime = Date.now() - startTime;

      return {
        patents: {
          relatedPatents: patents,
          patentLandscape: await this.analyzePatentLandscape(interventions)
        },
        source: {
          name: 'USPTO',
          endpoint: this.dataSources.patents.uspto,
          lastQueried: new Date(),
          responseTime,
          reliability: 0.8,
          dataFreshness: 0.7
        }
      };

    } catch (error) {
      console.error('Patent enrichment error:', error);
      return {};
    }
  }

  // Helper methods (stubs for implementation)
  private extractInterventions(study: Study): string[] {
    return study.protocolSection.interventionsModule?.interventions?.map((i: any) => i.name) || [];
  }

  private extractConditions(study: Study): string[] {
    return study.protocolSection.conditionsModule?.conditions || [];
  }

  private async queryFDAOrangeBook(drugs: string[]): Promise<FDAApprovalInfo | null> {
    // Implementation would query FDA Orange Book API
    return null;
  }

  private async queryFDADrugLabels(drugs: string[]): Promise<any> {
    // Implementation would query FDA Drug Labels API
    return { indications: [] };
  }

  private async searchPubMed(searchTerms: string): Promise<any[]> {
    // Implementation would search PubMed
    return [];
  }

  private calculatePublicationRelevance(publication: any, study: Study): number {
    // Implementation would calculate relevance score
    return 0.5;
  }

  private async getCitationMetrics(publications: any[]): Promise<any> {
    // Implementation would get citation data
    return {
      totalCitations: 0,
      recentCitations: 0,
      impactFactor: 0
    };
  }

  private extractKeyFindings(publications: any[]): string[] {
    // Implementation would extract key findings using NLP
    return [];
  }

  private async getCompanyFinancials(company: string): Promise<CompanyFinancials | undefined> {
    // Implementation would query financial APIs
    return undefined;
  }

  private async validateCompanyExists(company: string): Promise<boolean> {
    // Implementation would validate company existence
    return true;
  }

  private async searchPatents(drugs: string[], assignee?: string): Promise<any[]> {
    // Implementation would search patent databases
    return [];
  }

  private async analyzePatentLandscape(drugs: string[]): Promise<any> {
    // Implementation would analyze patent landscape
    return {
      competitorPatents: 0,
      freedomToOperate: 'unknown',
      keyPatentHolders: []
    };
  }

  private async gatherRegulatoryMilestones(study: Study): Promise<RegulatoryMilestone[]> {
    // Implementation would gather regulatory milestones
    return [];
  }

  private async gatherMarketIntelligence(study: Study): Promise<{
    competitors?: CompetitorAnalysis;
    metrics?: MarketMetrics;
  }> {
    // Implementation would gather market intelligence
    return {};
  }

  private identifyKnownLimitations(discrepancies: Discrepancy[]): string[] {
    const limitations: string[] = [];
    
    if (discrepancies.some(d => d.source === 'FDA' && d.severity === 'high')) {
      limitations.push('Significant FDA data discrepancies detected');
    }
    
    if (discrepancies.length > 5) {
      limitations.push('Multiple validation discrepancies across sources');
    }
    
    return limitations;
  }

  private isCacheValid(result: ValidationResult): boolean {
    const age = Date.now() - result.enrichedData.validationMetadata.lastValidated.getTime();
    return age < this.cacheTimeout;
  }

  // Batch validation for multiple studies
  async validateStudiesBatch(studies: Study[]): Promise<Map<string, ValidationResult>> {
    const results = new Map<string, ValidationResult>();
    
    // Process in batches to avoid rate limiting
    const batchSize = 5;
    for (let i = 0; i < studies.length; i += batchSize) {
      const batch = studies.slice(i, i + batchSize);
      const batchPromises = batch.map(study => 
        this.validateAndEnrichStudy(study).then(result => ({
          nctId: study.protocolSection.identificationModule.nctId,
          result
        }))
      );
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach(promiseResult => {
        if (promiseResult.status === 'fulfilled') {
          results.set(promiseResult.value.nctId, promiseResult.value.result);
        }
      });
      
      // Rate limiting delay between batches
      if (i + batchSize < studies.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }

  // Configuration methods
  updateDataSource(sourceName: string, config: Partial<DataSource>): void {
    // Update data source configuration
  }

  getValidationStats(): {
    totalValidations: number;
    successRate: number;
    averageConfidence: number;
    commonDiscrepancies: string[];
  } {
    const validations = Array.from(this.validationCache.values());
    
    return {
      totalValidations: validations.length,
      successRate: validations.filter(v => v.isValid).length / validations.length,
      averageConfidence: validations.reduce((sum, v) => sum + v.confidence, 0) / validations.length,
      commonDiscrepancies: this.getCommonDiscrepancies(validations)
    };
  }

  private getCommonDiscrepancies(validations: ValidationResult[]): string[] {
    const discrepancyTypes = new Map<string, number>();
    
    validations.forEach(validation => {
      validation.discrepancies.forEach(discrepancy => {
        const count = discrepancyTypes.get(discrepancy.field) || 0;
        discrepancyTypes.set(discrepancy.field, count + 1);
      });
    });
    
    return Array.from(discrepancyTypes.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([field]) => field);
  }
}

export const crossAPIValidator = new CrossAPIValidator();