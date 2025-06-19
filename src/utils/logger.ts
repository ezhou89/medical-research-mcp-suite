// src/utils/logger.ts

import winston from 'winston';
import path from 'path';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Add colors to winston
winston.addColors(colors);

// Define log format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`)
);

// Define which transports the logger must use
const transports = [
  // Console transport
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }),
  
  // File transport for errors
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'error.log'),
    level: 'error',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
  }),
  
  // File transport for all logs
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'combined.log'),
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
  }),
];

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format,
  transports,
});

// Create specialized loggers for different components
export const apiLogger = logger.child({ component: 'api' });
export const cacheLogger = logger.child({ component: 'cache' });
export const mcpLogger = logger.child({ component: 'mcp' });

// Helper functions for common logging patterns
export const logAPICall = (
  apiName: string,
  endpoint: string,
  params: any,
  responseTime?: number,
  error?: Error
) => {
  const logData = {
    api: apiName,
    endpoint,
    params: JSON.stringify(params),
    responseTime,
    timestamp: new Date().toISOString(),
  };

  if (error) {
    apiLogger.error(`API call failed: ${apiName}/${endpoint}`, {
      ...logData,
      error: error.message,
      stack: error.stack,
    });
  } else {
    apiLogger.info(`API call successful: ${apiName}/${endpoint}`, logData);
  }
};

export const logCacheOperation = (
  operation: 'hit' | 'miss' | 'set' | 'delete' | 'clear',
  key: string,
  details?: any
) => {
  cacheLogger.debug(`Cache ${operation}: ${key}`, {
    operation,
    key,
    details,
    timestamp: new Date().toISOString(),
  });
};

export const logMCPOperation = (
  operation: 'tool_call' | 'tool_list' | 'error',
  toolName?: string,
  args?: any,
  responseTime?: number,
  error?: Error
) => {
  const logData = {
    operation,
    toolName,
    args: args ? JSON.stringify(args) : undefined,
    responseTime,
    timestamp: new Date().toISOString(),
  };

  if (error) {
    mcpLogger.error(`MCP operation failed: ${operation}`, {
      ...logData,
      error: error.message,
      stack: error.stack,
    });
  } else {
    mcpLogger.info(`MCP operation successful: ${operation}`, logData);
  }
};

export const logSecurityEvent = (
  event: 'auth_failure' | 'rate_limit' | 'suspicious_activity',
  details: any
) => {
  logger.warn(`Security event: ${event}`, {
    event,
    details,
    timestamp: new Date().toISOString(),
    severity: 'security',
  });
};

// Performance monitoring
export const performanceMonitor = {
  startTimer: (label: string) => {
    const start = Date.now();
    return {
      end: () => {
        const duration = Date.now() - start;
        logger.debug(`Performance: ${label} took ${duration}ms`);
        return duration;
      },
    };
  },
};

// Error with context helper
export const createErrorWithContext = (
  message: string,
  context: Record<string, any>,
  originalError?: Error
): Error => {
  const error = new Error(message);
  (error as any).context = context;
  if (originalError) {
    (error as any).originalError = originalError;
    error.stack = originalError.stack;
  }
  return error;
};

export default logger;
