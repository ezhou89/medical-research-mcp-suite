// src/utils/competitive-threat-detector.ts
// PROPRIETARY: Advanced threat detection and competitive monitoring

import { Study } from '../apis/clinicalTrials.js';
import { Alert, AlertType } from './intelligent-alerting-system.js';

export interface ThreatDetectionRule {
  id: string;
  name: string;
  threatType: ThreatType;
  monitoredEntities: MonitoredEntity[];
  detectionCriteria: DetectionCriteria[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  responseActions: ResponseAction[];
  isActive: boolean;
  createdAt: Date;
  lastTriggered?: Date;
}

export type ThreatType = 
  | 'new_competitor_entry'
  | 'competitive_acceleration' 
  | 'patent_challenge'
  | 'regulatory_setback'
  | 'market_share_erosion'
  | 'pricing_pressure'
  | 'technology_leapfrog'
  | 'partnership_threat'
  | 'acquisition_risk'
  | 'supply_disruption'
  | 'safety_advantage'
  | 'efficacy_superiority';

export interface MonitoredEntity {
  type: 'drug' | 'company' | 'indication' | 'technology' | 'market_segment';
  name: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  watchlist: WatchlistItem[];
}

export interface WatchlistItem {
  entity: string;
  reason: string;
  addedDate: Date;
  lastActivity?: Date;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface DetectionCriteria {
  dataSource: string;
  trigger: ThreatTrigger;
  threshold: number;
  timeWindow: string; // e.g., "30d", "6m"
  conditions: ThreatCondition[];
}

export interface ThreatTrigger {
  type: 'value_change' | 'trend_reversal' | 'anomaly_detection' | 'pattern_match' | 'threshold_breach';
  parameters: { [key: string]: any };
}

export interface ThreatCondition {
  field: string;
  operator: 'gt' | 'lt' | 'eq' | 'contains' | 'increases_by' | 'decreases_by';
  value: any;
  weight: number; // Importance of this condition 0-1
}

export interface ResponseAction {
  action: 'alert' | 'escalate' | 'investigate' | 'monitor' | 'counter_strategy';
  priority: 'immediate' | 'urgent' | 'normal' | 'low';
  assignee?: string;
  instructions: string;
  automatable: boolean;
}

export interface CompetitiveThreat {
  id: string;
  type: ThreatType;
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
  source: ThreatSource;
  targetEntity: string; // What's being threatened (our drug/position)
  threateningEntity: string; // Who/what is the threat
  description: string;
  evidence: ThreatEvidence[];
  impact: ThreatImpact;
  timeline: ThreatTimeline;
  confidence: number; // 0-1
  detectedAt: Date;
  status: 'new' | 'investigating' | 'confirmed' | 'mitigated' | 'false_positive';
  assignedTo?: string;
  responseStrategy: ResponseStrategy;
  relatedThreats: string[];
}

export interface ThreatSource {
  type: 'clinical_trial' | 'patent_filing' | 'publication' | 'sec_filing' | 'news' | 'conference' | 'regulatory';
  specifics: string;
  reliability: number; // 0-1
  timestamp: Date;
}

export interface ThreatEvidence {
  type: 'quantitative' | 'qualitative' | 'circumstantial';
  description: string;
  value?: number;
  source: string;
  confidence: number; // 0-1
  verificationStatus: 'unverified' | 'verified' | 'disputed';
}

export interface ThreatImpact {
  businessImpact: BusinessImpact;
  competitiveImpact: CompetitiveImpact;
  timeToImpact: number; // months
  reversibility: 'irreversible' | 'difficult' | 'moderate' | 'easy';
  cascadeEffects: string[];
}

export interface BusinessImpact {
  revenueAtRisk: number;
  marketShareAtRisk: number; // percentage
  affectedSegments: string[];
  strategicValue: 'low' | 'medium' | 'high' | 'critical';
}

export interface CompetitiveImpact {
  positionThreat: 'minor' | 'moderate' | 'significant' | 'severe';
  advantageErosion: string[];
  newCompetitiveGaps: string[];
  responseComplexity: 'simple' | 'moderate' | 'complex' | 'extremely_complex';
}

export interface ThreatTimeline {
  immediateActions: TimelineAction[];
  shortTermActions: TimelineAction[];
  longTermActions: TimelineAction[];
  criticalMilestones: CriticalMilestone[];
}

export interface TimelineAction {
  action: string;
  timeframe: string;
  responsibility: string;
  dependencies: string[];
  successMetrics: string[];
}

export interface CriticalMilestone {
  milestone: string;
  expectedDate: Date;
  impact: string;
  responseWindow: string; // How long we have to respond
}

export interface ResponseStrategy {
  primaryStrategy: 'defensive' | 'offensive' | 'adaptive' | 'disruptive';
  tacticalMoves: TacticalMove[];
  resourceRequirements: ResourceRequirement[];
  successProbability: number; // 0-1
  estimatedCost: number;
  timeline: string;
}

export interface TacticalMove {
  move: string;
  type: 'immediate' | 'short_term' | 'long_term';
  effectiveness: number; // 0-1
  riskLevel: 'low' | 'medium' | 'high';
  dependencies: string[];
}

export interface ResourceRequirement {
  type: 'financial' | 'personnel' | 'technology' | 'partnership';
  amount: string;
  urgency: 'immediate' | 'short_term' | 'medium_term';
  availability: 'available' | 'limited' | 'unavailable';
}

export interface ThreatIntelligence {
  activeThreatCount: number;
  threatDistribution: { [type: string]: number };
  avgThreatLevel: number;
  emergingPatterns: EmergingPattern[];
  blindSpots: BlindSpot[];
  recommendedActions: string[];
}

export interface EmergingPattern {
  pattern: string;
  occurrences: number;
  trendDirection: 'increasing' | 'stable' | 'decreasing';
  significance: 'low' | 'medium' | 'high';
  implications: string[];
}

export interface BlindSpot {
  area: string;
  riskLevel: 'low' | 'medium' | 'high';
  recommendations: string[];
  dataGaps: string[];
}

export class CompetitiveThreatDetector {
  private detectionRules = new Map<string, ThreatDetectionRule>();
  private activeThreats = new Map<string, CompetitiveThreat>();
  private watchlists = new Map<string, MonitoredEntity>();
  private detectionEngine = new ThreatDetectionEngine();
  private responseEngine = new ThreatResponseEngine();
  
  constructor() {
    this.initializeDetectionRules();
    this.setupRealTimeMonitoring();
  }

  // Real-time threat detection
  async processDataUpdate(update: {
    source: string;
    type: string;
    entity: string;
    data: any;
    timestamp: Date;
  }): Promise<CompetitiveThreat[]> {
    
    const detectedThreats: CompetitiveThreat[] = [];
    
    // Check if entity is on any watchlist
    const monitoredEntities = this.getMonitoredEntitiesForUpdate(update);
    
    for (const monitored of monitoredEntities) {
      // Run detection rules for this entity
      const applicableRules = this.getApplicableRules(monitored, update.type);
      
      for (const rule of applicableRules) {
        try {
          const threat = await this.evaluateRule(rule, update, monitored);
          if (threat) {
            detectedThreats.push(threat);
            this.activeThreats.set(threat.id, threat);
            
            // Trigger immediate response actions
            await this.executeResponseActions(threat, rule.responseActions);
          }
        } catch (error) {
          console.error(`Error evaluating threat rule ${rule.id}:`, error);
        }
      }
    }
    
    return detectedThreats;
  }

  private getMonitoredEntitiesForUpdate(update: any): MonitoredEntity[] {
    const relevantEntities: MonitoredEntity[] = [];
    
    for (const [_, entity] of this.watchlists) {
      if (this.isUpdateRelevantToEntity(update, entity)) {
        relevantEntities.push(entity);
      }
    }
    
    return relevantEntities;
  }

  private isUpdateRelevantToEntity(update: any, entity: MonitoredEntity): boolean {
    // Check if update relates to monitored entity
    return update.entity.toLowerCase().includes(entity.name.toLowerCase()) ||
           entity.watchlist.some(item => 
             update.entity.toLowerCase().includes(item.entity.toLowerCase())
           );
  }

  private getApplicableRules(entity: MonitoredEntity, updateType: string): ThreatDetectionRule[] {
    return Array.from(this.detectionRules.values())
      .filter(rule => rule.isActive)
      .filter(rule => rule.monitoredEntities.some(e => e.name === entity.name))
      .filter(rule => this.isRuleApplicableToUpdateType(rule, updateType));
  }

  private isRuleApplicableToUpdateType(rule: ThreatDetectionRule, updateType: string): boolean {
    const applicableUpdates: { [key in ThreatType]: string[] } = {
      'new_competitor_entry': ['trial_start', 'company_announcement', 'patent_filing'],
      'competitive_acceleration': ['phase_progression', 'trial_acceleration'],
      'patent_challenge': ['patent_filing', 'patent_challenge'],
      'regulatory_setback': ['fda_action', 'trial_hold'],
      'market_share_erosion': ['market_data', 'sales_report'],
      'pricing_pressure': ['pricing_update', 'reimbursement_change'],
      'technology_leapfrog': ['publication', 'conference_presentation'],
      'partnership_threat': ['partnership_announcement', 'acquisition'],
      'acquisition_risk': ['acquisition_rumor', 'due_diligence'],
      'supply_disruption': ['supply_warning', 'manufacturing_issue'],
      'safety_advantage': ['safety_data', 'adverse_event'],
      'efficacy_superiority': ['efficacy_data', 'clinical_results']
    };

    const applicable = applicableUpdates[rule.threatType] || [];
    return applicable.includes(updateType);
  }

  private async evaluateRule(
    rule: ThreatDetectionRule,
    update: any,
    entity: MonitoredEntity
  ): Promise<CompetitiveThreat | null> {
    
    // Check all detection criteria
    let criteriaScore = 0;
    const evidence: ThreatEvidence[] = [];
    
    for (const criteria of rule.detectionCriteria) {
      const score = await this.evaluateDetectionCriteria(criteria, update, entity);
      criteriaScore += score;
      
      if (score > 0.5) {
        evidence.push({
          type: 'quantitative',
          description: `Criteria match: ${criteria.trigger.type}`,
          value: score,
          source: criteria.dataSource,
          confidence: score,
          verificationStatus: 'unverified'
        });
      }
    }
    
    const avgScore = criteriaScore / rule.detectionCriteria.length;
    
    // Threat detected if average score exceeds threshold
    if (avgScore >= 0.7) {
      return await this.createThreat(rule, update, entity, evidence, avgScore);
    }
    
    return null;
  }

  private async evaluateDetectionCriteria(
    criteria: DetectionCriteria,
    update: any,
    entity: MonitoredEntity
  ): Promise<number> {
    
    let score = 0;
    
    for (const condition of criteria.conditions) {
      const conditionScore = await this.evaluateCondition(condition, update);
      score += conditionScore * condition.weight;
    }
    
    // Apply trigger-specific logic
    switch (criteria.trigger.type) {
      case 'value_change':
        score *= await this.detectValueChange(update, criteria.trigger.parameters);
        break;
      case 'trend_reversal':
        score *= await this.detectTrendReversal(update, criteria.trigger.parameters);
        break;
      case 'anomaly_detection':
        score *= await this.detectAnomaly(update, criteria.trigger.parameters);
        break;
      case 'pattern_match':
        score *= await this.detectPattern(update, criteria.trigger.parameters);
        break;
      case 'threshold_breach':
        score *= await this.detectThresholdBreach(update, criteria.trigger.parameters);
        break;
    }
    
    return Math.min(score, 1.0);
  }

  private async evaluateCondition(condition: ThreatCondition, update: any): Promise<number> {
    const fieldValue = this.extractFieldValue(update, condition.field);
    
    switch (condition.operator) {
      case 'gt':
        return Number(fieldValue) > Number(condition.value) ? 1 : 0;
      case 'lt':
        return Number(fieldValue) < Number(condition.value) ? 1 : 0;
      case 'eq':
        return fieldValue === condition.value ? 1 : 0;
      case 'contains':
        return String(fieldValue).toLowerCase().includes(String(condition.value).toLowerCase()) ? 1 : 0;
      case 'increases_by':
        return await this.checkIncrease(update.entity, condition.field, condition.value);
      case 'decreases_by':
        return await this.checkDecrease(update.entity, condition.field, condition.value);
      default:
        return 0;
    }
  }

  private async createThreat(
    rule: ThreatDetectionRule,
    update: any,
    entity: MonitoredEntity,
    evidence: ThreatEvidence[],
    confidence: number
  ): Promise<CompetitiveThreat> {
    
    const threatId = this.generateThreatId();
    
    // Analyze impact
    const impact = await this.analyzeThreatImpact(rule.threatType, update, entity);
    
    // Generate timeline
    const timeline = await this.generateThreatTimeline(rule.threatType, impact);
    
    // Develop response strategy
    const responseStrategy = await this.developResponseStrategy(rule.threatType, impact);
    
    const threat: CompetitiveThreat = {
      id: threatId,
      type: rule.threatType,
      threatLevel: rule.severity,
      source: {
        type: update.source as any,
        specifics: update.type,
        reliability: 0.8,
        timestamp: update.timestamp
      },
      targetEntity: entity.name,
      threateningEntity: update.entity,
      description: await this.generateThreatDescription(rule.threatType, update, entity),
      evidence,
      impact,
      timeline,
      confidence,
      detectedAt: new Date(),
      status: 'new',
      responseStrategy,
      relatedThreats: await this.findRelatedThreats(rule.threatType, update.entity)
    };
    
    return threat;
  }

  private async analyzeThreatImpact(
    threatType: ThreatType,
    update: any,
    entity: MonitoredEntity
  ): Promise<ThreatImpact> {
    
    // Calculate business impact
    const businessImpact: BusinessImpact = {
      revenueAtRisk: await this.calculateRevenueAtRisk(threatType, entity),
      marketShareAtRisk: await this.calculateMarketShareAtRisk(threatType, entity),
      affectedSegments: await this.identifyAffectedSegments(threatType, entity),
      strategicValue: await this.assessStrategicValue(threatType, entity)
    };
    
    // Calculate competitive impact
    const competitiveImpact: CompetitiveImpact = {
      positionThreat: await this.assessPositionThreat(threatType, update),
      advantageErosion: await this.identifyAdvantageErosion(threatType, entity),
      newCompetitiveGaps: await this.identifyCompetitiveGaps(threatType, update),
      responseComplexity: await this.assessResponseComplexity(threatType)
    };
    
    return {
      businessImpact,
      competitiveImpact,
      timeToImpact: await this.calculateTimeToImpact(threatType, update),
      reversibility: await this.assessReversibility(threatType),
      cascadeEffects: await this.identifyCascadeEffects(threatType, entity)
    };
  }

  // Automated response system
  private async executeResponseActions(
    threat: CompetitiveThreat,
    actions: ResponseAction[]
  ): Promise<void> {
    
    for (const action of actions) {
      if (action.automatable) {
        await this.executeAutomatedAction(threat, action);
      } else {
        await this.scheduleManualAction(threat, action);
      }
    }
  }

  private async executeAutomatedAction(threat: CompetitiveThreat, action: ResponseAction): Promise<void> {
    switch (action.action) {
      case 'alert':
        await this.sendThreatAlert(threat);
        break;
      case 'escalate':
        await this.escalateThreat(threat);
        break;
      case 'monitor':
        await this.enhanceMonitoring(threat);
        break;
      case 'investigate':
        await this.initiateInvestigation(threat);
        break;
    }
  }

  // Intelligence and analytics
  async getThreatIntelligence(timeframe: string = '30d'): Promise<ThreatIntelligence> {
    const recentThreats = this.getRecentThreats(timeframe);
    
    return {
      activeThreatCount: recentThreats.length,
      threatDistribution: this.calculateThreatDistribution(recentThreats),
      avgThreatLevel: this.calculateAverageThreatLevel(recentThreats),
      emergingPatterns: await this.identifyEmergingPatterns(recentThreats),
      blindSpots: await this.identifyBlindSpots(),
      recommendedActions: await this.generateRecommendedActions(recentThreats)
    };
  }

  // Setup and configuration
  private initializeDetectionRules(): void {
    // Initialize predefined threat detection rules
    this.createRule({
      name: 'New Competitor Entry Detection',
      threatType: 'new_competitor_entry',
      monitoredEntities: [],
      detectionCriteria: [
        {
          dataSource: 'clinicaltrials',
          trigger: { type: 'pattern_match', parameters: { pattern: 'new_drug_entry' } },
          threshold: 0.8,
          timeWindow: '7d',
          conditions: [
            { field: 'sponsor', operator: 'eq', value: 'major_pharma', weight: 0.6 },
            { field: 'phase', operator: 'gt', value: 1, weight: 0.4 }
          ]
        }
      ],
      severity: 'high',
      responseActions: [
        {
          action: 'alert',
          priority: 'urgent',
          instructions: 'Immediate competitive analysis required',
          automatable: true
        }
      ],
      isActive: true
    });
  }

  private async createRule(ruleData: Omit<ThreatDetectionRule, 'id' | 'createdAt'>): Promise<string> {
    const ruleId = this.generateRuleId();
    const rule: ThreatDetectionRule = {
      ...ruleData,
      id: ruleId,
      createdAt: new Date()
    };
    
    this.detectionRules.set(ruleId, rule);
    return ruleId;
  }

  private setupRealTimeMonitoring(): void {
    console.log('Setting up real-time competitive threat monitoring');
  }

  // Utility methods (implementation stubs)
  private extractFieldValue(data: any, field: string): any {
    return data[field];
  }

  private async checkIncrease(entity: string, field: string, threshold: number): Promise<number> {
    return 0; // Placeholder
  }

  private async checkDecrease(entity: string, field: string, threshold: number): Promise<number> {
    return 0; // Placeholder
  }

  private async detectValueChange(update: any, params: any): Promise<number> {
    return 0.8; // Placeholder
  }

  private async detectTrendReversal(update: any, params: any): Promise<number> {
    return 0.7; // Placeholder
  }

  private async detectAnomaly(update: any, params: any): Promise<number> {
    return 0.6; // Placeholder
  }

  private async detectPattern(update: any, params: any): Promise<number> {
    return 0.9; // Placeholder
  }

  private async detectThresholdBreach(update: any, params: any): Promise<number> {
    return 1.0; // Placeholder
  }

  private generateThreatId(): string {
    return `threat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateRuleId(): string {
    return `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async generateThreatDescription(type: ThreatType, update: any, entity: MonitoredEntity): Promise<string> {
    return `${type} detected for ${entity.name}: ${update.entity}`;
  }

  private async findRelatedThreats(type: ThreatType, entity: string): Promise<string[]> {
    return [];
  }

  private async calculateRevenueAtRisk(type: ThreatType, entity: MonitoredEntity): Promise<number> {
    return 0; // Placeholder
  }

  private async calculateMarketShareAtRisk(type: ThreatType, entity: MonitoredEntity): Promise<number> {
    return 0; // Placeholder
  }

  private async identifyAffectedSegments(type: ThreatType, entity: MonitoredEntity): Promise<string[]> {
    return [];
  }

  private async assessStrategicValue(type: ThreatType, entity: MonitoredEntity): Promise<'low' | 'medium' | 'high' | 'critical'> {
    return 'medium';
  }

  private async assessPositionThreat(type: ThreatType, update: any): Promise<'minor' | 'moderate' | 'significant' | 'severe'> {
    return 'moderate';
  }

  private async identifyAdvantageErosion(type: ThreatType, entity: MonitoredEntity): Promise<string[]> {
    return [];
  }

  private async identifyCompetitiveGaps(type: ThreatType, update: any): Promise<string[]> {
    return [];
  }

  private async assessResponseComplexity(type: ThreatType): Promise<'simple' | 'moderate' | 'complex' | 'extremely_complex'> {
    return 'moderate';
  }

  private async calculateTimeToImpact(type: ThreatType, update: any): Promise<number> {
    return 12; // months
  }

  private async assessReversibility(type: ThreatType): Promise<'irreversible' | 'difficult' | 'moderate' | 'easy'> {
    return 'moderate';
  }

  private async identifyCascadeEffects(type: ThreatType, entity: MonitoredEntity): Promise<string[]> {
    return [];
  }

  private async generateThreatTimeline(type: ThreatType, impact: ThreatImpact): Promise<ThreatTimeline> {
    return {
      immediateActions: [],
      shortTermActions: [],
      longTermActions: [],
      criticalMilestones: []
    };
  }

  private async developResponseStrategy(type: ThreatType, impact: ThreatImpact): Promise<ResponseStrategy> {
    return {
      primaryStrategy: 'defensive',
      tacticalMoves: [],
      resourceRequirements: [],
      successProbability: 0.7,
      estimatedCost: 0,
      timeline: '6 months'
    };
  }

  private async sendThreatAlert(threat: CompetitiveThreat): Promise<void> {
    console.log(`Threat alert: ${threat.description}`);
  }

  private async escalateThreat(threat: CompetitiveThreat): Promise<void> {
    console.log(`Escalating threat: ${threat.id}`);
  }

  private async enhanceMonitoring(threat: CompetitiveThreat): Promise<void> {
    console.log(`Enhanced monitoring for: ${threat.threateningEntity}`);
  }

  private async initiateInvestigation(threat: CompetitiveThreat): Promise<void> {
    console.log(`Investigation initiated for: ${threat.id}`);
  }

  private async scheduleManualAction(threat: CompetitiveThreat, action: ResponseAction): Promise<void> {
    console.log(`Manual action scheduled: ${action.action}`);
  }

  private getRecentThreats(timeframe: string): CompetitiveThreat[] {
    return Array.from(this.activeThreats.values());
  }

  private calculateThreatDistribution(threats: CompetitiveThreat[]): { [type: string]: number } {
    const distribution: { [type: string]: number } = {};
    threats.forEach(threat => {
      distribution[threat.type] = (distribution[threat.type] || 0) + 1;
    });
    return distribution;
  }

  private calculateAverageThreatLevel(threats: CompetitiveThreat[]): number {
    if (threats.length === 0) return 0;
    
    const levelValues = { low: 1, medium: 2, high: 3, critical: 4 };
    const sum = threats.reduce((acc, threat) => acc + levelValues[threat.threatLevel], 0);
    return sum / threats.length;
  }

  private async identifyEmergingPatterns(threats: CompetitiveThreat[]): Promise<EmergingPattern[]> {
    return [];
  }

  private async identifyBlindSpots(): Promise<BlindSpot[]> {
    return [];
  }

  private async generateRecommendedActions(threats: CompetitiveThreat[]): Promise<string[]> {
    return [];
  }

  // Public API
  async addToWatchlist(entity: MonitoredEntity): Promise<void> {
    this.watchlists.set(entity.name, entity);
  }

  async removeFromWatchlist(entityName: string): Promise<void> {
    this.watchlists.delete(entityName);
  }

  async getActiveThreats(severity?: string): Promise<CompetitiveThreat[]> {
    const threats = Array.from(this.activeThreats.values());
    
    if (severity) {
      return threats.filter(threat => threat.threatLevel === severity);
    }
    
    return threats.sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime());
  }

  async updateThreatStatus(threatId: string, status: CompetitiveThreat['status'], notes?: string): Promise<void> {
    const threat = this.activeThreats.get(threatId);
    if (threat) {
      threat.status = status;
      // Update with notes, timestamp, etc.
    }
  }
}

class ThreatDetectionEngine {
  // Advanced threat detection algorithms
}

class ThreatResponseEngine {
  // Automated response system
}

export const competitiveThreatDetector = new CompetitiveThreatDetector();