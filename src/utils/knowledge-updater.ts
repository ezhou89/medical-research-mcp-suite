// src/utils/knowledge-updater.ts

import logger from './logger.js';
import { Cache } from './cache.js';
import type { DataQuality } from '../types/common.js';

export interface UpdateTask {
  id: string;
  type: UpdateType;
  priority: TaskPriority;
  description: string;
  targetResource: string;
  scheduledTime?: Date;
  lastExecuted?: Date;
  nextExecution?: Date;
  frequency?: UpdateFrequency;
  retryCount: number;
  maxRetries: number;
  status: TaskStatus;
  dependencies?: string[];
  metadata: Record<string, any>;
}

export type UpdateType = 
  | 'cache_refresh'
  | 'knowledge_graph_update'
  | 'model_retrain'
  | 'data_validation'
  | 'index_rebuild'
  | 'synonym_update'
  | 'vocabulary_expansion'
  | 'quality_assessment'
  | 'performance_optimization';

export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'scheduled';
export type UpdateFrequency = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'on_demand';

export interface UpdateResult {
  taskId: string;
  success: boolean;
  startTime: Date;
  endTime: Date;
  duration: number;
  recordsProcessed: number;
  recordsUpdated: number;
  recordsSkipped: number;
  errors: UpdateError[];
  warnings: string[];
  performance: PerformanceMetrics;
  qualityMetrics?: DataQuality;
}

export interface UpdateError {
  type: string;
  message: string;
  details?: Record<string, any>;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  retryable: boolean;
}

export interface PerformanceMetrics {
  memoryUsed: number;
  cpuTime: number;
  ioOperations: number;
  cacheHitRate: number;
  throughput: number; // records per second
}

export interface MaintenanceSchedule {
  tasks: UpdateTask[];
  lastUpdated: Date;
  nextMaintenance: Date;
  estimatedDuration: number;
  resourceRequirements: ResourceRequirements;
}

export interface ResourceRequirements {
  memoryMB: number;
  diskSpaceMB: number;
  networkBandwidthMbps: number;
  estimatedDuration: number;
  exclusiveAccess: boolean;
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'critical';
  components: Map<string, ComponentHealth>;
  lastChecked: Date;
  uptime: number;
  recommendations: string[];
}

export interface ComponentHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'critical' | 'offline';
  lastUpdated: Date;
  metrics: Record<string, number>;
  issues: string[];
}

export class KnowledgeUpdater {
  private tasks: Map<string, UpdateTask>;
  private taskQueue: UpdateTask[];
  private runningTasks: Set<string>;
  private updateHistory: Map<string, UpdateResult[]>;
  private scheduler: NodeJS.Timeout | null;
  private isRunning: boolean;
  private cache: Map<string, any>;
  private maxConcurrentTasks: number;

  constructor() {
    this.tasks = new Map();
    this.taskQueue = [];
    this.runningTasks = new Set();
    this.updateHistory = new Map();
    this.scheduler = null;
    this.isRunning = false;
    this.cache = new Map(); // Simple cache replacement
    this.maxConcurrentTasks = 3;
    
    this.initializeDefaultTasks();
  }

  /**
   * Start the knowledge updater service
   */
  public start(): void {
    if (this.isRunning) {
      logger.warn('Knowledge updater is already running');
      return;
    }

    this.isRunning = true;
    this.scheduleNextExecution();
    
    logger.info('Knowledge updater service started');
  }

  /**
   * Stop the knowledge updater service
   */
  public stop(): void {
    if (!this.isRunning) {
      logger.warn('Knowledge updater is not running');
      return;
    }

    this.isRunning = false;
    
    if (this.scheduler) {
      clearTimeout(this.scheduler);
      this.scheduler = null;
    }

    // Cancel running tasks
    for (const taskId of this.runningTasks) {
      const task = this.tasks.get(taskId);
      if (task) {
        task.status = 'cancelled';
      }
    }
    this.runningTasks.clear();

    logger.info('Knowledge updater service stopped');
  }

  /**
   * Add a new update task
   */
  public addTask(task: Omit<UpdateTask, 'id' | 'status' | 'retryCount'>): string {
    const taskId = this.generateTaskId();
    const fullTask: UpdateTask = {
      ...task,
      id: taskId,
      status: 'pending',
      retryCount: 0
    };

    this.tasks.set(taskId, fullTask);
    this.taskQueue.push(fullTask);
    this.sortTaskQueue();

    logger.info('Update task added', {
      taskId,
      type: task.type,
      priority: task.priority,
      targetResource: task.targetResource
    });

    return taskId;
  }

  /**
   * Schedule immediate execution of a task
   */
  public async executeTask(taskId: string): Promise<UpdateResult> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    if (this.runningTasks.has(taskId)) {
      throw new Error(`Task is already running: ${taskId}`);
    }

    return this.runTask(task);
  }

  /**
   * Get system health status
   */
  public async getSystemHealth(): Promise<SystemHealth> {
    const components = new Map<string, ComponentHealth>();
    
    // Check cache health
    const cacheHealth = await this.checkCacheHealth();
    components.set('cache', cacheHealth);

    // Check task queue health
    const queueHealth = this.checkQueueHealth();
    components.set('task_queue', queueHealth);

    // Check knowledge graph health
    const kgHealth = await this.checkKnowledgeGraphHealth();
    components.set('knowledge_graph', kgHealth);

    // Check ML models health
    const mlHealth = await this.checkMLModelsHealth();
    components.set('ml_models', mlHealth);

    // Determine overall health
    const overallHealth = this.determineOverallHealth(components);
    const recommendations = this.generateHealthRecommendations(components);

    return {
      overall: overallHealth,
      components,
      lastChecked: new Date(),
      uptime: process.uptime(),
      recommendations
    };
  }

  /**
   * Get maintenance schedule
   */
  public getMaintenanceSchedule(): MaintenanceSchedule {
    const scheduledTasks = Array.from(this.tasks.values())
      .filter(task => task.scheduledTime)
      .sort((a, b) => (a.scheduledTime!.getTime() - b.scheduledTime!.getTime()));

    const nextMaintenance = scheduledTasks.length > 0 
      ? scheduledTasks[0].scheduledTime!
      : new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow

    const estimatedDuration = scheduledTasks.reduce((total, task) => 
      total + (task.metadata.estimatedDuration || 300000), 0 // 5 minutes default
    );

    const resourceRequirements = this.calculateResourceRequirements(scheduledTasks);

    return {
      tasks: scheduledTasks,
      lastUpdated: new Date(),
      nextMaintenance,
      estimatedDuration,
      resourceRequirements
    };
  }

  /**
   * Clean up old data and optimize performance
   */
  public async performMaintenance(): Promise<UpdateResult> {
    const maintenanceTask: UpdateTask = {
      id: this.generateTaskId(),
      type: 'performance_optimization',
      priority: 'medium',
      description: 'Perform system maintenance and optimization',
      targetResource: 'system',
      status: 'pending',
      retryCount: 0,
      maxRetries: 1,
      metadata: {}
    };

    return this.runTask(maintenanceTask);
  }

  /**
   * Update knowledge graph with new data
   */
  public async updateKnowledgeGraph(options: {
    rebuildFromScratch?: boolean;
    updateVocabulary?: boolean;
    recomputeRelationships?: boolean;
  } = {}): Promise<UpdateResult> {
    const taskId = this.addTask({
      type: 'knowledge_graph_update',
      priority: 'high',
      description: 'Update knowledge graph with latest data',
      targetResource: 'knowledge_graph',
      maxRetries: 2,
      metadata: options
    });

    return this.executeTask(taskId);
  }

  /**
   * Refresh cache with latest data
   */
  public async refreshCache(cacheKey?: string): Promise<UpdateResult> {
    const taskId = this.addTask({
      type: 'cache_refresh',
      priority: 'medium',
      description: `Refresh cache${cacheKey ? ` for key: ${cacheKey}` : ''}`,
      targetResource: cacheKey || 'all_caches',
      maxRetries: 3,
      metadata: { cacheKey }
    });

    return this.executeTask(taskId);
  }

  /**
   * Retrain ML models with new data
   */
  public async retrainModels(modelTypes?: string[]): Promise<UpdateResult> {
    const taskId = this.addTask({
      type: 'model_retrain',
      priority: 'high',
      description: 'Retrain machine learning models',
      targetResource: modelTypes?.join(',') || 'all_models',
      maxRetries: 2,
      metadata: { modelTypes }
    });

    return this.executeTask(taskId);
  }

  /**
   * Get task execution history
   */
  public getTaskHistory(taskId?: string, limit: number = 50): UpdateResult[] {
    if (taskId) {
      return this.updateHistory.get(taskId) || [];
    }

    const allResults: UpdateResult[] = [];
    for (const results of this.updateHistory.values()) {
      allResults.push(...results);
    }

    return allResults
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
      .slice(0, limit);
  }

  // Private methods

  private async runTask(task: UpdateTask): Promise<UpdateResult> {
    const startTime = new Date();
    this.runningTasks.add(task.id);
    task.status = 'running';
    task.lastExecuted = startTime;

    logger.info('Starting update task', {
      taskId: task.id,
      type: task.type,
      targetResource: task.targetResource
    });

    let result: UpdateResult;

    try {
      switch (task.type) {
        case 'cache_refresh':
          result = await this.runCacheRefresh(task);
          break;
        case 'knowledge_graph_update':
          result = await this.runKnowledgeGraphUpdate(task);
          break;
        case 'model_retrain':
          result = await this.runModelRetrain(task);
          break;
        case 'data_validation':
          result = await this.runDataValidation(task);
          break;
        case 'index_rebuild':
          result = await this.runIndexRebuild(task);
          break;
        case 'performance_optimization':
          result = await this.runPerformanceOptimization(task);
          break;
        default:
          result = await this.runGenericTask(task);
      }

      task.status = 'completed';
      this.scheduleNextExecution(task);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      result = {
        taskId: task.id,
        success: false,
        startTime,
        endTime: new Date(),
        duration: Date.now() - startTime.getTime(),
        recordsProcessed: 0,
        recordsUpdated: 0,
        recordsSkipped: 0,
        errors: [{
          type: 'execution_error',
          message: errorMessage,
          timestamp: new Date(),
          severity: 'high',
          retryable: true
        }],
        warnings: [],
        performance: this.getDefaultPerformanceMetrics()
      };

      task.retryCount++;
      if (task.retryCount >= task.maxRetries) {
        task.status = 'failed';
        logger.error('Task failed after max retries', {
          taskId: task.id,
          retryCount: task.retryCount,
          error: errorMessage
        });
      } else {
        task.status = 'pending';
        this.taskQueue.push(task);
        logger.warn('Task failed, will retry', {
          taskId: task.id,
          retryCount: task.retryCount,
          maxRetries: task.maxRetries
        });
      }
    } finally {
      this.runningTasks.delete(task.id);
      this.recordTaskResult(task.id, result!);
    }

    return result!;
  }

  private async runCacheRefresh(task: UpdateTask): Promise<UpdateResult> {
    const startTime = new Date();
    let recordsProcessed = 0;
    let recordsUpdated = 0;

    const cacheKey = task.metadata.cacheKey;
    
    if (cacheKey) {
      // Refresh specific cache key
      this.cache.delete(cacheKey);
      recordsProcessed = 1;
      recordsUpdated = 1;
    } else {
      // Refresh all caches
      const allKeys = this.cache.keys();
      for (const key of allKeys) {
        this.cache.delete(key);
        recordsProcessed++;
        recordsUpdated++;
      }
    }

    return {
      taskId: task.id,
      success: true,
      startTime,
      endTime: new Date(),
      duration: Date.now() - startTime.getTime(),
      recordsProcessed,
      recordsUpdated,
      recordsSkipped: 0,
      errors: [],
      warnings: [],
      performance: this.calculatePerformanceMetrics(startTime, recordsProcessed)
    };
  }

  private async runKnowledgeGraphUpdate(task: UpdateTask): Promise<UpdateResult> {
    const startTime = new Date();
    
    // Simulate knowledge graph update
    await this.simulateWork(5000); // 5 seconds
    
    const recordsProcessed = 1000; // Simulated
    const recordsUpdated = 800; // Simulated

    return {
      taskId: task.id,
      success: true,
      startTime,
      endTime: new Date(),
      duration: Date.now() - startTime.getTime(),
      recordsProcessed,
      recordsUpdated,
      recordsSkipped: 200,
      errors: [],
      warnings: ['Some relationships could not be verified'],
      performance: this.calculatePerformanceMetrics(startTime, recordsProcessed)
    };
  }

  private async runModelRetrain(task: UpdateTask): Promise<UpdateResult> {
    const startTime = new Date();
    
    // Simulate model retraining
    await this.simulateWork(10000); // 10 seconds
    
    const recordsProcessed = 5000; // Training examples
    const recordsUpdated = 5000; // All used for training

    return {
      taskId: task.id,
      success: true,
      startTime,
      endTime: new Date(),
      duration: Date.now() - startTime.getTime(),
      recordsProcessed,
      recordsUpdated,
      recordsSkipped: 0,
      errors: [],
      warnings: [],
      performance: this.calculatePerformanceMetrics(startTime, recordsProcessed)
    };
  }

  private async runDataValidation(task: UpdateTask): Promise<UpdateResult> {
    const startTime = new Date();
    
    // Simulate data validation
    await this.simulateWork(3000); // 3 seconds
    
    const recordsProcessed = 2000;
    const recordsUpdated = 0; // Validation doesn't update, just checks

    return {
      taskId: task.id,
      success: true,
      startTime,
      endTime: new Date(),
      duration: Date.now() - startTime.getTime(),
      recordsProcessed,
      recordsUpdated,
      recordsSkipped: 0,
      errors: [],
      warnings: ['Minor data quality issues detected'],
      performance: this.calculatePerformanceMetrics(startTime, recordsProcessed),
      qualityMetrics: {
        completeness: 0.85,
        accuracy: 0.92,
        freshness: 0.78,
        reliability: 0.88,
        sources: ['pubmed', 'clinical_trials', 'fda'],
        lastValidated: new Date().toISOString()
      }
    };
  }

  private async runIndexRebuild(task: UpdateTask): Promise<UpdateResult> {
    const startTime = new Date();
    
    // Simulate index rebuild
    await this.simulateWork(8000); // 8 seconds
    
    const recordsProcessed = 10000;
    const recordsUpdated = 10000;

    return {
      taskId: task.id,
      success: true,
      startTime,
      endTime: new Date(),
      duration: Date.now() - startTime.getTime(),
      recordsProcessed,
      recordsUpdated,
      recordsSkipped: 0,
      errors: [],
      warnings: [],
      performance: this.calculatePerformanceMetrics(startTime, recordsProcessed)
    };
  }

  private async runPerformanceOptimization(task: UpdateTask): Promise<UpdateResult> {
    const startTime = new Date();
    
    // Clean up old cache entries
    const oldKeys = Array.from(this.cache.keys()).filter(key => {
      const entry = this.cache.get(key);
      return entry && entry.timestamp < Date.now() - 24 * 60 * 60 * 1000; // 24 hours
    });

    for (const key of oldKeys) {
      this.cache.delete(key);
    }

    // Clean up old task history
    for (const [taskId, results] of this.updateHistory.entries()) {
      if (results.length > 100) {
        this.updateHistory.set(taskId, results.slice(-50)); // Keep last 50
      }
    }

    await this.simulateWork(2000); // 2 seconds

    return {
      taskId: task.id,
      success: true,
      startTime,
      endTime: new Date(),
      duration: Date.now() - startTime.getTime(),
      recordsProcessed: oldKeys.length,
      recordsUpdated: oldKeys.length,
      recordsSkipped: 0,
      errors: [],
      warnings: [],
      performance: this.calculatePerformanceMetrics(startTime, oldKeys.length)
    };
  }

  private async runGenericTask(task: UpdateTask): Promise<UpdateResult> {
    const startTime = new Date();
    
    // Generic task simulation
    await this.simulateWork(1000);
    
    return {
      taskId: task.id,
      success: true,
      startTime,
      endTime: new Date(),
      duration: Date.now() - startTime.getTime(),
      recordsProcessed: 1,
      recordsUpdated: 1,
      recordsSkipped: 0,
      errors: [],
      warnings: [],
      performance: this.calculatePerformanceMetrics(startTime, 1)
    };
  }

  private async checkCacheHealth(): Promise<ComponentHealth> {
    const cacheSize = this.cache.size;
    const maxSize = 1000; // From constructor
    const utilizationRate = cacheSize / maxSize;

    let status: ComponentHealth['status'] = 'healthy';
    const issues: string[] = [];

    if (utilizationRate > 0.9) {
      status = 'degraded';
      issues.push('Cache utilization is high (>90%)');
    }
    
    if (utilizationRate > 0.98) {
      status = 'critical';
      issues.push('Cache is nearly full (>98%)');
    }

    return {
      name: 'Cache',
      status,
      lastUpdated: new Date(),
      metrics: {
        size: cacheSize,
        utilization: utilizationRate,
        hitRate: 0.85 // Simulated
      },
      issues
    };
  }

  private checkQueueHealth(): ComponentHealth {
    const queueSize = this.taskQueue.length;
    const runningTasks = this.runningTasks.size;

    let status: ComponentHealth['status'] = 'healthy';
    const issues: string[] = [];

    if (queueSize > 50) {
      status = 'degraded';
      issues.push('Task queue is backing up');
    }

    if (runningTasks >= this.maxConcurrentTasks) {
      issues.push('All task slots are occupied');
    }

    return {
      name: 'Task Queue',
      status,
      lastUpdated: new Date(),
      metrics: {
        queueSize,
        runningTasks,
        maxConcurrentTasks: this.maxConcurrentTasks
      },
      issues
    };
  }

  private async checkKnowledgeGraphHealth(): Promise<ComponentHealth> {
    // Simulate knowledge graph health check
    return {
      name: 'Knowledge Graph',
      status: 'healthy',
      lastUpdated: new Date(),
      metrics: {
        nodeCount: 5000,
        edgeCount: 15000,
        lastUpdated: Date.now() - 3600000 // 1 hour ago
      },
      issues: []
    };
  }

  private async checkMLModelsHealth(): Promise<ComponentHealth> {
    // Simulate ML models health check
    return {
      name: 'ML Models',
      status: 'healthy',
      lastUpdated: new Date(),
      metrics: {
        modelCount: 5,
        lastTrained: Date.now() - 86400000, // 1 day ago
        averageAccuracy: 0.85
      },
      issues: []
    };
  }

  private determineOverallHealth(components: Map<string, ComponentHealth>): SystemHealth['overall'] {
    const statuses = Array.from(components.values()).map(c => c.status);
    
    if (statuses.includes('critical')) return 'critical';
    if (statuses.includes('degraded')) return 'degraded';
    return 'healthy';
  }

  private generateHealthRecommendations(components: Map<string, ComponentHealth>): string[] {
    const recommendations: string[] = [];
    
    for (const component of components.values()) {
      if (component.status !== 'healthy') {
        recommendations.push(`Address issues in ${component.name}: ${component.issues.join(', ')}`);
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('System is operating normally');
    }

    return recommendations;
  }

  private calculateResourceRequirements(tasks: UpdateTask[]): ResourceRequirements {
    let memoryMB = 0;
    let diskSpaceMB = 0;
    let networkBandwidthMbps = 0;
    let estimatedDuration = 0;
    let exclusiveAccess = false;

    for (const task of tasks) {
      // Estimate resource requirements based on task type
      switch (task.type) {
        case 'knowledge_graph_update':
          memoryMB += 500;
          diskSpaceMB += 1000;
          networkBandwidthMbps += 10;
          estimatedDuration += 300000; // 5 minutes
          break;
        case 'model_retrain':
          memoryMB += 1000;
          diskSpaceMB += 500;
          estimatedDuration += 600000; // 10 minutes
          exclusiveAccess = true;
          break;
        case 'index_rebuild':
          memoryMB += 200;
          diskSpaceMB += 2000;
          estimatedDuration += 480000; // 8 minutes
          break;
        default:
          memoryMB += 100;
          diskSpaceMB += 100;
          estimatedDuration += 60000; // 1 minute
      }
    }

    return {
      memoryMB,
      diskSpaceMB,
      networkBandwidthMbps,
      estimatedDuration,
      exclusiveAccess
    };
  }

  private scheduleNextExecution(task?: UpdateTask): void {
    if (!this.isRunning) return;

    let nextRunTime = 5000; // Default 5 seconds

    if (task?.frequency) {
      switch (task.frequency) {
        case 'hourly':
          nextRunTime = 60 * 60 * 1000;
          break;
        case 'daily':
          nextRunTime = 24 * 60 * 60 * 1000;
          break;
        case 'weekly':
          nextRunTime = 7 * 24 * 60 * 60 * 1000;
          break;
        case 'monthly':
          nextRunTime = 30 * 24 * 60 * 60 * 1000;
          break;
      }

      if (task.frequency !== 'on_demand') {
        task.nextExecution = new Date(Date.now() + nextRunTime);
        task.status = 'scheduled';
      }
    }

    this.scheduler = setTimeout(() => {
      this.processTaskQueue();
    }, nextRunTime);
  }

  private async processTaskQueue(): Promise<void> {
    if (!this.isRunning || this.runningTasks.size >= this.maxConcurrentTasks) {
      this.scheduleNextExecution();
      return;
    }

    const pendingTasks = this.taskQueue.filter(task => 
      task.status === 'pending' && !this.runningTasks.has(task.id)
    );

    if (pendingTasks.length === 0) {
      this.scheduleNextExecution();
      return;
    }

    this.sortTaskQueue();
    const nextTask = pendingTasks[0];
    
    if (nextTask) {
      this.taskQueue.splice(this.taskQueue.indexOf(nextTask), 1);
      await this.runTask(nextTask);
    }

    // Schedule next processing cycle
    this.scheduleNextExecution();
  }

  private sortTaskQueue(): void {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    
    this.taskQueue.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      // If same priority, sort by scheduled time
      const aTime = a.scheduledTime?.getTime() || 0;
      const bTime = b.scheduledTime?.getTime() || 0;
      return aTime - bTime;
    });
  }

  private recordTaskResult(taskId: string, result: UpdateResult): void {
    if (!this.updateHistory.has(taskId)) {
      this.updateHistory.set(taskId, []);
    }
    
    const history = this.updateHistory.get(taskId)!;
    history.push(result);
    
    // Keep only last 20 results per task
    if (history.length > 20) {
      this.updateHistory.set(taskId, history.slice(-20));
    }
  }

  private calculatePerformanceMetrics(startTime: Date, recordsProcessed: number): PerformanceMetrics {
    const duration = Date.now() - startTime.getTime();
    const throughput = duration > 0 ? (recordsProcessed / duration) * 1000 : 0; // records per second

    return {
      memoryUsed: process.memoryUsage().heapUsed / 1024 / 1024, // MB
      cpuTime: duration,
      ioOperations: recordsProcessed, // Simplified
      cacheHitRate: 0.8, // Simulated
      throughput
    };
  }

  private getDefaultPerformanceMetrics(): PerformanceMetrics {
    return {
      memoryUsed: 0,
      cpuTime: 0,
      ioOperations: 0,
      cacheHitRate: 0,
      throughput: 0
    };
  }

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async simulateWork(duration: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, duration));
  }

  private initializeDefaultTasks(): void {
    // Add default maintenance tasks
    const dailyMaintenance = this.addTask({
      type: 'performance_optimization',
      priority: 'low',
      description: 'Daily system maintenance and cleanup',
      targetResource: 'system',
      frequency: 'daily',
      maxRetries: 2,
      metadata: { automatic: true }
    });

    const weeklyKGUpdate = this.addTask({
      type: 'knowledge_graph_update',
      priority: 'medium',
      description: 'Weekly knowledge graph update',
      targetResource: 'knowledge_graph',
      frequency: 'weekly',
      maxRetries: 3,
      metadata: { automatic: true }
    });

    logger.info('Initialized default maintenance tasks', {
      dailyMaintenance,
      weeklyKGUpdate
    });
  }
}

// Export singleton instance
export const knowledgeUpdater = new KnowledgeUpdater();