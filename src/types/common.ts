// src/types/common.ts

export interface APIResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
  pageSize: number;
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  nextPageToken?: string;
}

export interface DateRange {
  from?: string;
  to?: string;
}

export interface SearchFilters {
  dateRange?: DateRange;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface AnalysisOptions {
  depth: 'basic' | 'detailed' | 'comprehensive';
  includeMetadata?: boolean;
  includeRawData?: boolean;
  cacheResults?: boolean;
}

export interface CrossReferenceData {
  source: string;
  id: string;
  url?: string;
  relevanceScore?: number;
  lastUpdated?: string;
}

export interface DataQuality {
  completeness: number; // 0-1 scale
  accuracy: number; // 0-1 scale
  freshness: number; // 0-1 scale (how recent the data is)
  reliability: number; // 0-1 scale
  sources: string[];
  lastValidated?: string;
}

export interface ErrorDetails {
  code: string;
  message: string;
  context?: Record<string, any>;
  timestamp: string;
  retryable: boolean;
}

export interface PerformanceMetrics {
  responseTime: number;
  cacheHitRate: number;
  apiCallCount: number;
  errorRate: number;
  throughput: number; // requests per second
}

export interface SecurityContext {
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  permissions: string[];
  rateLimitRemaining?: number;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  resource: string;
  userId?: string;
  details: Record<string, any>;
  result: 'success' | 'failure' | 'partial';
}

export interface HealthCheck {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: string;
  responseTime: number;
  details?: Record<string, any>;
}

export interface ConfigurationOptions {
  apiKeys: {
    pubmed?: string;
    fda?: string;
    clinicalTrials?: string;
  };
  caching: {
    enabled: boolean;
    ttl: number;
    maxKeys: number;
  };
  rateLimit: {
    requestsPerMinute: number;
    requestsPerHour: number;
    burstLimit: number;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    enableConsole: boolean;
    enableFile: boolean;
    maxFileSize: string;
  };
  security: {
    enableAuthentication: boolean;
    enableAuthorization: boolean;
    enableAuditLogging: boolean;
    allowedOrigins: string[];
  };
}
