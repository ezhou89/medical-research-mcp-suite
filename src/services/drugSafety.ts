// src/services/drugSafety.ts

import { ClinicalTrialsClient, Study } from '../apis/clinicalTrials.js';
import { FDAClient, FDAAdverseEvent } from '../apis/fda.js';
// import { ProprietaryDrugSafetyAnalyzer } from '../../private/modules/drugSafetyAnalyzer.js';

// Basic stub implementation
class ProprietaryDrugSafetyAnalyzer {
  generateComparativeAnalysis(clinicalData: any, fdaData: any) {
    return {
      clinicalVsRealWorld: 'Basic analysis available',
      riskBenefitAssessment: 'Limited assessment',
      populationSpecificRisks: []
    };
  }
  
  assessOverallRisk(clinicalData: any, fdaData: any): 'Low' | 'Medium' | 'High' | 'Unknown' {
    return 'Medium';
  }
  
  generateSafetyRecommendations(clinicalData: any, fdaData: any, riskLevel: string) {
    return {
      monitoringRecommendations: ['Standard monitoring protocols'],
      contraindicationAlerts: [],
      doseAdjustmentConsiderations: []
    };
  }
}

export interface DrugSafetyParams {
  drugName: string;
  includeTrials?: boolean;
  includeFDA?: boolean;
  timeframe?: string;
}

export interface DrugSafetyProfile {
  drugName: string;
  overallRiskLevel: 'Low' | 'Medium' | 'High' | 'Unknown';
  clinicalTrialSafety?: {
    totalStudies: number;
    completedStudies: number;
    phasesAnalyzed: string[];
    commonSideEffects: string[];
    seriousAdverseEvents: string[];
    discontinuationRate?: number;
  };
  fdaSafetyData?: {
    totalReports: number;
    seriousReports: number;
    fatalReports: number;
    hospitalizationReports: number;
    mostCommonEvents: Array<{
      event: string;
      count: number;
      percentage: number;
    }>;
    ageGroupAnalysis: Record<string, number>;
    genderAnalysis: Record<string, number>;
  };
  comparativeAnalysis: {
    clinicalVsRealWorld: string;
    riskBenefitAssessment: string;
    populationSpecificRisks: string[];
  };
  recommendations: {
    monitoringRecommendations: string[];
    contraindicationAlerts: string[];
    doseAdjustmentConsiderations: string[];
  };
  lastUpdated: string;
}

export interface ServiceDependencies {
  clinicalTrials: ClinicalTrialsClient;
  fda: FDAClient;
}

export class DrugSafetyService {
  private safetyAnalyzer: ProprietaryDrugSafetyAnalyzer;

  constructor(private dependencies: ServiceDependencies) {
    this.safetyAnalyzer = new ProprietaryDrugSafetyAnalyzer();
  }

  async generateSafetyProfile(params: DrugSafetyParams): Promise<DrugSafetyProfile> {
    const {
      drugName,
      includeTrials = true,
      includeFDA = true,
      timeframe = '5years'
    } = params;

    let clinicalTrialSafety;
    let fdaSafetyData;

    // Analyze clinical trial safety data
    if (includeTrials) {
      clinicalTrialSafety = await this.analyzeClinicalTrialSafety(drugName);
    }

    // Analyze FDA adverse event data
    if (includeFDA) {
      fdaSafetyData = await this.analyzeFDASafetyData(drugName, timeframe);
    }

    // Generate comparative analysis using proprietary analyzer
    const comparativeAnalysis = this.safetyAnalyzer.generateComparativeAnalysis(
      clinicalTrialSafety,
      fdaSafetyData
    );

    // Assess overall risk level using proprietary analyzer
    const overallRiskLevel = this.safetyAnalyzer.assessOverallRisk(
      clinicalTrialSafety,
      fdaSafetyData
    );

    // Generate recommendations using proprietary analyzer
    const recommendations = this.safetyAnalyzer.generateSafetyRecommendations(
      clinicalTrialSafety,
      fdaSafetyData,
      overallRiskLevel
    );

    return {
      drugName,
      overallRiskLevel,
      clinicalTrialSafety,
      fdaSafetyData,
      comparativeAnalysis,
      recommendations,
      lastUpdated: new Date().toISOString(),
    };
  }

  private async analyzeClinicalTrialSafety(drugName: string) {
    try {
      // Search for clinical trials involving this drug
      const searchResult = await this.dependencies.clinicalTrials.searchStudies({
        query: { intervention: drugName },
        pageSize: 100,
      });

      const studies = searchResult.studies;
      const completedStudies = studies.filter(study => 
        study.protocolSection.statusModule.overallStatus === 'COMPLETED'
      );

      // Extract phases
      const phases = new Set<string>();
      studies.forEach(study => {
        const studyPhases = study.protocolSection.designModule?.phases || [];
        studyPhases.forEach(phase => phases.add(phase));
      });

      // Analyze safety outcomes (simplified - in production you'd parse actual safety data)
      const commonSideEffects = this.extractCommonSideEffects(studies);
      const seriousAdverseEvents = this.extractSeriousAdverseEvents(studies);

      return {
        totalStudies: studies.length,
        completedStudies: completedStudies.length,
        phasesAnalyzed: Array.from(phases),
        commonSideEffects,
        seriousAdverseEvents,
        discontinuationRate: this.calculateDiscontinuationRate(studies),
      };
    } catch (error) {
      console.error('Error analyzing clinical trial safety:', error);
      return undefined;
    }
  }

  private async analyzeFDASafetyData(drugName: string, timeframe: string) {
    try {
      // Calculate date range based on timeframe
      const dateRange = this.calculateDateRange(timeframe);
      
      // Get adverse event data from FDA
      const adverseEventResult = await this.dependencies.fda.getAdverseEvents({
        drugName,
        dateRange,
        limit: 1000,
      });

      const events = adverseEventResult.events;
      
      // Analyze age groups
      const ageGroupAnalysis = this.analyzeAgeGroups(events);
      
      // Analyze gender distribution
      const genderAnalysis = this.analyzeGenderDistribution(events);
      
      // Calculate percentages for common events
      const totalReports = events.length;
      const mostCommonEvents = adverseEventResult.summary.topEvents.map(event => ({
        event: event.event,
        count: event.count,
        percentage: totalReports > 0 ? (event.count / totalReports) * 100 : 0,
      }));

      return {
        totalReports: adverseEventResult.totalCount,
        seriousReports: adverseEventResult.summary.serious,
        fatalReports: adverseEventResult.summary.deaths,
        hospitalizationReports: adverseEventResult.summary.hospitalizations,
        mostCommonEvents,
        ageGroupAnalysis,
        genderAnalysis,
      };
    } catch (error) {
      console.error('Error analyzing FDA safety data:', error);
      return undefined;
    }
  }

  private extractCommonSideEffects(studies: Study[]): string[] {
    // Simplified extraction - in production, you'd parse actual clinical trial results
    const commonEffects = [
      'Nausea', 'Headache', 'Fatigue', 'Dizziness', 'Diarrhea',
      'Constipation', 'Insomnia', 'Decreased appetite', 'Dry mouth'
    ];
    
    // Return subset based on study type and phase
    const hasEarlyPhase = studies.some(study => 
      study.protocolSection.designModule?.phases?.includes('PHASE1')
    );
    
    return hasEarlyPhase ? commonEffects.slice(0, 6) : commonEffects.slice(0, 4);
  }

  private extractSeriousAdverseEvents(studies: Study[]): string[] {
    // Simplified extraction - in production, you'd parse actual safety data
    const seriousEvents = [
      'Severe allergic reaction', 'Liver toxicity', 'Cardiac arrhythmia',
      'Severe skin reaction', 'Respiratory distress'
    ];
    
    // Return subset based on study characteristics
    const hasPhase3 = studies.some(study => 
      study.protocolSection.designModule?.phases?.includes('PHASE3')
    );
    
    return hasPhase3 ? seriousEvents.slice(0, 3) : seriousEvents.slice(0, 2);
  }

  private calculateDiscontinuationRate(studies: Study[]): number {
    // Simplified calculation - in production, you'd parse actual enrollment data
    const completedStudies = studies.filter(study => 
      study.protocolSection.statusModule.overallStatus === 'COMPLETED'
    ).length;
    
    // Estimate discontinuation rate based on study completion
    if (studies.length === 0) return 0;
    
    const completionRate = completedStudies / studies.length;
    return Math.round((1 - completionRate) * 100); // Rough estimate
  }

  private calculateDateRange(timeframe: string): { from: string; to: string } {
    const now = new Date();
    const to = now.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    let yearsBack = 5;
    switch (timeframe) {
      case '1year':
        yearsBack = 1;
        break;
      case '2years':
        yearsBack = 2;
        break;
      case '5years':
        yearsBack = 5;
        break;
      case 'all':
        yearsBack = 20;
        break;
    }
    
    const fromDate = new Date(now.getFullYear() - yearsBack, now.getMonth(), now.getDate());
    const from = fromDate.toISOString().split('T')[0];
    
    return { from, to };
  }

  private analyzeAgeGroups(events: FDAAdverseEvent[]): Record<string, number> {
    const ageGroups = {
      'Unknown': 0,
      'Pediatric (0-17)': 0,
      'Adult (18-64)': 0,
      'Elderly (65+)': 0,
    };

    events.forEach(event => {
      if (!event.patientAge) {
        ageGroups['Unknown']++;
      } else if (event.patientAge < 18) {
        ageGroups['Pediatric (0-17)']++;
      } else if (event.patientAge < 65) {
        ageGroups['Adult (18-64)']++;
      } else {
        ageGroups['Elderly (65+)']++;
      }
    });

    return ageGroups;
  }

  private analyzeGenderDistribution(events: FDAAdverseEvent[]): Record<string, number> {
    const genderCounts = {
      'Male': 0,
      'Female': 0,
      'Unknown': 0,
    };

    events.forEach(event => {
      switch (event.patientSex) {
        case 'Male':
          genderCounts['Male']++;
          break;
        case 'Female':
          genderCounts['Female']++;
          break;
        default:
          genderCounts['Unknown']++;
      }
    });

    return genderCounts;
  }

}
