// src/utils/responseSizeMonitor.ts

export interface SizeConfig {
  maxResponseSize: number; // Maximum response size in bytes
  warningThreshold: number; // Warning threshold as percentage (0-1)
  truncationMode: 'truncate' | 'summarize' | 'fail';
  enableSizeTracking: boolean;
}

export interface SizeMetrics {
  responseSize: number;
  estimatedMemoryUsage: number;
  compressionRatio?: number;
  truncated: boolean;
  originalSize?: number;
}

export interface SizeExceededInfo {
  actualSize: number;
  maxSize: number;
  exceedsByBytes: number;
  exceedsByPercent: number;
  suggestedActions: string[];
}

export class ResponseSizeMonitor {
  private static instance: ResponseSizeMonitor;
  private config: SizeConfig;
  private metrics: Map<string, SizeMetrics> = new Map();

  private constructor(config: Partial<SizeConfig> = {}) {
    this.config = {
      maxResponseSize: 1048576, // 1MB default (matches the error message)
      warningThreshold: 0.8,
      truncationMode: 'fail',
      enableSizeTracking: true,
      ...config
    };
  }

  static getInstance(config?: Partial<SizeConfig>): ResponseSizeMonitor {
    if (!ResponseSizeMonitor.instance) {
      ResponseSizeMonitor.instance = new ResponseSizeMonitor(config);
    }
    return ResponseSizeMonitor.instance;
  }

  updateConfig(config: Partial<SizeConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Calculate the size of a response object in bytes
   */
  calculateSize(data: any): number {
    const jsonString = JSON.stringify(data);
    return new TextEncoder().encode(jsonString).length;
  }

  /**
   * Check if response size exceeds limits
   */
  checkSizeLimit(data: any, context: string = 'unknown'): {
    withinLimit: boolean;
    metrics: SizeMetrics;
    exceededInfo?: SizeExceededInfo;
  } {
    const size = this.calculateSize(data);
    const withinLimit = size <= this.config.maxResponseSize;
    const withinWarning = size <= (this.config.maxResponseSize * this.config.warningThreshold);

    const metrics: SizeMetrics = {
      responseSize: size,
      estimatedMemoryUsage: size * 1.2, // Rough estimate with overhead
      truncated: false,
      originalSize: size
    };

    if (this.config.enableSizeTracking) {
      this.metrics.set(context, metrics);
    }

    if (!withinLimit) {
      const exceededInfo: SizeExceededInfo = {
        actualSize: size,
        maxSize: this.config.maxResponseSize,
        exceedsByBytes: size - this.config.maxResponseSize,
        exceedsByPercent: ((size - this.config.maxResponseSize) / this.config.maxResponseSize) * 100,
        suggestedActions: this.generateSuggestedActions(size, context)
      };

      return { withinLimit: false, metrics, exceededInfo };
    }

    return { withinLimit: true, metrics };
  }

  /**
   * Generate suggested actions for oversized responses
   */
  private generateSuggestedActions(size: number, context: string): string[] {
    const suggestions: string[] = [];
    
    // Context-specific suggestions
    if (context.includes('clinical') || context.includes('trial')) {
      suggestions.push(
        'Filter by study phase (e.g., Phase III only)',
        'Limit to recent studies (last 1-2 years)',
        'Filter by study status (e.g., Active, Recruiting only)',
        'Reduce page size and use pagination',
        'Select specific fields instead of full study details'
      );
    }

    if (context.includes('pubmed') || context.includes('publication')) {
      suggestions.push(
        'Add date range filter (e.g., last 5 years)',
        'Use more specific search terms',
        'Filter by publication type (e.g., clinical trials only)',
        'Limit to specific journals or impact factors',
        'Reduce the number of results per page'
      );
    }

    // General suggestions
    suggestions.push(
      'Use more specific search criteria',
      'Apply additional filters to narrow results',
      'Load results in smaller batches',
      'Use progressive loading instead of bulk retrieval'
    );

    return suggestions;
  }

  /**
   * Attempt to truncate response while preserving important data
   */
  truncateResponse(data: any, context: string = 'unknown'): {
    truncatedData: any;
    metrics: SizeMetrics;
    truncationSummary: string;
  } {
    const originalSize = this.calculateSize(data);
    let truncatedData = data;
    let truncationSummary = '';

    if (Array.isArray(data)) {
      // For arrays, keep the first portion and add summary
      const maxItems = Math.floor(data.length * 0.3); // Keep 30% of items
      truncatedData = data.slice(0, maxItems);
      truncationSummary = `Showing ${maxItems} of ${data.length} results. Use pagination or filters to access remaining ${data.length - maxItems} items.`;
    } else if (typeof data === 'object' && data !== null) {
      // For objects, try to preserve structure but truncate arrays within
      truncatedData = { ...data };
      if (data.studies && Array.isArray(data.studies)) {
        const maxStudies = Math.floor(data.studies.length * 0.3);
        truncatedData.studies = data.studies.slice(0, maxStudies);
        truncationSummary = `Showing ${maxStudies} of ${data.studies.length} studies. Use pagination or filters to access remaining ${data.studies.length - maxStudies} studies.`;
      }
    }

    const newSize = this.calculateSize(truncatedData);
    const metrics: SizeMetrics = {
      responseSize: newSize,
      estimatedMemoryUsage: newSize * 1.2,
      truncated: true,
      originalSize
    };

    if (this.config.enableSizeTracking) {
      this.metrics.set(context, metrics);
    }

    return { truncatedData, metrics, truncationSummary };
  }

  /**
   * Get size metrics for a specific context
   */
  getMetrics(context: string): SizeMetrics | undefined {
    return this.metrics.get(context);
  }

  /**
   * Get all recorded metrics
   */
  getAllMetrics(): Map<string, SizeMetrics> {
    return new Map(this.metrics);
  }

  /**
   * Clear metrics for a specific context or all contexts
   */
  clearMetrics(context?: string): void {
    if (context) {
      this.metrics.delete(context);
    } else {
      this.metrics.clear();
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): SizeConfig {
    return { ...this.config };
  }

  /**
   * Check if size is approaching the warning threshold
   */
  isApproachingLimit(size: number): boolean {
    return size >= (this.config.maxResponseSize * this.config.warningThreshold);
  }

  /**
   * Format size in human-readable format
   */
  formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
}

// Convenience function for quick size checks
export function checkResponseSize(data: any, context: string = 'unknown', config?: Partial<SizeConfig>) {
  const monitor = ResponseSizeMonitor.getInstance(config);
  return monitor.checkSizeLimit(data, context);
}