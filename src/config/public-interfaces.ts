export interface PublicRiskThresholds {
  clinicalTrial: {
    discontinuationRate: number;
    seriousAdverseEventsCount: number;
    completionRateThreshold: number;
  };
  fda: {
    fatalityRateThreshold: number;
    seriousEventRateThreshold: number;
    hospitalizationRateThreshold: number;
  };
  comparative: {
    realWorldClinicalRatio: number;
    alignmentThreshold: number;
  };
  population: {
    elderlyAgeThreshold: number;
    femaleRiskMultiplier: number;
  };
  riskScoring: {
    highRiskThreshold: number;
    mediumRiskThreshold: number;
    strengthDevelopmentThreshold: number;
    publicationRecencyYears: number;
  };
}

export interface PublicScoringWeights {
  discontinuationWeight: number;
  seriousEventsWeight: number;
  fatalityWeight: number;
  hospitalizationWeight: number;
  limitedDataPenalty: number;
  incompletionPenalty: number;
  noPhase3Penalty: number;
  noApprovalPenalty: number;
}

export interface RiskScoringConfig {
  thresholds: PublicRiskThresholds;
  weights: PublicScoringWeights;
}

export const DEFAULT_RISK_CONFIG: RiskScoringConfig = {
  thresholds: {
    clinicalTrial: {
      discontinuationRate: 0.25,
      seriousAdverseEventsCount: 5,
      completionRateThreshold: 0.6,
    },
    fda: {
      fatalityRateThreshold: 0.02,
      seriousEventRateThreshold: 0.15,
      hospitalizationRateThreshold: 0.08,
    },
    comparative: {
      realWorldClinicalRatio: 2.0,
      alignmentThreshold: 0.4,
    },
    population: {
      elderlyAgeThreshold: 70,
      femaleRiskMultiplier: 1.3,
    },
    riskScoring: {
      highRiskThreshold: 4,
      mediumRiskThreshold: 2,
      strengthDevelopmentThreshold: 0.6,
      publicationRecencyYears: 3,
    },
  },
  weights: {
    discontinuationWeight: 1,
    seriousEventsWeight: 1,
    fatalityWeight: 1,
    hospitalizationWeight: 1,
    limitedDataPenalty: 1,
    incompletionPenalty: 1,
    noPhase3Penalty: 1,
    noApprovalPenalty: 1,
  },
};