// src/services/researchAnalyzer.ts

import { ClinicalTrialsClient, Study } from '../apis/clinicalTrials.js';
import { PubMedClient, PubMedPaper } from '../apis/pubmed.js';
import { FDAClient, FDADrug } from '../apis/fda.js';
// import { ProprietaryResearchAnalyzer } from '../../private/modules/researchAnalyzer.js';

// Basic stub implementation for proprietary analyzer
class ProprietaryResearchAnalyzer {
  generateInsights(trialAnalysis: any, literatureAnalysis: any, fdaAnalysis: any, depth: string): string[] {
    return ['Basic analysis available', 'Contact provider for advanced insights'];
  }
  
  assessRisk(trialAnalysis: any, fdaAnalysis: any) {
    return { level: 'Medium' as const, factors: ['Limited proprietary analysis'] };
  }
  
  analyzeMarket(drugName: string, condition: string, trialAnalysis: any, fdaAnalysis: any) {
    return {
      competitivePosition: 'Analysis unavailable',
      marketOpportunity: 'Basic assessment only',
      keyCompetitors: []
    };
  }
  
  generateRecommendations(insights: string[], riskProfile: any, marketAnalysis: any): string[] {
    return ['Upgrade to advanced analysis package for detailed recommendations'];
  }
}

export interface ResearchAnalysisParams {
  drugName: string;
  condition: string;
  trials: Study[];
  literature: PubMedPaper[];
  fdaData: FDADrug[];
  depth: 'basic' | 'detailed' | 'comprehensive';
}

export interface ResearchAnalysisResult {
  executiveSummary: string;
  trialsByPhase: Record<string, number>;
  recruitmentStatus: Record<string, number>;
  literatureKeyFindings: string[];
  publicationTrends: {
    totalPapers: number;
    recentPapers: number; // Last 2 years
    keyJournals: string[];
  };
  approvalStatus: string;
  adverseEventSummary: {
    totalEvents: number;
    seriousEvents: number;
    commonEvents: string[];
  };
  keyInsights: string[];
  riskProfile: {
    level: 'Low' | 'Medium' | 'High';
    factors: string[];
  };
  marketAnalysis: {
    competitivePosition: string;
    marketOpportunity: string;
    keyCompetitors: string[];
  };
  recommendedActions: string[];
}

export interface ServiceDependencies {
  clinicalTrials: ClinicalTrialsClient;
  pubmed: PubMedClient;
  fda: FDAClient;
}

export class ResearchAnalyzer {
  private proprietaryAnalyzer: ProprietaryResearchAnalyzer;

  constructor(private dependencies: ServiceDependencies) {
    this.proprietaryAnalyzer = new ProprietaryResearchAnalyzer();
  }

  async comprehensiveAnalysis(params: ResearchAnalysisParams): Promise<ResearchAnalysisResult> {
    const {
      drugName,
      condition,
      trials,
      literature,
      fdaData,
      depth
    } = params;

    // Analyze clinical trials
    const trialAnalysis = this.analyzeTrials(trials);
    
    // Analyze literature
    const literatureAnalysis = this.analyzeLiterature(literature);
    
    // Analyze FDA data
    const fdaAnalysis = this.analyzeFDAData(fdaData);
    
    // Generate insights using proprietary analyzer
    const insights = this.proprietaryAnalyzer.generateInsights(trialAnalysis, literatureAnalysis, fdaAnalysis, depth);
    
    // Generate risk assessment using proprietary analyzer
    const riskProfile = this.proprietaryAnalyzer.assessRisk(trialAnalysis, fdaAnalysis);
    
    // Generate market analysis using proprietary analyzer
    const marketAnalysis = this.proprietaryAnalyzer.analyzeMarket(drugName, condition, trialAnalysis, fdaAnalysis);
    
    // Generate recommendations using proprietary analyzer
    const recommendedActions = this.proprietaryAnalyzer.generateRecommendations(insights, riskProfile, marketAnalysis);

    return {
      executiveSummary: this.generateExecutiveSummary(drugName, condition, insights),
      trialsByPhase: trialAnalysis.phaseDistribution,
      recruitmentStatus: trialAnalysis.statusDistribution,
      literatureKeyFindings: literatureAnalysis.keyFindings,
      publicationTrends: literatureAnalysis.trends,
      approvalStatus: fdaAnalysis.approvalStatus,
      adverseEventSummary: fdaAnalysis.adverseEventSummary,
      keyInsights: insights,
      riskProfile,
      marketAnalysis,
      recommendedActions,
    };
  }

  private analyzeTrials(trials: Study[]) {
    const phaseDistribution: Record<string, number> = {};
    const statusDistribution: Record<string, number> = {};
    const sponsorDistribution: Record<string, number> = {};
    
    trials.forEach(trial => {
      // Phase distribution
      const phase = trial.protocolSection.designModule?.phases?.[0] || 'Unknown';
      phaseDistribution[phase] = (phaseDistribution[phase] || 0) + 1;
      
      // Status distribution
      const status = trial.protocolSection.statusModule.overallStatus;
      statusDistribution[status] = (statusDistribution[status] || 0) + 1;
      
      // Sponsor distribution
      const sponsor = trial.protocolSection.sponsorCollaboratorsModule?.leadSponsor?.name || 'Unknown';
      sponsorDistribution[sponsor] = (sponsorDistribution[sponsor] || 0) + 1;
    });

    // Calculate success metrics
    const completedTrials = trials.filter(t => 
      t.protocolSection.statusModule.overallStatus === 'COMPLETED'
    ).length;
    
    const activeTrials = trials.filter(t => 
      ['RECRUITING', 'ACTIVE_NOT_RECRUITING', 'ENROLLING_BY_INVITATION'].includes(
        t.protocolSection.statusModule.overallStatus
      )
    ).length;

    return {
      total: trials.length,
      phaseDistribution,
      statusDistribution,
      sponsorDistribution,
      completedTrials,
      activeTrials,
      successRate: trials.length > 0 ? (completedTrials / trials.length) : 0,
    };
  }

  private analyzeLiterature(papers: PubMedPaper[]) {
    const currentYear = new Date().getFullYear();
    const twoYearsAgo = currentYear - 2;
    
    // Analyze publication trends
    const recentPapers = papers.filter(paper => {
      const pubYear = parseInt(paper.publicationDate.split('-')[0]);
      return pubYear >= twoYearsAgo;
    }).length;

    // Extract key journals
    const journalCounts = new Map<string, number>();
    papers.forEach(paper => {
      journalCounts.set(paper.journal, (journalCounts.get(paper.journal) || 0) + 1);
    });
    
    const keyJournals = Array.from(journalCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([journal]) => journal);

    // Extract key findings from abstracts
    const keyFindings = this.extractKeyFindings(papers);

    return {
      total: papers.length,
      trends: {
        totalPapers: papers.length,
        recentPapers,
        keyJournals,
      },
      keyFindings,
    };
  }

  private extractKeyFindings(papers: PubMedPaper[]): string[] {
    const findings: string[] = [];
    
    // Simple keyword-based extraction (in production, you'd use NLP)
    const significantKeywords = [
      'significant', 'effective', 'efficacy', 'safety', 'adverse',
      'improved', 'reduced', 'increased', 'demonstrated', 'showed'
    ];

    papers.slice(0, 5).forEach(paper => { // Analyze first 5 papers
      if (paper.abstract) {
        const sentences = paper.abstract.split(/[.!?]+/);
        sentences.forEach(sentence => {
          const lowerSentence = sentence.toLowerCase();
          if (significantKeywords.some(keyword => lowerSentence.includes(keyword))) {
            findings.push(sentence.trim());
          }
        });
      }
    });

    return findings.slice(0, 10); // Return top 10 findings
  }

  private analyzeFDAData(fdaData: FDADrug[]) {
    let approvalStatus = 'Not found in FDA database';
    let adverseEventSummary = {
      totalEvents: 0,
      seriousEvents: 0,
      commonEvents: [] as string[],
    };

    if (fdaData.length > 0) {
      const drug = fdaData[0];
      approvalStatus = `${drug.approvalStatus} - Approved ${drug.approvalDate}`;
    }

    return {
      approvalStatus,
      adverseEventSummary,
      totalApprovedProducts: fdaData.length,
    };
  }


  private generateExecutiveSummary(
    drugName: string,
    condition: string,
    insights: string[]
  ): string {
    const keyInsight = insights[0] || 'Limited data available';
    
    return `Analysis of ${drugName} for ${condition}: ${keyInsight}. ` +
           `Comprehensive review across clinical trials, literature, and regulatory databases ` +
           `reveals ${insights.length} key insights for strategic decision-making.`;
  }
}
