// src/utils/query-enhancer.ts

import { drugKnowledgeGraph } from './drug-knowledge-graph.js';
import { StudySearchParams } from '../apis/clinicalTrials.js';

export interface EnhancedQuery {
  originalQuery: StudySearchParams;
  enhancedQuery: StudySearchParams;
  expansions: {
    drugExpansions: string[];
    indicationExpansions: string[];
    competitorSuggestions: string[];
    relatedSearches: string[];
  };
  searchStrategy: 'exact' | 'expanded' | 'competitive' | 'therapeutic_area';
  confidence: number; // 0-1 score for query understanding
}

export interface QueryContext {
  intent: 'competitive_analysis' | 'drug_development' | 'safety_monitoring' | 'market_research' | 'general';
  timeHorizon: 'current' | 'pipeline' | 'historical';
  stakeholder: 'pharma_company' | 'investor' | 'researcher' | 'regulator';
}

export class QueryEnhancer {
  
  public enhanceQuery(params: StudySearchParams, context?: QueryContext): EnhancedQuery {
    const originalQuery = { ...params };
    let enhancedQuery = { ...params };
    const expansions = {
      drugExpansions: [] as string[],
      indicationExpansions: [] as string[],
      competitorSuggestions: [] as string[],
      relatedSearches: [] as string[]
    };
    
    let confidence = 0.5; // Base confidence
    let searchStrategy: EnhancedQuery['searchStrategy'] = 'exact';

    // Enhance intervention/drug queries
    if (params.query?.intervention) {
      const drugInfo = drugKnowledgeGraph.getDrugInfo(params.query.intervention);
      if (drugInfo) {
        confidence += 0.3;
        searchStrategy = 'expanded';
        
        // Expand drug names
        expansions.drugExpansions = drugKnowledgeGraph.expandDrugQuery(params.query.intervention);
        
        // Create enhanced intervention query with OR logic
        enhancedQuery.query = {
          ...enhancedQuery.query,
          intervention: expansions.drugExpansions.join(' OR ')
        };
        
        // Get competitors for suggestion
        const indication = params.query?.condition;
        expansions.competitorSuggestions = drugKnowledgeGraph.getCompetitors(
          params.query.intervention, 
          indication
        );
        
        // Get related searches
        expansions.relatedSearches = drugKnowledgeGraph.suggestRelatedSearches(
          params.query.intervention,
          indication
        );
      }
    }

    // Enhance condition/indication queries
    if (params.query?.condition) {
      const indicationInfo = drugKnowledgeGraph.getIndicationInfo(params.query.condition);
      if (indicationInfo) {
        confidence += 0.2;
        
        // Expand indication terms
        expansions.indicationExpansions = drugKnowledgeGraph.expandIndicationQuery(params.query.condition);
        
        // Create enhanced condition query with OR logic
        enhancedQuery.query = {
          ...enhancedQuery.query,
          condition: expansions.indicationExpansions.join(' OR ')
        };
      }
    }

    // Apply context-specific enhancements
    if (context) {
      enhancedQuery = this.applyContextualEnhancements(enhancedQuery, context);
      confidence += 0.1;
    }

    // Apply intelligent defaults based on query type
    enhancedQuery = this.applyIntelligentDefaults(enhancedQuery, searchStrategy);

    return {
      originalQuery,
      enhancedQuery,
      expansions,
      searchStrategy,
      confidence: Math.min(confidence, 1.0)
    };
  }

  private applyContextualEnhancements(query: StudySearchParams, context: QueryContext): StudySearchParams {
    const enhanced = { ...query };

    // Apply intent-specific filters
    switch (context.intent) {
      case 'competitive_analysis':
        // Focus on Phase 2/3 trials and recent activity
        enhanced.filter = {
          ...enhanced.filter,
          phase: enhanced.filter?.phase || ['PHASE2', 'PHASE3'],
          overallStatus: enhanced.filter?.overallStatus || ['RECRUITING', 'ACTIVE_NOT_RECRUITING', 'COMPLETED']
        };
        break;
        
      case 'safety_monitoring':
        // Include all phases, focus on completed studies
        enhanced.filter = {
          ...enhanced.filter,
          overallStatus: ['COMPLETED', 'TERMINATED', 'SUSPENDED']
        };
        break;
        
      case 'drug_development':
        // Focus on active development
        enhanced.filter = {
          ...enhanced.filter,
          overallStatus: ['RECRUITING', 'ACTIVE_NOT_RECRUITING', 'NOT_YET_RECRUITING']
        };
        break;
    }

    // Apply time horizon filters
    switch (context.timeHorizon) {
      case 'current':
        // Studies with activity in last 2 years
        enhanced.filter = {
          ...enhanced.filter,
          // Would need date filtering capability in API
        };
        break;
        
      case 'pipeline':
        // Future-looking studies
        enhanced.filter = {
          ...enhanced.filter,
          overallStatus: ['NOT_YET_RECRUITING', 'RECRUITING', 'ACTIVE_NOT_RECRUITING']
        };
        break;
    }

    return enhanced;
  }

  private applyIntelligentDefaults(query: StudySearchParams, strategy: EnhancedQuery['searchStrategy']): StudySearchParams {
    const enhanced = { ...query };

    // Set intelligent page size based on strategy
    if (!enhanced.pageSize) {
      switch (strategy) {
        case 'competitive':
          enhanced.pageSize = 50; // More results for competitive analysis
          break;
        case 'expanded':
          enhanced.pageSize = 30; // Moderate for expanded searches
          break;
        default:
          enhanced.pageSize = 20; // Conservative for exact matches
      }
    }

    // Set intelligent sorting
    if (!enhanced.sort) {
      enhanced.sort = [
        { field: 'LastUpdatePostDate', direction: 'desc' }
      ];
    }

    // Set useful default fields for competitive intelligence
    if (!enhanced.fields) {
      enhanced.fields = [
        'NCTId',
        'BriefTitle',
        'OverallStatus',
        'Phase',
        'Condition',
        'InterventionName',
        'LeadSponsorName',
        'StartDate',
        'CompletionDate',
        'EnrollmentCount'
      ];
    }

    return enhanced;
  }

  // Generate multiple search strategies for comprehensive coverage
  public generateSearchStrategies(params: StudySearchParams): EnhancedQuery[] {
    const strategies: EnhancedQuery[] = [];
    
    // Strategy 1: Enhanced exact search
    const exactStrategy = this.enhanceQuery(params, {
      intent: 'competitive_analysis',
      timeHorizon: 'current',
      stakeholder: 'pharma_company'
    });
    strategies.push(exactStrategy);

    // Strategy 2: Competitive landscape search
    if (params.query?.intervention) {
      const competitors = drugKnowledgeGraph.getCompetitors(params.query.intervention, params.query?.condition);
      
      competitors.forEach(competitor => {
        const competitorQuery = {
          ...params,
          query: {
            ...params.query,
            intervention: competitor
          }
        };
        
        const competitorStrategy = this.enhanceQuery(competitorQuery, {
          intent: 'competitive_analysis',
          timeHorizon: 'current',
          stakeholder: 'pharma_company'
        });
        competitorStrategy.searchStrategy = 'competitive';
        strategies.push(competitorStrategy);
      });
    }

    // Strategy 3: Therapeutic area search
    if (params.query?.intervention) {
      const therapeuticAreas = drugKnowledgeGraph.getTherapeuticArea(params.query.intervention);
      
      therapeuticAreas.forEach(area => {
        const areaQuery = {
          ...params,
          query: {
            ...params.query,
            condition: `${area} OR ${params.query?.condition || ''}`.trim()
          }
        };
        
        const areaStrategy = this.enhanceQuery(areaQuery, {
          intent: 'market_research',
          timeHorizon: 'pipeline',
          stakeholder: 'pharma_company'
        });
        areaStrategy.searchStrategy = 'therapeutic_area';
        strategies.push(areaStrategy);
      });
    }

    return strategies;
  }
}

// Singleton instance
export const queryEnhancer = new QueryEnhancer();