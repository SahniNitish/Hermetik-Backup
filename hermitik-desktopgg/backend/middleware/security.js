const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const { body, validationResult } = require('express-validator');

// Security Headers Middleware
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "https://api.coingecko.com", "https://pro-openapi.debank.com"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: "same-origin" }
});

// Rate Limiting Configurations
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil(15 * 60 * 1000 / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.log(`Rate limit exceeded for IP: ${req.ip}, URL: ${req.originalUrl}`);
    res.status(429).json({
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.ceil(15 * 60 * 1000 / 1000)
    });
  }
});

// Relaxed rate limiting for auth endpoints (development)
const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes (reduced window)
  max: 50, // increased limit for development
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: Math.ceil(5 * 60 * 1000 / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
  handler: (req, res) => {
    console.log(`Auth rate limit exceeded for IP: ${req.ip}, URL: ${req.originalUrl}`);
    res.status(429).json({
      error: 'Too many authentication attempts, please try again later.',
      retryAfter: Math.ceil(5 * 60 * 1000 / 1000)
    });
  }
});

// API rate limiting for external API heavy endpoints
const apiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // limit each IP to 20 API requests per 5 minutes
  message: {
    error: 'Too many API requests, please try again later.',
    retryAfter: Math.ceil(5 * 60 * 1000 / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Slow down repeated requests
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // allow 50 requests per windowMs without delay
  delayMs: () => 100, // add 100ms delay per request after delayAfter
  maxDelayMs: 2000, // max delay of 2 seconds
  validate: { delayMs: false } // Disable warning
});

// Input Validation Helpers
const validateEmail = body('email')
  .isEmail()
  .normalizeEmail()
  .withMessage('Please provide a valid email address');

const validatePassword = body('password')
  .isLength({ min: 8 })
  .withMessage('Password must be at least 8 characters long')
  .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
  .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character');

const validateWalletAddress = body('address')
  .matches(/^0x[a-fA-F0-9]{40}$/)
  .withMessage('Please provide a valid Ethereum wallet address');

const validateName = body('name')
  .isLength({ min: 2, max: 50 })
  .trim()
  .escape()
  .withMessage('Name must be between 2 and 50 characters');

// Validation Error Handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log(`Validation errors for IP: ${req.ip}, URL: ${req.originalUrl}`, errors.array());
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.param,
        message: err.msg
      }))
    });
  }
  next();
};

// Sanitize request body to prevent NoSQL injection
const sanitizeBody = (req, res, next) => {
  if (req.body) {
    for (let key in req.body) {
      if (typeof req.body[key] === 'object' && req.body[key] !== null) {
        // Convert objects to strings to prevent NoSQL injection
        req.body[key] = JSON.stringify(req.body[key]);
      }
    }
  }
  next();
};

// Security logging middleware
const securityLogger = (req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logData = {
      timestamp: new Date().toISOString(),
      ip: req.ip,
      method: req.method,
      url: req.originalUrl,
      userAgent: req.get('user-agent'),
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('content-length')
    };

    // Log suspicious activities
    if (res.statusCode === 401 || res.statusCode === 403 || res.statusCode === 429) {
      console.warn('🚨 SECURITY ALERT:', logData);
    } else {
      console.log('📊 REQUEST:', logData);
    }
  });
  
  next();
};

module.exports = {
  securityHeaders,
  generalLimiter,
  authLimiter,
  apiLimiter,
  speedLimiter,
  validateEmail,
  validatePassword,
  validateWalletAddress,
  validateName,
  handleValidationErrors,
  sanitizeBody,
  securityLogger
};
