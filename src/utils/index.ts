// src/utils/index.ts

export { Cache, CacheOptions, CacheEntry, clinicalTrialsCache, pubmedCache, fdaCache } from './cache.js';
export { 
  default as logger, 
  apiLogger, 
  cacheLogger, 
  mcpLogger,
  logAPICall,
  logCacheOperation,
  logMCPOperation,
  logSecurityEvent,
  performanceMonitor,
  createErrorWithContext
} from './logger.js';
export { 
  Validator,
  ValidationResult,
  ValidationRule,
  CommonValidators,
  ValidationRules,
  Sanitizer
} from './validators.js';

// Query Enhancement
export {
  QueryEnhancer,
  queryEnhancer,
  type QueryEnhancementOptions,
  type EnhancedQuery,
  type MedicalSynonym
} from './query-enhancer.js';

// Relevance Scoring (temporarily disabled due to Study interface issues)
// export {
//   RelevanceScorer,
//   relevanceScorer,
//   type RelevanceScore,
//   type ScoringContext,
//   type WeightedScoringParams,
//   type ScoringProfile
// } from './relevance-scorer.js';

// Drug Knowledge Graph
export {
  DrugKnowledgeGraph,
  drugKnowledgeGraph,
  type DrugNode,
  type RelationshipEdge,
  type RelationshipType,
  type DrugPath,
  type DrugCluster,
  type KnowledgeGraphQuery,
  type GraphAnalytics
} from './drug-knowledge-graph.js';

// Advanced Relevance Filtering (temporarily disabled due to Study interface issues)
// export {
//   AdvancedRelevanceFilter,
//   advancedRelevanceFilter,
//   type FilterCriteria,
//   type FilterResult,
//   type FilterStats,
//   type FilterProfile
// } from './advanced-relevance-filter.js';

// Cross-API Validation (temporarily disabled due to Study interface issues)
// export {
//   CrossAPIValidator,
//   crossAPIValidator,
//   type ValidationResult as CrossValidationResult,
//   type ValidationDiscrepancy,
//   type CrossReference,
//   type ValidationRule as CrossValidationRule,
//   type DataConsistencyReport,
//   type ValidationContext
// } from './cross-api-validator.js';

// Machine Learning Drug Classification (temporarily disabled due to Study interface issues)
// export {
//   MLDrugClassifier,
//   mlDrugClassifier,
//   type ClassificationResult,
//   type DrugProfile,
//   type SafetyProfile,
//   type FeatureVector,
//   type TrainingData,
//   type ModelConfig,
//   type ClassificationType
// } from './ml-drug-classifier.js';

// Knowledge System Maintenance
export {
  KnowledgeUpdater,
  knowledgeUpdater,
  type UpdateTask,
  type UpdateType,
  type TaskPriority,
  type TaskStatus,
  type UpdateFrequency,
  type UpdateResult,
  type UpdateError,
  type PerformanceMetrics,
  type MaintenanceSchedule,
  type ResourceRequirements,
  type SystemHealth,
  type ComponentHealth
} from './knowledge-updater.js';

// Response Size Monitoring
export {
  ResponseSizeMonitor,
  checkResponseSize,
  type SizeConfig,
  type SizeMetrics,
  type SizeExceededInfo
} from './responseSizeMonitor.js';

// Progressive Loading
export {
  ProgressiveLoader,
  type ProgressiveLoadingConfig,
  type ProgressiveLoadingProgress,
  type BatchInfo,
  type ProgressiveLoadingResult,
  type ProgressiveLoadingError,
  type ProgressiveLoadingResponse,
  type DataLoader
} from './progressiveLoader.js';
