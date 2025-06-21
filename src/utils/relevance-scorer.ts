// src/utils/relevance-scorer.ts

import { Study } from '../apis/clinicalTrials.js';
import { drugKnowledgeGraph } from './drug-knowledge-graph.js';

export interface RelevanceScore {
  score: number; // 0-100
  factors: RelevanceFactor[];
  category: 'highly_relevant' | 'relevant' | 'somewhat_relevant' | 'not_relevant';
  explanation: string;
}

export interface RelevanceFactor {
  factor: string;
  weight: number;
  score: number;
  contribution: number;
  explanation: string;
}

export interface ScoredStudy {
  study: Study;
  relevanceScore: RelevanceScore;
}

export interface ScoringContext {
  primaryDrug?: string;
  primaryIndication?: string;
  intent: 'competitive_analysis' | 'drug_development' | 'safety_monitoring' | 'market_research' | 'general';
  userCompany?: string;
}

export class RelevanceScorer {
  
  public scoreStudy(study: Study, context: ScoringContext): RelevanceScore {
    const factors: RelevanceFactor[] = [];
    
    // Factor 1: Intervention/Drug Relevance (30% weight)
    const drugRelevance = this.scoreDrugRelevance(study, context);
    factors.push(drugRelevance);
    
    // Factor 2: Indication/Condition Relevance (25% weight)
    const indicationRelevance = this.scoreIndicationRelevance(study, context);
    factors.push(indicationRelevance);
    
    // Factor 3: Study Phase Relevance (20% weight)
    const phaseRelevance = this.scorePhaseRelevance(study, context);
    factors.push(phaseRelevance);
    
    // Factor 4: Study Status Relevance (15% weight)
    const statusRelevance = this.scoreStatusRelevance(study, context);
    factors.push(statusRelevance);
    
    // Factor 5: Sponsor/Company Relevance (10% weight)
    const sponsorRelevance = this.scoreSponsorRelevance(study, context);
    factors.push(sponsorRelevance);
    
    // Calculate weighted score
    const totalScore = factors.reduce((sum, factor) => sum + factor.contribution, 0);
    
    // Determine category
    let category: RelevanceScore['category'];
    if (totalScore >= 80) category = 'highly_relevant';
    else if (totalScore >= 60) category = 'relevant';
    else if (totalScore >= 40) category = 'somewhat_relevant';
    else category = 'not_relevant';
    
    // Generate explanation
    const explanation = this.generateExplanation(factors, category);
    
    return {
      score: Math.round(totalScore),
      factors,
      category,
      explanation
    };
  }
  
  private scoreDrugRelevance(study: Study, context: ScoringContext): RelevanceFactor {
    const weight = 0.30;
    let score = 0;
    let explanation = '';
    
    const interventions = this.extractInterventions(study);
    
    if (context.primaryDrug) {
      const drugInfo = drugKnowledgeGraph.getDrugInfo(context.primaryDrug);
      const expandedDrugs = drugInfo ? drugKnowledgeGraph.expandDrugQuery(context.primaryDrug) : [context.primaryDrug];
      
      // Exact match
      const exactMatch = interventions.some(intervention => 
        expandedDrugs.some(drug => 
          intervention.toLowerCase().includes(drug.toLowerCase())
        )
      );
      
      if (exactMatch) {
        score = 100;
        explanation = `Direct match with ${context.primaryDrug}`;
      } else {
        // Check for competitive drugs
        const competitors = drugInfo ? drugKnowledgeGraph.getCompetitors(context.primaryDrug, context.primaryIndication) : [];
        const competitorMatch = interventions.some(intervention =>
          competitors.some(competitor =>
            intervention.toLowerCase().includes(competitor.toLowerCase())
          )
        );
        
        if (competitorMatch) {
          score = 70;
          explanation = `Contains competitive drug`;
        } else {
          // Check for same mechanism/therapeutic area
          if (drugInfo) {
            const mechanismMatch = interventions.some(intervention =>
              intervention.toLowerCase().includes(drugInfo.mechanismOfAction.toLowerCase())
            );
            
            if (mechanismMatch) {
              score = 50;
              explanation = `Same mechanism of action`;
            } else {
              score = 20;
              explanation = `Different therapeutic approach`;
            }
          } else {
            score = 10;
            explanation = `No clear drug relationship`;
          }
        }
      }
    } else {
      score = 50; // Neutral if no primary drug specified
      explanation = 'No primary drug specified for comparison';
    }
    
    return {
      factor: 'Drug/Intervention Relevance',
      weight,
      score,
      contribution: score * weight,
      explanation
    };
  }
  
  private scoreIndicationRelevance(study: Study, context: ScoringContext): RelevanceFactor {
    const weight = 0.25;
    let score = 0;
    let explanation = '';
    
    const conditions = this.extractConditions(study);
    
    if (context.primaryIndication) {
      const indicationInfo = drugKnowledgeGraph.getIndicationInfo(context.primaryIndication);
      const expandedIndications = indicationInfo ? 
        drugKnowledgeGraph.expandIndicationQuery(context.primaryIndication) : 
        [context.primaryIndication];
      
      // Exact match
      const exactMatch = conditions.some(condition =>
        expandedIndications.some(indication =>
          condition.toLowerCase().includes(indication.toLowerCase())
        )
      );
      
      if (exactMatch) {
        score = 100;
        explanation = `Direct match with ${context.primaryIndication}`;
      } else {
        // Check for related conditions
        const relatedConditions = indicationInfo?.relatedConditions || [];
        const relatedMatch = conditions.some(condition =>
          relatedConditions.some(related =>
            condition.toLowerCase().includes(related.toLowerCase())
          )
        );
        
        if (relatedMatch) {
          score = 60;
          explanation = `Related indication match`;
        } else {
          // Check for same therapeutic area
          const therapeuticArea = indicationInfo?.therapeuticArea;
          if (therapeuticArea) {
            const areaMatch = conditions.some(condition =>
              condition.toLowerCase().includes(therapeuticArea.toLowerCase())
            );
            
            if (areaMatch) {
              score = 40;
              explanation = `Same therapeutic area`;
            } else {
              score = 10;
              explanation = `Different therapeutic area`;
            }
          } else {
            score = 20;
            explanation = `Unclear indication relationship`;
          }
        }
      }
    } else {
      score = 50; // Neutral if no primary indication specified
      explanation = 'No primary indication specified for comparison';
    }
    
    return {
      factor: 'Indication/Condition Relevance',
      weight,
      score,
      contribution: score * weight,
      explanation
    };
  }
  
  private scorePhaseRelevance(study: Study, context: ScoringContext): RelevanceFactor {
    const weight = 0.20;
    let score = 50; // Default neutral score
    let explanation = '';
    
    const phases = this.extractPhases(study);
    
    switch (context.intent) {
      case 'competitive_analysis':
        if (phases.includes('PHASE3') || phases.includes('PHASE4')) {
          score = 90;
          explanation = 'Late-stage development - high competitive relevance';
        } else if (phases.includes('PHASE2')) {
          score = 70;
          explanation = 'Mid-stage development - moderate competitive relevance';
        } else if (phases.includes('PHASE1')) {
          score = 40;
          explanation = 'Early-stage development - lower competitive urgency';
        }
        break;
        
      case 'safety_monitoring':
        if (phases.includes('PHASE4')) {
          score = 100;
          explanation = 'Post-market surveillance - highest safety relevance';
        } else if (phases.includes('PHASE3')) {
          score = 80;
          explanation = 'Large-scale safety data available';
        } else if (phases.includes('PHASE2')) {
          score = 60;
          explanation = 'Moderate safety data available';
        }
        break;
        
      case 'market_research':
        if (phases.includes('PHASE3') || phases.includes('PHASE4')) {
          score = 85;
          explanation = 'Near-market or marketed - high market relevance';
        } else if (phases.includes('PHASE2')) {
          score = 60;
          explanation = 'Potential future market entry';
        }
        break;
    }
    
    return {
      factor: 'Study Phase Relevance',
      weight,
      score,
      contribution: score * weight,
      explanation
    };
  }
  
  private scoreStatusRelevance(study: Study, context: ScoringContext): RelevanceFactor {
    const weight = 0.15;
    let score = 50;
    let explanation = '';
    
    const status = study.protocolSection.statusModule.overallStatus;
    
    switch (context.intent) {
      case 'competitive_analysis':
        if (['RECRUITING', 'ACTIVE_NOT_RECRUITING'].includes(status)) {
          score = 90;
          explanation = 'Active development - immediate competitive concern';
        } else if (status === 'COMPLETED') {
          score = 80;
          explanation = 'Recently completed - results may impact competition';
        } else if (status === 'NOT_YET_RECRUITING') {
          score = 70;
          explanation = 'Planned development - future competitive concern';
        } else if (['TERMINATED', 'SUSPENDED'].includes(status)) {
          score = 30;
          explanation = 'Development halted - reduced competitive threat';
        }
        break;
        
      case 'safety_monitoring':
        if (status === 'COMPLETED') {
          score = 100;
          explanation = 'Completed study - safety data available';
        } else if (['TERMINATED', 'SUSPENDED'].includes(status)) {
          score = 90;
          explanation = 'Halted study - potential safety signals';
        }
        break;
    }
    
    return {
      factor: 'Study Status Relevance',
      weight,
      score,
      contribution: score * weight,
      explanation
    };
  }
  
  private scoreSponsorRelevance(study: Study, context: ScoringContext): RelevanceFactor {
    const weight = 0.10;
    let score = 50;
    let explanation = '';
    
    const sponsor = study.protocolSection.sponsorCollaboratorsModule?.leadSponsor?.name || '';
    
    // Major pharma companies in relevant therapeutic areas
    const majorPharmaCompanies = [
      'Roche', 'Genentech', 'Regeneron', 'Novartis', 'Bayer', 'Johnson & Johnson',
      'Pfizer', 'Merck', 'Bristol Myers Squibb', 'AbbVie', 'Amgen'
    ];
    
    if (context.userCompany && sponsor.toLowerCase().includes(context.userCompany.toLowerCase())) {
      score = 100;
      explanation = 'Same company - direct internal relevance';
    } else if (majorPharmaCompanies.some(company => sponsor.toLowerCase().includes(company.toLowerCase()))) {
      score = 80;
      explanation = 'Major pharmaceutical company - high competitive relevance';
    } else if (sponsor.toLowerCase().includes('university') || sponsor.toLowerCase().includes('hospital')) {
      score = 60;
      explanation = 'Academic/medical institution - moderate relevance';
    } else {
      score = 40;
      explanation = 'Other sponsor - basic relevance';
    }
    
    return {
      factor: 'Sponsor/Company Relevance',
      weight,
      score,
      contribution: score * weight,
      explanation
    };
  }
  
  private generateExplanation(factors: RelevanceFactor[], category: RelevanceScore['category']): string {
    const topFactors = factors
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, 2);
    
    const topExplanations = topFactors.map(f => f.explanation).join('; ');
    
    const categoryDescriptions = {
      'highly_relevant': 'This study is highly relevant to your query',
      'relevant': 'This study has good relevance to your query',
      'somewhat_relevant': 'This study has some relevance to your query',
      'not_relevant': 'This study has limited relevance to your query'
    };
    
    return `${categoryDescriptions[category]}. ${topExplanations}.`;
  }
  
  // Helper methods to extract data from study
  private extractInterventions(study: Study): string[] {
    const interventions: string[] = [];
    
    // From interventions module
    if (study.protocolSection.interventionsModule?.interventions) {
      study.protocolSection.interventionsModule.interventions.forEach(intervention => {
        if (intervention.name) interventions.push(intervention.name);
      });
    }
    
    // From title
    if (study.protocolSection.identificationModule.briefTitle) {
      interventions.push(study.protocolSection.identificationModule.briefTitle);
    }
    
    return interventions;
  }
  
  private extractConditions(study: Study): string[] {
    const conditions: string[] = [];
    
    // From conditions module
    if (study.protocolSection.conditionsModule?.conditions) {
      conditions.push(...study.protocolSection.conditionsModule.conditions);
    }
    
    return conditions;
  }
  
  private extractPhases(study: Study): string[] {
    return study.protocolSection.designModule?.phases || [];
  }
  
  // Batch scoring for multiple studies
  public scoreStudies(studies: Study[], context: ScoringContext): ScoredStudy[] {
    return studies
      .map(study => ({
        study,
        relevanceScore: this.scoreStudy(study, context)
      }))
      .sort((a, b) => b.relevanceScore.score - a.relevanceScore.score);
  }
}

// Singleton instance
export const relevanceScorer = new RelevanceScorer();