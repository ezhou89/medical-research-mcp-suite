// src/utils/intelligent-alerting-system.ts

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  type: AlertType;
  conditions: AlertCondition[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  frequency: 'realtime' | 'daily' | 'weekly' | 'monthly';
  channels: NotificationChannel[];
  isActive: boolean;
  createdAt: Date;
  lastTriggered?: Date;
  triggerCount: number;
  owner: string;
  tags: string[];
}

export type AlertType = 
  | 'new_competitor'
  | 'phase_progression' 
  | 'approval_milestone'
  | 'trial_failure'
  | 'patent_expiry'
  | 'market_entry'
  | 'regulatory_change'
  | 'investment_activity'
  | 'publication_breakthrough'
  | 'partnership_announcement'
  | 'pricing_change'
  | 'safety_signal';

export interface AlertCondition {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'changed' | 'new' | 'matches_pattern';
  value: any;
  threshold?: number;
  timeWindow?: string; // e.g., "7d", "30d", "6m"
}

export interface NotificationChannel {
  type: 'email' | 'slack' | 'webhook' | 'dashboard' | 'sms';
  endpoint: string;
  settings: {
    [key: string]: any;
  };
}

export interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  type: AlertType;
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  data: AlertData;
  timestamp: Date;
  status: 'new' | 'acknowledged' | 'resolved' | 'suppressed';
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolutionNotes?: string;
  actionItems: ActionItem[];
  relatedAlerts: string[];
  confidence: number; // 0-1
}

export interface AlertData {
  entity: string; // Drug name, company, indication, etc.
  entityType: 'drug' | 'company' | 'indication' | 'trial' | 'patent' | 'market';
  change: any; // The actual change that triggered the alert
  context: {
    previousValue?: any;
    newValue?: any;
    source: string;
    metadata: any;
  };
  impact: AlertImpact;
  recommendations: string[];
}

export interface AlertImpact {
  scope: 'low' | 'medium' | 'high';
  timeframe: 'immediate' | 'short_term' | 'medium_term' | 'long_term';
  affectedAreas: string[];
  businessImplications: string[];
  competitiveImplications: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface ActionItem {
  id: string;
  action: string;
  priority: 'low' | 'medium' | 'high';
  assignee?: string;
  dueDate?: Date;
  status: 'pending' | 'in_progress' | 'completed';
  notes?: string;
}

export interface AlertTemplate {
  type: AlertType;
  defaultConditions: AlertCondition[];
  defaultChannels: NotificationChannel[];
  messageTemplate: string;
  actionItemTemplates: string[];
  escalationRules: EscalationRule[];
}

export interface EscalationRule {
  triggerAfter: string; // e.g., "2h", "1d"
  escalateTo: NotificationChannel[];
  escalationMessage: string;
}

export interface UserPreferences {
  userId: string;
  therapeuticAreasOfInterest: string[];
  companiesOfInterest: string[];
  drugsOfInterest: string[];
  alertTypes: AlertType[];
  quietHours: {
    start: string; // HH:MM
    end: string; // HH:MM
    timezone: string;
  };
  batchNotifications: boolean;
  minimumPriority: 'low' | 'medium' | 'high' | 'critical';
}

export interface IntelligentInsight {
  id: string;
  type: 'trend' | 'anomaly' | 'opportunity' | 'risk' | 'prediction';
  title: string;
  description: string;
  confidence: number; // 0-1
  relevanceScore: number; // 0-1
  timeframe: string;
  supportingData: any[];
  actionableRecommendations: string[];
  relatedEntities: string[];
  tags: string[];
  generatedAt: Date;
  expiresAt?: Date;
}

export class IntelligentAlertingSystem {
  private alertRules = new Map<string, AlertRule>();
  private activeAlerts = new Map<string, Alert>();
  private userPreferences = new Map<string, UserPreferences>();
  private alertTemplates = new Map<AlertType, AlertTemplate>();
  private insightEngine = new InsightEngine();
  
  constructor() {
    this.initializeAlertTemplates();
    this.setupRealTimeMonitoring();
  }

  // Alert Rule Management
  async createAlertRule(rule: Omit<AlertRule, 'id' | 'createdAt' | 'triggerCount'>): Promise<string> {
    const ruleId = this.generateRuleId();
    const fullRule: AlertRule = {
      ...rule,
      id: ruleId,
      createdAt: new Date(),
      triggerCount: 0
    };

    this.alertRules.set(ruleId, fullRule);
    console.log(`Created alert rule: ${rule.name} (${ruleId})`);
    
    return ruleId;
  }

  async updateAlertRule(ruleId: string, updates: Partial<AlertRule>): Promise<void> {
    const rule = this.alertRules.get(ruleId);
    if (!rule) throw new Error(`Alert rule ${ruleId} not found`);

    const updatedRule = { ...rule, ...updates };
    this.alertRules.set(ruleId, updatedRule);
  }

  async deleteAlertRule(ruleId: string): Promise<void> {
    this.alertRules.delete(ruleId);
  }

  // Event Processing
  async processEvent(event: {
    type: string;
    entity: string;
    entityType: string;
    data: any;
    source: string;
    timestamp: Date;
  }): Promise<Alert[]> {
    
    const triggeredAlerts: Alert[] = [];
    
    for (const [ruleId, rule] of this.alertRules) {
      if (!rule.isActive) continue;

      try {
        if (await this.evaluateRule(rule, event)) {
          const alert = await this.createAlert(rule, event);
          triggeredAlerts.push(alert);
          
          // Send notifications
          await this.sendNotifications(alert, rule.channels);
          
          // Update rule trigger count
          rule.triggerCount++;
          rule.lastTriggered = new Date();
        }
      } catch (error) {
        console.error(`Error evaluating rule ${ruleId}:`, error);
      }
    }

    return triggeredAlerts;
  }

  private async evaluateRule(rule: AlertRule, event: any): Promise<boolean> {
    // Check if event type matches rule type
    if (!this.eventMatchesRuleType(event.type, rule.type)) {
      return false;
    }

    // Evaluate all conditions
    for (const condition of rule.conditions) {
      if (!await this.evaluateCondition(condition, event)) {
        return false; // All conditions must be true
      }
    }

    return true;
  }

  private eventMatchesRuleType(eventType: string, ruleType: AlertType): boolean {
    const eventTypeMapping: { [key: string]: AlertType[] } = {
      'trial_status_change': ['phase_progression', 'trial_failure'],
      'drug_approval': ['approval_milestone', 'market_entry'],
      'new_competitor_detected': ['new_competitor'],
      'patent_status_change': ['patent_expiry'],
      'regulatory_announcement': ['regulatory_change'],
      'investment_round': ['investment_activity'],
      'publication_released': ['publication_breakthrough'],
      'partnership_announced': ['partnership_announcement'],
      'safety_report': ['safety_signal'],
      'pricing_update': ['pricing_change']
    };

    const applicableRuleTypes = eventTypeMapping[eventType] || [];
    return applicableRuleTypes.includes(ruleType);
  }

  private async evaluateCondition(condition: AlertCondition, event: any): Promise<boolean> {
    const fieldValue = this.extractFieldValue(event, condition.field);
    
    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;
      
      case 'contains':
        return String(fieldValue).toLowerCase().includes(String(condition.value).toLowerCase());
      
      case 'greater_than':
        return Number(fieldValue) > Number(condition.value);
      
      case 'less_than':
        return Number(fieldValue) < Number(condition.value);
      
      case 'changed':
        return await this.hasValueChanged(event.entity, condition.field, condition.timeWindow);
      
      case 'new':
        return await this.isNewEntity(event.entity, event.entityType);
      
      case 'matches_pattern':
        const regex = new RegExp(condition.value);
        return regex.test(String(fieldValue));
      
      default:
        return false;
    }
  }

  private extractFieldValue(event: any, fieldPath: string): any {
    const paths = fieldPath.split('.');
    let value = event;
    
    for (const path of paths) {
      value = value?.[path];
    }
    
    return value;
  }

  private async hasValueChanged(entity: string, field: string, timeWindow?: string): Promise<boolean> {
    // Implementation would check historical data for changes
    return true; // Placeholder
  }

  private async isNewEntity(entity: string, entityType: string): Promise<boolean> {
    // Implementation would check if entity was discovered recently
    return false; // Placeholder
  }

  private async createAlert(rule: AlertRule, event: any): Promise<Alert> {
    const alertId = this.generateAlertId();
    
    // Analyze impact and generate recommendations
    const impact = await this.analyzeImpact(event, rule.type);
    const recommendations = await this.generateRecommendations(event, rule.type, impact);
    
    const alert: Alert = {
      id: alertId,
      ruleId: rule.id,
      ruleName: rule.name,
      type: rule.type,
      priority: rule.priority,
      title: await this.generateAlertTitle(rule, event),
      message: await this.generateAlertMessage(rule, event),
      data: {
        entity: event.entity,
        entityType: event.entityType,
        change: event.data,
        context: {
          source: event.source,
          metadata: event.data
        },
        impact,
        recommendations
      },
      timestamp: new Date(),
      status: 'new',
      actionItems: await this.generateActionItems(rule.type, event, impact),
      relatedAlerts: await this.findRelatedAlerts(event),
      confidence: await this.calculateAlertConfidence(rule, event)
    };

    this.activeAlerts.set(alertId, alert);
    return alert;
  }

  private async analyzeImpact(event: any, alertType: AlertType): Promise<AlertImpact> {
    // Sophisticated impact analysis based on alert type and event data
    const impactAnalysis: AlertImpact = {
      scope: 'medium',
      timeframe: 'short_term',
      affectedAreas: [event.entityType],
      businessImplications: [],
      competitiveImplications: [],
      riskLevel: 'medium'
    };

    switch (alertType) {
      case 'new_competitor':
        impactAnalysis.scope = 'high';
        impactAnalysis.competitiveImplications = ['Increased competition', 'Market share pressure'];
        impactAnalysis.riskLevel = 'high';
        break;
        
      case 'approval_milestone':
        impactAnalysis.scope = 'high';
        impactAnalysis.timeframe = 'immediate';
        impactAnalysis.businessImplications = ['Market opportunity', 'Revenue potential'];
        break;
        
      case 'trial_failure':
        impactAnalysis.scope = 'high';
        impactAnalysis.riskLevel = 'high';
        impactAnalysis.competitiveImplications = ['Competitor weakness', 'Market opportunity'];
        break;
        
      case 'patent_expiry':
        impactAnalysis.scope = 'high';
        impactAnalysis.timeframe = 'medium_term';
        impactAnalysis.businessImplications = ['Generic competition', 'Revenue erosion'];
        impactAnalysis.riskLevel = 'high';
        break;
    }

    return impactAnalysis;
  }

  private async generateRecommendations(event: any, alertType: AlertType, impact: AlertImpact): Promise<string[]> {
    const recommendations: string[] = [];

    switch (alertType) {
      case 'new_competitor':
        recommendations.push(
          'Conduct detailed competitive analysis',
          'Assess differentiation strategies',
          'Monitor clinical trial progress',
          'Evaluate partnership opportunities'
        );
        break;
        
      case 'approval_milestone':
        recommendations.push(
          'Accelerate launch preparations',
          'Update market access strategy',
          'Prepare competitive response',
          'Engage key stakeholders'
        );
        break;
        
      case 'trial_failure':
        recommendations.push(
          'Analyze failure reasons',
          'Assess market opportunity expansion',
          'Consider acquisition opportunities',
          'Update competitive positioning'
        );
        break;
        
      case 'patent_expiry':
        recommendations.push(
          'Develop generic competition strategy',
          'Explore lifecycle management options',
          'Assess market defense strategies',
          'Consider authorized generics'
        );
        break;
    }

    return recommendations;
  }

  private async generateActionItems(alertType: AlertType, event: any, impact: AlertImpact): Promise<ActionItem[]> {
    const actionItems: ActionItem[] = [];

    if (impact.riskLevel === 'high' || impact.riskLevel === 'critical') {
      actionItems.push({
        id: this.generateActionId(),
        action: 'Schedule emergency strategic review',
        priority: 'high',
        status: 'pending',
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      });
    }

    switch (alertType) {
      case 'new_competitor':
        actionItems.push(
          {
            id: this.generateActionId(),
            action: 'Conduct competitive intelligence assessment',
            priority: 'high',
            status: 'pending',
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
          },
          {
            id: this.generateActionId(),
            action: 'Update competitive landscape analysis',
            priority: 'medium',
            status: 'pending',
            dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days
          }
        );
        break;
    }

    return actionItems;
  }

  // Notification System
  private async sendNotifications(alert: Alert, channels: NotificationChannel[]): Promise<void> {
    for (const channel of channels) {
      try {
        await this.sendNotification(alert, channel);
      } catch (error) {
        console.error(`Failed to send notification via ${channel.type}:`, error);
      }
    }
  }

  private async sendNotification(alert: Alert, channel: NotificationChannel): Promise<void> {
    const message = this.formatNotificationMessage(alert, channel.type);
    
    switch (channel.type) {
      case 'email':
        await this.sendEmailNotification(channel.endpoint, message, alert);
        break;
      case 'slack':
        await this.sendSlackNotification(channel.endpoint, message, alert);
        break;
      case 'webhook':
        await this.sendWebhookNotification(channel.endpoint, alert);
        break;
      case 'dashboard':
        await this.updateDashboard(alert);
        break;
      case 'sms':
        await this.sendSMSNotification(channel.endpoint, message);
        break;
    }
  }

  private formatNotificationMessage(alert: Alert, channelType: string): string {
    const emoji = this.getAlertEmoji(alert.type, alert.priority);
    
    switch (channelType) {
      case 'slack':
        return `${emoji} *${alert.title}*\n${alert.message}\n\n*Recommendations:*\n${alert.data.recommendations.map(r => `• ${r}`).join('\n')}`;
      
      case 'email':
        return `
          <h2>${emoji} ${alert.title}</h2>
          <p>${alert.message}</p>
          <h3>Impact Assessment</h3>
          <ul>
            <li>Scope: ${alert.data.impact.scope}</li>
            <li>Risk Level: ${alert.data.impact.riskLevel}</li>
            <li>Timeframe: ${alert.data.impact.timeframe}</li>
          </ul>
          <h3>Recommendations</h3>
          <ul>
            ${alert.data.recommendations.map(r => `<li>${r}</li>`).join('')}
          </ul>
        `;
      
      default:
        return `${emoji} ${alert.title}: ${alert.message}`;
    }
  }

  private getAlertEmoji(type: AlertType, priority: string): string {
    if (priority === 'critical') return '🚨';
    if (priority === 'high') return '⚠️';
    
    const typeEmojis: { [key in AlertType]: string } = {
      'new_competitor': '🥊',
      'phase_progression': '📈',
      'approval_milestone': '✅',
      'trial_failure': '❌',
      'patent_expiry': '⏰',
      'market_entry': '🚀',
      'regulatory_change': '📋',
      'investment_activity': '💰',
      'publication_breakthrough': '🔬',
      'partnership_announcement': '🤝',
      'pricing_change': '💲',
      'safety_signal': '⚕️'
    };
    
    return typeEmojis[type] || '📢';
  }

  // Proactive Insights
  async generateProactiveInsights(userId: string): Promise<IntelligentInsight[]> {
    const preferences = this.userPreferences.get(userId);
    if (!preferences) return [];

    const insights: IntelligentInsight[] = [];
    
    // Generate insights based on user interests
    for (const therapeuticArea of preferences.therapeuticAreasOfInterest) {
      const areaInsights = await this.insightEngine.generateTherapeuticAreaInsights(therapeuticArea);
      insights.push(...areaInsights);
    }
    
    for (const company of preferences.companiesOfInterest) {
      const companyInsights = await this.insightEngine.generateCompanyInsights(company);
      insights.push(...companyInsights);
    }
    
    for (const drug of preferences.drugsOfInterest) {
      const drugInsights = await this.insightEngine.generateDrugInsights(drug);
      insights.push(...drugInsights);
    }

    // Rank insights by relevance and confidence
    return insights
      .sort((a, b) => (b.relevanceScore * b.confidence) - (a.relevanceScore * a.confidence))
      .slice(0, 20); // Top 20 insights
  }

  // Utility Methods
  private initializeAlertTemplates(): void {
    // Initialize predefined alert templates
    this.alertTemplates.set('new_competitor', {
      type: 'new_competitor',
      defaultConditions: [
        { field: 'entityType', operator: 'equals', value: 'drug' },
        { field: 'status', operator: 'equals', value: 'new' }
      ],
      defaultChannels: [
        { type: 'email', endpoint: '', settings: {} },
        { type: 'dashboard', endpoint: '', settings: {} }
      ],
      messageTemplate: 'New competitor {entity} detected in {indication}',
      actionItemTemplates: [
        'Conduct competitive analysis for {entity}',
        'Update market landscape assessment'
      ],
      escalationRules: [
        {
          triggerAfter: '2h',
          escalateTo: [{ type: 'slack', endpoint: '', settings: {} }],
          escalationMessage: 'URGENT: New competitor alert requires attention'
        }
      ]
    });
  }

  private setupRealTimeMonitoring(): void {
    // Setup real-time event listeners
    console.log('Setting up real-time monitoring for intelligent alerts');
  }

  private generateRuleId(): string {
    return `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateActionId(): string {
    return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async generateAlertTitle(rule: AlertRule, event: any): Promise<string> {
    const template = this.alertTemplates.get(rule.type)?.messageTemplate || '{entity} alert';
    return this.interpolateTemplate(template, event);
  }

  private async generateAlertMessage(rule: AlertRule, event: any): Promise<string> {
    return `${rule.type.replace('_', ' ').toUpperCase()}: ${event.entity} - ${JSON.stringify(event.data)}`;
  }

  private interpolateTemplate(template: string, event: any): string {
    return template.replace(/\{(\w+)\}/g, (match, key) => {
      return event[key] || match;
    });
  }

  private async findRelatedAlerts(event: any): Promise<string[]> {
    // Find alerts related to the same entity or event
    return [];
  }

  private async calculateAlertConfidence(rule: AlertRule, event: any): Promise<number> {
    // Calculate confidence based on rule accuracy and event data quality
    return 0.85;
  }

  // Notification method stubs
  private async sendEmailNotification(email: string, message: string, alert: Alert): Promise<void> {
    console.log(`Email notification sent to ${email}`);
  }

  private async sendSlackNotification(webhook: string, message: string, alert: Alert): Promise<void> {
    console.log(`Slack notification sent: ${message}`);
  }

  private async sendWebhookNotification(url: string, alert: Alert): Promise<void> {
    console.log(`Webhook notification sent to ${url}`);
  }

  private async updateDashboard(alert: Alert): Promise<void> {
    console.log(`Dashboard updated with alert: ${alert.title}`);
  }

  private async sendSMSNotification(phone: string, message: string): Promise<void> {
    console.log(`SMS sent to ${phone}: ${message}`);
  }

  // User Management
  async setUserPreferences(userId: string, preferences: UserPreferences): Promise<void> {
    this.userPreferences.set(userId, preferences);
  }

  async getUserAlerts(userId: string, status?: string): Promise<Alert[]> {
    const userPrefs = this.userPreferences.get(userId);
    if (!userPrefs) return [];

    return Array.from(this.activeAlerts.values())
      .filter(alert => {
        if (status && alert.status !== status) return false;
        if (alert.priority === 'low' && userPrefs.minimumPriority !== 'low') return false;
        return userPrefs.alertTypes.includes(alert.type);
      })
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async acknowledgeAlert(alertId: string, userId: string, notes?: string): Promise<void> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) throw new Error(`Alert ${alertId} not found`);

    alert.status = 'acknowledged';
    alert.acknowledgedBy = userId;
    alert.acknowledgedAt = new Date();
    alert.resolutionNotes = notes;
  }
}

class InsightEngine {
  async generateTherapeuticAreaInsights(area: string): Promise<IntelligentInsight[]> {
    // Generate insights for therapeutic area
    return [];
  }

  async generateCompanyInsights(company: string): Promise<IntelligentInsight[]> {
    // Generate insights for company
    return [];
  }

  async generateDrugInsights(drug: string): Promise<IntelligentInsight[]> {
    // Generate insights for drug
    return [];
  }
}

export const intelligentAlertingSystem = new IntelligentAlertingSystem();