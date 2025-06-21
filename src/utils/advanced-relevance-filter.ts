// src/utils/advanced-relevance-filter.ts

import { Study } from '../apis/clinicalTrials.js';
import { RelevanceScore } from './relevance-scorer.js';

export interface FilterCriteria {
  minRelevanceScore?: number;
  therapeuticAreas?: string[];
  developmentStages?: string[];
  sponsorTypes?: ('big_pharma' | 'biotech' | 'academic' | 'government')[];
  geographicRegions?: string[];
  minEnrollment?: number;
  maxEnrollment?: number;
  dateRange?: {
    startAfter?: Date;
    completeBefore?: Date;
  };
  modalityTypes?: string[];
  includeFailedTrials?: boolean;
  minPhase?: number;
  maxPhase?: number;
}

export interface EnhancedStudyData extends Study {
  enhancedMetadata: {
    relevanceScore: RelevanceScore;
    qualityIndicators: QualityIndicators;
    competitiveContext: CompetitiveContext;
    marketSignificance: MarketSignificance;
    dataFreshness: DataFreshness;
  };
}

export interface QualityIndicators {
  dataCompleteness: number; // 0-1 score
  sourceReliability: number; // 0-1 score
  updateRecency: number; // 0-1 score
  crossValidation: boolean;
  inconsistencyFlags: string[];
  missingCriticalData: string[];
}

export interface CompetitiveContext {
  directCompetitors: number;
  mechanismCompetitors: number;
  marketPosition: 'first_in_class' | 'best_in_class' | 'me_too' | 'unknown';
  competitivePressure: 'low' | 'medium' | 'high';
  differentiationFactors: string[];
}

export interface MarketSignificance {
  marketSize: 'small' | 'medium' | 'large' | 'blockbuster' | 'unknown';
  unmetNeed: 'low' | 'medium' | 'high';
  regulatoryPathway: 'standard' | 'fast_track' | 'breakthrough' | 'orphan' | 'unknown';
  commercialPotential: number; // 0-1 score
  strategicImportance: number; // 0-1 score
}

export interface DataFreshness {
  lastUpdated: Date;
  sourceTimestamp: Date;
  dataAge: number; // Days since last update
  freshnessScore: number; // 0-1 score
}

export class AdvancedRelevanceFilter {
  private qualityThresholds = {
    minDataCompleteness: 0.6,
    minSourceReliability: 0.7,
    maxDataAge: 365, // Days
    minUpdateRecency: 0.5
  };

  private marketSizeDatabase = new Map<string, string>([
    // Indication to market size mapping
    ['age-related macular degeneration', 'large'],
    ['rheumatoid arthritis', 'blockbuster'],
    ['alzheimers disease', 'blockbuster'],
    ['non-small cell lung cancer', 'blockbuster'],
    ['breast cancer', 'blockbuster'],
    ['migraine', 'large'],
    ['psoriasis', 'large'],
    ['spinal muscular atrophy', 'small'],
    ['duchenne muscular dystrophy', 'small']
  ]);

  async filterAndEnhanceStudies(
    studies: Study[],
    criteria: FilterCriteria = {}
  ): Promise<EnhancedStudyData[]> {
    
    const enhancedStudies: EnhancedStudyData[] = [];

    for (const study of studies) {
      try {
        // Enhance study with metadata
        const enhanced = await this.enhanceStudyData(study);
        
        // Apply filters
        if (this.passesFilters(enhanced, criteria)) {
          enhancedStudies.push(enhanced);
        }
      } catch (error) {
        console.error('Error enhancing study:', study.protocolSection.identificationModule.nctId, error);
      }
    }

    // Sort by combined relevance and quality score
    return enhancedStudies.sort((a, b) => {
      const scoreA = this.calculateCombinedScore(a);
      const scoreB = this.calculateCombinedScore(b);
      return scoreB - scoreA;
    });
  }

  private async enhanceStudyData(study: Study): Promise<EnhancedStudyData> {
    // Calculate quality indicators
    const qualityIndicators = this.assessDataQuality(study);
    
    // Determine competitive context
    const competitiveContext = await this.analyzeCompetitiveContext(study);
    
    // Assess market significance
    const marketSignificance = this.assessMarketSignificance(study);
    
    // Calculate data freshness
    const dataFreshness = this.assessDataFreshness(study);

    return {
      ...study,
      enhancedMetadata: {
        relevanceScore: { score: 0, factors: [], category: 'not_relevant', explanation: '' }, // Will be set by relevance scorer
        qualityIndicators,
        competitiveContext,
        marketSignificance,
        dataFreshness
      }
    };
  }

  private assessDataQuality(study: Study): QualityIndicators {
    let completenessScore = 0;
    let totalFields = 0;
    const missingCriticalData: string[] = [];

    // Check critical fields
    const criticalFields = [
      'briefTitle',
      'conditions',
      'interventions', 
      'overallStatus',
      'phase',
      'leadSponsor',
      'startDate'
    ];

    criticalFields.forEach(field => {
      totalFields++;
      switch (field) {
        case 'briefTitle':
          if (study.protocolSection.identificationModule.briefTitle) completenessScore++;
          else missingCriticalData.push('title');
          break;
        case 'conditions':
          if (study.protocolSection.conditionsModule?.conditions?.length) completenessScore++;
          else missingCriticalData.push('conditions');
          break;
        case 'interventions':
          if (study.protocolSection.interventionsModule?.interventions?.length) completenessScore++;
          else missingCriticalData.push('interventions');
          break;
        case 'overallStatus':
          if (study.protocolSection.statusModule.overallStatus) completenessScore++;
          else missingCriticalData.push('status');
          break;
        case 'phase':
          if (study.protocolSection.designModule?.phases?.length) completenessScore++;
          else missingCriticalData.push('phase');
          break;
        case 'leadSponsor':
          if (study.protocolSection.sponsorCollaboratorsModule?.leadSponsor?.name) completenessScore++;
          else missingCriticalData.push('sponsor');
          break;
        case 'startDate':
          if (study.protocolSection.statusModule.startDateStruct) completenessScore++;
          else missingCriticalData.push('start_date');
          break;
      }
    });

    const dataCompleteness = completenessScore / totalFields;
    
    // Assess source reliability based on sponsor type
    const sourceReliability = this.assessSourceReliability(study);
    
    // Check for inconsistencies
    const inconsistencyFlags = this.detectInconsistencies(study);

    return {
      dataCompleteness,
      sourceReliability,
      updateRecency: 0.8, // Placeholder - would calculate based on last update
      crossValidation: false, // Would check against other sources
      inconsistencyFlags,
      missingCriticalData
    };
  }

  private assessSourceReliability(study: Study): number {
    const sponsor = study.protocolSection.sponsorCollaboratorsModule?.leadSponsor?.name || '';
    const sponsorLower = sponsor.toLowerCase();

    // Big pharma = high reliability
    const bigPharma = ['pfizer', 'roche', 'novartis', 'merck', 'abbvie', 'johnson', 'bristol', 'amgen', 'genentech'];
    if (bigPharma.some(company => sponsorLower.includes(company))) {
      return 0.95;
    }

    // Academic institutions = high reliability
    if (sponsorLower.includes('university') || sponsorLower.includes('hospital') || 
        sponsorLower.includes('medical center') || sponsorLower.includes('institute')) {
      return 0.9;
    }

    // Government = high reliability
    if (sponsorLower.includes('nih') || sponsorLower.includes('national') || 
        sponsorLower.includes('department') || sponsorLower.includes('government')) {
      return 0.95;
    }

    // Biotech = medium-high reliability
    return 0.7;
  }

  private detectInconsistencies(study: Study): string[] {
    const flags: string[] = [];

    // Check phase vs status consistency
    const phases = study.protocolSection.designModule?.phases || [];
    const status = study.protocolSection.statusModule.overallStatus;

    if (phases.includes('PHASE4') && status === 'NOT_YET_RECRUITING') {
      flags.push('phase4_not_recruiting_inconsistency');
    }

    if (status === 'COMPLETED' && !study.protocolSection.statusModule.completionDateStruct) {
      flags.push('completed_no_end_date');
    }

    // Check enrollment vs phase consistency
    const enrollment = (study.protocolSection as any).designModule?.enrollmentInfo?.count;
    if (enrollment && phases.includes('PHASE1') && enrollment > 100) {
      flags.push('large_phase1_enrollment');
    }

    return flags;
  }

  private async analyzeCompetitiveContext(study: Study): Promise<CompetitiveContext> {
    const interventions = this.extractInterventions(study);
    const conditions = this.extractConditions(study);
    
    // Count competitors (simplified - would use knowledge graph)
    const directCompetitors = 0; // Would query knowledge graph
    const mechanismCompetitors = 0; // Would analyze mechanism similarity
    
    // Determine market position
    let marketPosition: CompetitiveContext['marketPosition'] = 'unknown';
    const phases = study.protocolSection.designModule?.phases || [];
    
    if (phases.includes('PHASE1') && directCompetitors === 0) {
      marketPosition = 'first_in_class';
    } else if (directCompetitors < 3) {
      marketPosition = 'best_in_class';
    } else if (directCompetitors >= 3) {
      marketPosition = 'me_too';
    }

    const competitivePressure = directCompetitors < 2 ? 'low' : 
                               directCompetitors < 5 ? 'medium' : 'high';

    return {
      directCompetitors,
      mechanismCompetitors,
      marketPosition,
      competitivePressure,
      differentiationFactors: [] // Would analyze unique aspects
    };
  }

  private assessMarketSignificance(study: Study): MarketSignificance {
    const conditions = this.extractConditions(study);
    
    // Determine market size from indication
    let marketSize: MarketSignificance['marketSize'] = 'unknown';
    for (const condition of conditions) {
      const size = this.marketSizeDatabase.get(condition.toLowerCase());
      if (size) {
        marketSize = size as MarketSignificance['marketSize'];
        break;
      }
    }

    // Assess unmet need (simplified)
    const unmetNeed = this.assessUnmetNeed(conditions);
    
    // Check for special regulatory pathways
    const regulatoryPathway = this.identifyRegulatoryPathway(study);
    
    // Calculate commercial potential
    const commercialPotential = this.calculateCommercialPotential(marketSize, unmetNeed);
    
    // Calculate strategic importance
    const strategicImportance = this.calculateStrategicImportance(study, marketSize);

    return {
      marketSize,
      unmetNeed,
      regulatoryPathway,
      commercialPotential,
      strategicImportance
    };
  }

  private assessUnmetNeed(conditions: string[]): 'low' | 'medium' | 'high' {
    const highUnmetNeed = ['alzheimers', 'als', 'duchenne', 'huntington', 'rare'];
    const mediumUnmetNeed = ['cancer', 'migraine', 'depression'];
    
    for (const condition of conditions) {
      const conditionLower = condition.toLowerCase();
      if (highUnmetNeed.some(need => conditionLower.includes(need))) return 'high';
      if (mediumUnmetNeed.some(need => conditionLower.includes(need))) return 'medium';
    }
    
    return 'medium'; // Default
  }

  private identifyRegulatoryPathway(study: Study): MarketSignificance['regulatoryPathway'] {
    const title = study.protocolSection.identificationModule.briefTitle.toLowerCase();
    const conditions = this.extractConditions(study);
    
    // Check for orphan indications
    const orphanKeywords = ['rare', 'orphan', 'ultra-rare'];
    if (orphanKeywords.some(keyword => 
      title.includes(keyword) || conditions.some(c => c.toLowerCase().includes(keyword))
    )) {
      return 'orphan';
    }
    
    // Check for breakthrough therapy keywords
    const breakthroughKeywords = ['breakthrough', 'innovative', 'first-in-class'];
    if (breakthroughKeywords.some(keyword => title.includes(keyword))) {
      return 'breakthrough';
    }
    
    return 'standard';
  }

  private calculateCommercialPotential(marketSize: string, unmetNeed: string): number {
    const sizeScore = {
      'blockbuster': 1.0,
      'large': 0.8,
      'medium': 0.6,
      'small': 0.4,
      'unknown': 0.5
    }[marketSize] || 0.5;
    
    const needScore = {
      'high': 1.0,
      'medium': 0.7,
      'low': 0.4
    }[unmetNeed] || 0.5;
    
    return (sizeScore + needScore) / 2;
  }

  private calculateStrategicImportance(study: Study, marketSize: string): number {
    let importance = 0.5; // Base score
    
    // Increase for large markets
    if (marketSize === 'blockbuster') importance += 0.3;
    else if (marketSize === 'large') importance += 0.2;
    
    // Increase for early phase (first-mover advantage)
    const phases = study.protocolSection.designModule?.phases || [];
    if (phases.includes('PHASE1')) importance += 0.2;
    else if (phases.includes('PHASE2')) importance += 0.1;
    
    // Increase for big pharma sponsors (resources for development)
    const sponsor = study.protocolSection.sponsorCollaboratorsModule?.leadSponsor?.name || '';
    const bigPharma = ['pfizer', 'roche', 'novartis', 'merck', 'abbvie'];
    if (bigPharma.some(company => sponsor.toLowerCase().includes(company))) {
      importance += 0.1;
    }
    
    return Math.min(importance, 1.0);
  }

  private assessDataFreshness(study: Study): DataFreshness {
    const now = new Date();
    const lastUpdated = new Date(); // Would get from API metadata
    const sourceTimestamp = new Date(); // Would get from source
    
    const dataAge = Math.floor((now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24));
    const freshnessScore = Math.max(0, 1 - (dataAge / 365)); // Decay over 1 year
    
    return {
      lastUpdated,
      sourceTimestamp,
      dataAge,
      freshnessScore
    };
  }

  private passesFilters(study: EnhancedStudyData, criteria: FilterCriteria): boolean {
    // Relevance score filter
    if (criteria.minRelevanceScore && 
        study.enhancedMetadata.relevanceScore.score < criteria.minRelevanceScore) {
      return false;
    }

    // Quality filters
    if (study.enhancedMetadata.qualityIndicators.dataCompleteness < this.qualityThresholds.minDataCompleteness) {
      return false;
    }

    if (study.enhancedMetadata.qualityIndicators.sourceReliability < this.qualityThresholds.minSourceReliability) {
      return false;
    }

    if (study.enhancedMetadata.dataFreshness.dataAge > this.qualityThresholds.maxDataAge) {
      return false;
    }

    // Development stage filter
    if (criteria.developmentStages) {
      const phases = study.protocolSection.designModule?.phases || [];
      if (!criteria.developmentStages.some(stage => phases.includes(stage))) {
        return false;
      }
    }

    // Enrollment filters  
    const enrollment = (study.protocolSection as any).designModule?.enrollmentInfo?.count;
    if (criteria.minEnrollment && enrollment && enrollment < criteria.minEnrollment) {
      return false;
    }
    if (criteria.maxEnrollment && enrollment && enrollment > criteria.maxEnrollment) {
      return false;
    }

    // Failed trials filter
    if (!criteria.includeFailedTrials) {
      const failedStatuses = ['TERMINATED', 'SUSPENDED', 'WITHDRAWN'];
      if (failedStatuses.includes(study.protocolSection.statusModule.overallStatus)) {
        return false;
      }
    }

    return true;
  }

  private calculateCombinedScore(study: EnhancedStudyData): number {
    const relevanceWeight = 0.4;
    const qualityWeight = 0.3;
    const freshnessWeight = 0.2;
    const significanceWeight = 0.1;

    const relevanceScore = study.enhancedMetadata.relevanceScore.score / 100;
    const qualityScore = (
      study.enhancedMetadata.qualityIndicators.dataCompleteness +
      study.enhancedMetadata.qualityIndicators.sourceReliability +
      study.enhancedMetadata.qualityIndicators.updateRecency
    ) / 3;
    const freshnessScore = study.enhancedMetadata.dataFreshness.freshnessScore;
    const significanceScore = study.enhancedMetadata.marketSignificance.strategicImportance;

    return (
      relevanceScore * relevanceWeight +
      qualityScore * qualityWeight +
      freshnessScore * freshnessWeight +
      significanceScore * significanceWeight
    );
  }

  private extractInterventions(study: Study): string[] {
    const interventions: string[] = [];
    
    if (study.protocolSection.interventionsModule?.interventions) {
      study.protocolSection.interventionsModule.interventions.forEach(intervention => {
        if (intervention.name) interventions.push(intervention.name);
      });
    }
    
    return interventions;
  }

  private extractConditions(study: Study): string[] {
    return study.protocolSection.conditionsModule?.conditions || [];
  }

  // Configuration methods
  updateQualityThresholds(thresholds: Partial<typeof this.qualityThresholds>): void {
    this.qualityThresholds = { ...this.qualityThresholds, ...thresholds };
  }

  addMarketSizeMapping(indication: string, size: string): void {
    this.marketSizeDatabase.set(indication.toLowerCase(), size);
  }
}

export const advancedRelevanceFilter = new AdvancedRelevanceFilter();