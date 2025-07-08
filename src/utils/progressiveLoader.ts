// src/utils/progressiveLoader.ts

import { ResponseSizeMonitor } from './responseSizeMonitor';

export interface ProgressiveLoadingConfig {
  pageSize: number;
  maxPages: number;
  maxTotalSize?: number;
  loadingStrategy: 'sequential' | 'priority_based' | 'user_controlled';
  enableSizeMonitoring: boolean;
  onProgress?: (progress: ProgressiveLoadingProgress) => void;
  onBatch?: (batch: any[], batchInfo: BatchInfo) => void;
}

export interface ProgressiveLoadingProgress {
  currentPage: number;
  totalPages: number;
  itemsLoaded: number;
  estimatedTotal: number;
  percentComplete: number;
  currentSize: number;
  maxSize: number;
  timeElapsed: number;
  estimatedTimeRemaining: number;
}

export interface BatchInfo {
  batchNumber: number;
  batchSize: number;
  isLast: boolean;
  pageToken?: string;
  accumulatedSize: number;
  processingTime: number;
}

export interface ProgressiveLoadingResult<T> {
  success: true;
  data: T[];
  totalLoaded: number;
  totalPages: number;
  completedFully: boolean;
  stoppedReason?: 'size_limit' | 'page_limit' | 'user_requested' | 'error';
  finalSize: number;
  processingTime: number;
  metadata: {
    avgBatchSize: number;
    avgProcessingTime: number;
    sizeEfficiency: number;
    cacheHits: number;
  };
}

export interface ProgressiveLoadingError {
  success: false;
  error: Error;
  partialData?: any[];
  progress: ProgressiveLoadingProgress;
}

export type ProgressiveLoadingResponse<T> = ProgressiveLoadingResult<T> | ProgressiveLoadingError;

export interface DataLoader<T, P> {
  load(params: P): Promise<{ data: T[]; totalCount?: number; nextPageToken?: string }>;
  getName(): string;
}

export class ProgressiveLoader<T, P> {
  private sizeMonitor: ResponseSizeMonitor;
  private config: ProgressiveLoadingConfig;
  private startTime: number = 0;
  private accumulatedSize: number = 0;
  private batchTimes: number[] = [];
  private cacheHits: number = 0;

  constructor(config: Partial<ProgressiveLoadingConfig> = {}) {
    this.config = {
      pageSize: 50,
      maxPages: 10,
      maxTotalSize: 1048576, // 1MB default
      loadingStrategy: 'sequential',
      enableSizeMonitoring: true,
      ...config
    };
    
    this.sizeMonitor = ResponseSizeMonitor.getInstance();
  }

  /**
   * Load data progressively with size monitoring and user control
   */
  async loadProgressively(
    loader: DataLoader<T, P>,
    baseParams: P,
    options: Partial<ProgressiveLoadingConfig> = {}
  ): Promise<ProgressiveLoadingResponse<T>> {
    const finalConfig = { ...this.config, ...options };
    this.startTime = Date.now();
    this.accumulatedSize = 0;
    this.batchTimes = [];
    this.cacheHits = 0;

    const allData: T[] = [];
    let currentPage = 0;
    let pageToken: string | undefined;
    let totalCount = 0;
    let stoppedReason: 'size_limit' | 'page_limit' | 'user_requested' | 'error' | undefined;

    try {
      do {
        const batchStartTime = Date.now();
        
        // Prepare parameters for this batch
        const batchParams = this.prepareBatchParams(baseParams, finalConfig.pageSize, pageToken);
        
        // Load batch
        const batchResult = await loader.load(batchParams);
        const batchProcessingTime = Date.now() - batchStartTime;
        this.batchTimes.push(batchProcessingTime);

        // Calculate size if monitoring is enabled
        let batchSize = 0;
        if (finalConfig.enableSizeMonitoring) {
          batchSize = this.sizeMonitor.calculateSize(batchResult.data);
          this.accumulatedSize += batchSize;

          // Check if adding this batch would exceed size limits
          if (finalConfig.maxTotalSize && this.accumulatedSize > finalConfig.maxTotalSize) {
            stoppedReason = 'size_limit';
            break;
          }
        }

        // Update totals
        allData.push(...batchResult.data);
        totalCount = batchResult.totalCount || totalCount;
        pageToken = batchResult.nextPageToken;
        currentPage++;

        // Create batch info
        const batchInfo: BatchInfo = {
          batchNumber: currentPage,
          batchSize: batchResult.data.length,
          isLast: !pageToken || currentPage >= finalConfig.maxPages,
          pageToken,
          accumulatedSize: this.accumulatedSize,
          processingTime: batchProcessingTime
        };

        // Call batch callback if provided
        if (finalConfig.onBatch) {
          finalConfig.onBatch(batchResult.data, batchInfo);
        }

        // Update progress
        const progress = this.calculateProgress(
          currentPage,
          finalConfig.maxPages,
          allData.length,
          totalCount,
          this.accumulatedSize,
          finalConfig.maxTotalSize || this.sizeMonitor.getConfig().maxResponseSize
        );

        // Call progress callback if provided
        if (finalConfig.onProgress) {
          finalConfig.onProgress(progress);
        }

        // Check if we've reached the page limit
        if (currentPage >= finalConfig.maxPages) {
          stoppedReason = 'page_limit';
          break;
        }

        // For user-controlled loading, we might pause here
        if (finalConfig.loadingStrategy === 'user_controlled') {
          // In a real implementation, this would wait for user input
          // For now, we'll continue automatically
        }

      } while (pageToken);

      // Calculate final metrics
      const processingTime = Date.now() - this.startTime;
      const avgBatchSize = allData.length / Math.max(currentPage, 1);
      const avgProcessingTime = this.batchTimes.reduce((a, b) => a + b, 0) / Math.max(this.batchTimes.length, 1);
      const sizeEfficiency = finalConfig.maxTotalSize ? (this.accumulatedSize / finalConfig.maxTotalSize) : 1;

      return {
        success: true,
        data: allData,
        totalLoaded: allData.length,
        totalPages: currentPage,
        completedFully: !stoppedReason,
        stoppedReason,
        finalSize: this.accumulatedSize,
        processingTime,
        metadata: {
          avgBatchSize,
          avgProcessingTime,
          sizeEfficiency,
          cacheHits: this.cacheHits
        }
      };

    } catch (error) {
      const progress = this.calculateProgress(
        currentPage,
        finalConfig.maxPages,
        allData.length,
        totalCount,
        this.accumulatedSize,
        finalConfig.maxTotalSize || this.sizeMonitor.getConfig().maxResponseSize
      );

      return {
        success: false,
        error: error instanceof Error ? error : new Error('Unknown error occurred'),
        partialData: allData,
        progress
      };
    }
  }

  /**
   * Load data with smart chunking based on size constraints
   */
  async loadWithSmartChunking(
    loader: DataLoader<T, P>,
    baseParams: P,
    targetSize: number = 500000 // 500KB default
  ): Promise<ProgressiveLoadingResponse<T>> {
    // Start with a small page size and adjust based on actual data size
    let adaptivePageSize = 10;
    const allData: T[] = [];
    let currentSize = 0;
    let pageToken: string | undefined;
    let iterations = 0;
    const maxIterations = 20;

    try {
      do {
        const batchParams = this.prepareBatchParams(baseParams, adaptivePageSize, pageToken);
        const batchResult = await loader.load(batchParams);
        const batchSize = this.sizeMonitor.calculateSize(batchResult.data);

        // Check if adding this batch would exceed target size
        if (currentSize + batchSize > targetSize && allData.length > 0) {
          break;
        }

        allData.push(...batchResult.data);
        currentSize += batchSize;
        pageToken = batchResult.nextPageToken;
        iterations++;

        // Adjust page size based on actual data size
        if (batchResult.data.length > 0) {
          const avgItemSize = batchSize / batchResult.data.length;
          const remainingSize = targetSize - currentSize;
          const estimatedRemainingItems = Math.floor(remainingSize / avgItemSize);
          
          // Adjust page size for next iteration
          adaptivePageSize = Math.max(5, Math.min(100, Math.floor(estimatedRemainingItems * 0.8)));
        }

      } while (pageToken && iterations < maxIterations && currentSize < targetSize);

      return {
        success: true,
        data: allData,
        totalLoaded: allData.length,
        totalPages: iterations,
        completedFully: !pageToken,
        stoppedReason: pageToken ? 'size_limit' : undefined,
        finalSize: currentSize,
        processingTime: Date.now() - this.startTime,
        metadata: {
          avgBatchSize: allData.length / Math.max(iterations, 1),
          avgProcessingTime: 0,
          sizeEfficiency: currentSize / targetSize,
          cacheHits: this.cacheHits
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Unknown error occurred'),
        partialData: allData,
        progress: this.calculateProgress(iterations, maxIterations, allData.length, 0, currentSize, targetSize)
      };
    }
  }

  /**
   * Prepare parameters for a batch request
   */
  private prepareBatchParams(baseParams: P, pageSize: number, pageToken?: string): P {
    return {
      ...baseParams,
      pageSize,
      pageToken
    } as P;
  }

  /**
   * Calculate loading progress
   */
  private calculateProgress(
    currentPage: number,
    maxPages: number,
    itemsLoaded: number,
    estimatedTotal: number,
    currentSize: number,
    maxSize: number
  ): ProgressiveLoadingProgress {
    const timeElapsed = Date.now() - this.startTime;
    const pageProgress = currentPage / maxPages;
    const sizeProgress = maxSize > 0 ? currentSize / maxSize : 0;
    const itemProgress = estimatedTotal > 0 ? itemsLoaded / estimatedTotal : 0;
    
    // Use the most conservative progress estimate
    const percentComplete = Math.min(pageProgress, sizeProgress, itemProgress || 1) * 100;
    
    // Estimate time remaining based on current progress
    const estimatedTimeRemaining = percentComplete > 0 ? 
      (timeElapsed / percentComplete) * (100 - percentComplete) : 0;

    return {
      currentPage,
      totalPages: maxPages,
      itemsLoaded,
      estimatedTotal,
      percentComplete,
      currentSize,
      maxSize,
      timeElapsed,
      estimatedTimeRemaining
    };
  }

  /**
   * Get formatted progress string
   */
  getProgressString(progress: ProgressiveLoadingProgress): string {
    const sizeStr = this.sizeMonitor.formatSize(progress.currentSize);
    const maxSizeStr = this.sizeMonitor.formatSize(progress.maxSize);
    const timeStr = this.formatTime(progress.timeElapsed);
    
    return `Progress: ${progress.percentComplete.toFixed(1)}% (${progress.itemsLoaded} items, ${sizeStr}/${maxSizeStr}, ${timeStr})`;
  }

  /**
   * Format time in human-readable format
   */
  private formatTime(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}