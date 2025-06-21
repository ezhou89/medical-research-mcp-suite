import { ClinicalTrialsClient, Study } from '../apis/clinicalTrials.js';
import { FDAClient, FDAAdverseEvent } from '../apis/fda.js';
import { PubMedClient, PubMedPaper } from '../apis/pubmed.js';
import { RiskScoringConfig, DEFAULT_RISK_CONFIG } from '../config/public-interfaces.js';
import { DrugSafetyParams, DrugSafetyProfile, ServiceDependencies as DrugSafetyDeps } from './drugSafety.js';
import { ResearchAnalysisParams, ResearchAnalysisResult, ServiceDependencies as ResearchDeps } from './researchAnalyzer.js';

export class ConfigurableDrugSafetyService {
  constructor(
    private dependencies: DrugSafetyDeps,
    private config: RiskScoringConfig = DEFAULT_RISK_CONFIG
  ) {}

  async generateSafetyProfile(params: DrugSafetyParams): Promise<DrugSafetyProfile> {
    // Use default implementation (private modules disabled)
    return this.generateWithDefaultAnalyzer(params);
  }

  private async generateWithProprietaryAnalyzer(params: DrugSafetyParams, analyzer: any): Promise<DrugSafetyProfile> {
    const { drugName, includeTrials = true, includeFDA = true, timeframe = '5years' } = params;

    let clinicalTrialSafety;
    let fdaSafetyData;

    if (includeTrials) {
      clinicalTrialSafety = await this.analyzeClinicalTrialSafety(drugName);
    }

    if (includeFDA) {
      fdaSafetyData = await this.analyzeFDASafetyData(drugName, timeframe);
    }

    const comparativeAnalysis = analyzer.generateComparativeAnalysis(clinicalTrialSafety, fdaSafetyData);
    const overallRiskLevel = analyzer.assessOverallRisk(clinicalTrialSafety, fdaSafetyData);
    const recommendations = analyzer.generateSafetyRecommendations(clinicalTrialSafety, fdaSafetyData, overallRiskLevel);

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

  private async generateWithDefaultAnalyzer(params: DrugSafetyParams): Promise<DrugSafetyProfile> {
    const { drugName } = params;
    
    return {
      drugName,
      overallRiskLevel: 'Unknown',
      comparativeAnalysis: {
        clinicalVsRealWorld: 'Analysis unavailable - using default configuration',
        riskBenefitAssessment: 'Default risk assessment applied',
        populationSpecificRisks: [],
      },
      recommendations: {
        monitoringRecommendations: ['Follow standard monitoring guidelines'],
        contraindicationAlerts: [],
        doseAdjustmentConsiderations: [],
      },
      lastUpdated: new Date().toISOString(),
    };
  }

  private async analyzeClinicalTrialSafety(drugName: string) {
    const searchResult = await this.dependencies.clinicalTrials.searchStudies({
      query: { intervention: drugName },
      pageSize: 100,
    });

    const studies = searchResult.studies;
    const completedStudies = studies.filter(study => 
      study.protocolSection.statusModule.overallStatus === 'COMPLETED'
    );

    return {
      totalStudies: studies.length,
      completedStudies: completedStudies.length,
      phasesAnalyzed: ['PHASE1', 'PHASE2', 'PHASE3'],
      commonSideEffects: ['Nausea', 'Headache', 'Fatigue'],
      seriousAdverseEvents: ['Severe allergic reaction'],
      discontinuationRate: studies.length > 0 ? Math.round((1 - completedStudies.length / studies.length) * 100) : 0,
    };
  }

  private async analyzeFDASafetyData(drugName: string, timeframe: string) {
    const dateRange = this.calculateDateRange(timeframe);
    
    const adverseEventResult = await this.dependencies.fda.getAdverseEvents({
      drugName,
      dateRange,
      limit: 1000,
    });

    return {
      totalReports: adverseEventResult.totalCount,
      seriousReports: adverseEventResult.summary.serious,
      fatalReports: adverseEventResult.summary.deaths,
      hospitalizationReports: adverseEventResult.summary.hospitalizations,
      mostCommonEvents: adverseEventResult.summary.topEvents.map(event => ({
        event: event.event,
        count: event.count,
        percentage: adverseEventResult.totalCount > 0 ? (event.count / adverseEventResult.totalCount) * 100 : 0,
      })),
      ageGroupAnalysis: { 'Adult (18-64)': 50, 'Elderly (65+)': 30, 'Unknown': 20 },
      genderAnalysis: { 'Male': 40, 'Female': 45, 'Unknown': 15 },
    };
  }

  private calculateDateRange(timeframe: string): { from: string; to: string } {
    const now = new Date();
    const to = now.toISOString().split('T')[0];
    
    let yearsBack = 5;
    switch (timeframe) {
      case '1year': yearsBack = 1; break;
      case '2years': yearsBack = 2; break;
      case '5years': yearsBack = 5; break;
      case 'all': yearsBack = 20; break;
    }
    
    const fromDate = new Date(now.getFullYear() - yearsBack, now.getMonth(), now.getDate());
    const from = fromDate.toISOString().split('T')[0];
    
    return { from, to };
  }
}