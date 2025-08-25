const winston = require('winston');
const path = require('path');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
const fs = require('fs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
    return JSON.stringify({
      timestamp,
      level,
      service: service || 'hermetik-backend',
      message,
      ...meta
    });
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'hermetik-backend' },
  transports: [
    // Write errors to error.log
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    }),

    // Write all logs to combined.log
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    }),

    // Write security events to security.log
    new winston.transports.File({
      filename: path.join(logsDir, 'security.log'),
      level: 'warn',
      maxsize: 5242880, // 5MB
      maxFiles: 10,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    }),

    // Write performance logs to performance.log
    new winston.transports.File({
      filename: path.join(logsDir, 'performance.log'),
      level: 'info',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  ]
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple(),
      winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
        const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
        return `${timestamp} [${service}] ${level}: ${message} ${metaStr}`;
      })
    )
  }));
}

// Enhanced logging methods
const enhancedLogger = {
  // Standard logging methods
  error: (message, meta = {}) => logger.error(message, meta),
  warn: (message, meta = {}) => logger.warn(message, meta),
  info: (message, meta = {}) => logger.info(message, meta),
  debug: (message, meta = {}) => logger.debug(message, meta),

  // Security-specific logging
  security: {
    loginAttempt: (email, ip, success, reason = null) => {
      logger.warn('LOGIN_ATTEMPT', {
        category: 'security',
        event: 'login_attempt',
        email,
        ip,
        success,
        reason,
        timestamp: new Date().toISOString()
      });
    },

    authFailure: (ip, endpoint, reason) => {
      logger.warn('AUTH_FAILURE', {
        category: 'security',
        event: 'auth_failure',
        ip,
        endpoint,
        reason,
        timestamp: new Date().toISOString()
      });
    },

    rateLimitHit: (ip, endpoint, limit) => {
      logger.warn('RATE_LIMIT_HIT', {
        category: 'security',
        event: 'rate_limit',
        ip,
        endpoint,
        limit,
        timestamp: new Date().toISOString()
      });
    },

    suspiciousActivity: (ip, activity, details) => {
      logger.warn('SUSPICIOUS_ACTIVITY', {
        category: 'security',
        event: 'suspicious_activity',
        ip,
        activity,
        details,
        timestamp: new Date().toISOString()
      });
    }
  },

  // Performance-specific logging
  performance: {
    slowQuery: (query, duration, collection) => {
      logger.info('SLOW_QUERY', {
        category: 'performance',
        event: 'slow_query',
        query,
        duration,
        collection,
        timestamp: new Date().toISOString()
      });
    },

    apiCall: (url, duration, status, cached = false) => {
      logger.info('API_CALL', {
        category: 'performance',
        event: 'api_call',
        url,
        duration,
        status,
        cached,
        timestamp: new Date().toISOString()
      });
    },

    cacheOperation: (operation, key, hit = null) => {
      logger.debug('CACHE_OPERATION', {
        category: 'performance',
        event: 'cache_operation',
        operation,
        key,
        hit,
        timestamp: new Date().toISOString()
      });
    }
  },

  // Business logic logging
  business: {
    walletAdded: (userId, address, chain) => {
      logger.info('WALLET_ADDED', {
        category: 'business',
        event: 'wallet_added',
        userId,
        address,
        chain,
        timestamp: new Date().toISOString()
      });
    },

    walletRemoved: (userId, address) => {
      logger.info('WALLET_REMOVED', {
        category: 'business',
        event: 'wallet_removed',
        userId,
        address,
        timestamp: new Date().toISOString()
      });
    },

    dataSnapshot: (userId, walletsCount, totalValue) => {
      logger.info('DATA_SNAPSHOT', {
        category: 'business',
        event: 'data_snapshot',
        userId,
        walletsCount,
        totalValue,
        timestamp: new Date().toISOString()
      });
    }
  },

  // Error tracking with context
  errorWithContext: (error, context = {}) => {
    logger.error('ERROR_WITH_CONTEXT', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      context,
      timestamp: new Date().toISOString()
    });
  }
};

// Request logging middleware using winston
const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Log incoming request
  enhancedLogger.info('INCOMING_REQUEST', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    contentLength: req.get('content-length')
  });

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    // Log response
    enhancedLogger.info('REQUEST_COMPLETED', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      contentLength: res.get('content-length')
    });

    // Log errors and warnings
    if (res.statusCode >= 400) {
      enhancedLogger.warn('REQUEST_ERROR', {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip
      });
    }
  });

  next();
};

module.exports = {
  logger: enhancedLogger,
  requestLogger,
  rawLogger: logger
};
