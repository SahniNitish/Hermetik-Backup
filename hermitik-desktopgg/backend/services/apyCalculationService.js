const PositionHistory = require('../models/PositionHistory');
const DailySnapshot = require('../models/DailySnapshot');

// Redis client for caching (fallback to memory cache if Redis not available)
let redisClient = null;
let memoryCache = new Map();

try {
  // Try to initialize Redis client
  const redis = require('redis');
  redisClient = redis.createClient({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: process.env.REDIS_DB || 0
  });

  redisClient.on('error', (err) => {
    console.warn('Redis connection error, falling back to memory cache:', err.message);
    redisClient = null;
  });

  redisClient.on('connect', () => {
    console.log('Redis connected for APY caching');
  });
} catch (error) {
  console.warn('Redis not available, using memory cache for APY calculations:', error.message);
  redisClient = null;
}

class APYCalculationService {
  
  // Cache configuration
  static CACHE_CONFIG = {
    // Cache TTL (Time To Live) in seconds
    APY_CALCULATION_TTL: 3600,        // 1 hour for APY calculations
    PORTFOLIO_PERFORMANCE_TTL: 1800,   // 30 minutes for portfolio performance
    POSITION_SUMMARY_TTL: 900,        // 15 minutes for position summaries
    HISTORICAL_DATA_TTL: 7200,        // 2 hours for historical data
    
    // Cache key prefixes
    PREFIX_APY: 'apy:position:',
    PREFIX_PORTFOLIO: 'apy:portfolio:',
    PREFIX_SUMMARY: 'apy:summary:',
    PREFIX_HISTORICAL: 'apy:historical:',
    
    // Memory cache limits (when Redis unavailable)
    MAX_MEMORY_CACHE_SIZE: 1000,
    MEMORY_CACHE_CLEANUP_INTERVAL: 300000 // 5 minutes
  };

  /**
   * Get data from cache (Redis or memory fallback)
   */
  static async getFromCache(key) {
    try {
      if (redisClient && redisClient.connected) {
        const cached = await redisClient.get(key);
        return cached ? JSON.parse(cached) : null;
      } else {
        // Fallback to memory cache
        const cached = memoryCache.get(key);
        if (cached && cached.expiry > Date.now()) {
          return cached.data;
        } else if (cached) {
          // Expired, remove from memory cache
          memoryCache.delete(key);
        }
        return null;
      }
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set data in cache (Redis or memory fallback)
   */
  static async setInCache(key, data, ttlSeconds) {
    try {
      if (redisClient && redisClient.connected) {
        await redisClient.setex(key, ttlSeconds, JSON.stringify(data));
      } else {
        // Fallback to memory cache with expiry
        const expiry = Date.now() + (ttlSeconds * 1000);
        memoryCache.set(key, { data, expiry });
        
        // Cleanup memory cache if it gets too large
        if (memoryCache.size > this.CACHE_CONFIG.MAX_MEMORY_CACHE_SIZE) {
          this.cleanupMemoryCache();
        }
      }
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  /**
   * Invalidate cache entries matching a pattern
   */
  static async invalidateCache(pattern) {
    try {
      if (redisClient && redisClient.connected) {
        const keys = await redisClient.keys(pattern);
        if (keys.length > 0) {
          await redisClient.del(keys);
        }
      } else {
        // For memory cache, manually check each key
        const keysToDelete = [];
        for (const key of memoryCache.keys()) {
          if (key.includes(pattern.replace('*', ''))) {
            keysToDelete.push(key);
          }
        }
        keysToDelete.forEach(key => memoryCache.delete(key));
      }
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }

  /**
   * Cleanup expired entries from memory cache
   */
  static cleanupMemoryCache() {
    const now = Date.now();
    const expiredKeys = [];
    
    for (const [key, value] of memoryCache.entries()) {
      if (value.expiry <= now) {
        expiredKeys.push(key);
      }
    }
    
    expiredKeys.forEach(key => memoryCache.delete(key));
    
    // If still too large, remove oldest entries
    if (memoryCache.size > this.CACHE_CONFIG.MAX_MEMORY_CACHE_SIZE) {
      const entries = Array.from(memoryCache.entries())
        .sort((a, b) => a[1].expiry - b[1].expiry);
      
      const toRemove = entries.slice(0, Math.floor(this.CACHE_CONFIG.MAX_MEMORY_CACHE_SIZE * 0.2));
      toRemove.forEach(([key]) => memoryCache.delete(key));
    }
  }

  /**
   * Generate cache key for APY calculation
   */
  static generateAPYCacheKey(userId, debankPositionId, targetDate) {
    const dateStr = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD
    return `${this.CACHE_CONFIG.PREFIX_APY}${userId}:${debankPositionId}:${dateStr}`;
  }

  /**
   * Generate cache key for portfolio performance
   */
  static generatePortfolioCacheKey(userId, targetDate) {
    const dateStr = targetDate.toISOString().split('T')[0];
    return `${this.CACHE_CONFIG.PREFIX_PORTFOLIO}${userId}:${dateStr}`;
  }

  /**
   * Calculate portfolio performance for different time periods
   * Uses DailySnapshot data for portfolio-level calculations
   */
  static async calculatePortfolioPerformance(userId, targetDate = new Date()) {
    // Check cache first
    const cacheKey = this.generatePortfolioCacheKey(userId, targetDate);
    const cached = await this.getFromCache(cacheKey);
    
    if (cached) {
      console.log(`Portfolio performance cache hit for user ${userId}`);
      return cached;
    }

    const results = {
      daily: null,
      weekly: null,
      monthly: null,
      sixMonth: null,
      allTime: null
    };

    try {
      // Get current portfolio snapshot
      const currentSnapshot = await DailySnapshot.findOne({
        userId,
        date: { $lte: targetDate }
      }).sort({ date: -1 });

      if (!currentSnapshot) {
        // Cache empty results for short time to prevent repeated queries
        await this.setInCache(cacheKey, results, 300); // 5 minutes
        return results;
      }

      const currentValue = currentSnapshot.totalNav || 0;

      // Calculate performance for different time periods
      const periods = [
        { name: 'daily', days: 1 },
        { name: 'weekly', days: 7 },
        { name: 'monthly', days: 30 },
        { name: 'sixMonth', days: 180 }
      ];

      for (const period of periods) {
        const historicalDate = new Date(targetDate);
        historicalDate.setDate(historicalDate.getDate() - period.days);

        const historicalSnapshot = await DailySnapshot.findOne({
          userId,
          date: { $gte: historicalDate, $lt: targetDate }
        }).sort({ date: 1 });

        if (historicalSnapshot && historicalSnapshot.totalNav > 0) {
          const historicalValue = historicalSnapshot.totalNav;
          const periodReturn = ((currentValue / historicalValue) - 1) * 100;
          
          results[period.name] = {
            performance: periodReturn,
            currentValue,
            historicalValue,
            days: period.days,
            periodStart: historicalSnapshot.date
          };
        }
      }

      // Calculate all-time performance from first available snapshot
      const firstSnapshot = await DailySnapshot.findOne({ userId }).sort({ date: 1 });
      
      if (firstSnapshot && firstSnapshot.totalNav > 0) {
        const daysHeld = Math.max(1, (targetDate - firstSnapshot.date) / (1000 * 60 * 60 * 24));
        const totalReturn = ((currentValue / firstSnapshot.totalNav) - 1) * 100;
        
        results.allTime = {
          performance: totalReturn,
          currentValue,
          historicalValue: firstSnapshot.totalNav,
          days: Math.ceil(daysHeld),
          periodStart: firstSnapshot.date
        };
      }

      // Cache successful results
      await this.setInCache(cacheKey, results, this.CACHE_CONFIG.PORTFOLIO_PERFORMANCE_TTL);
      console.log(`Portfolio performance calculated and cached for user ${userId}`);
      
      return results;
    } catch (error) {
      console.error('Error calculating portfolio performance:', error);
      // Cache error results for short time to prevent repeated failures
      await this.setInCache(cacheKey, results, 60); // 1 minute
      return results;
    }
  }

  /**
   * Calculate APY for a specific position with comprehensive validation and outlier detection
   */
  static async calculatePositionAPY(userId, debankPositionId, targetDate = new Date()) {
    try {
      // Pre-validation: Check input parameters
      const validationResult = this.validateInputParameters(userId, debankPositionId, targetDate);
      if (!validationResult.isValid) {
        return this.createValidationErrorResult(validationResult.errors);
      }

      // Check cache first
      const cacheKey = this.generateAPYCacheKey(userId, debankPositionId, targetDate);
      const cached = await this.getFromCache(cacheKey);
      
      if (cached) {
        console.log(`APY cache hit for position ${debankPositionId}`);
        return cached;
      }

      // Get raw APY calculation
      const rawResult = await PositionHistory.calculatePositionAPY(userId, debankPositionId, targetDate);
      
      // Post-validation: Apply outlier detection and data quality checks
      const validatedResult = await this.validateAndEnhanceAPYResult(rawResult, userId, debankPositionId, targetDate);
      
      // Cache the validated result
      const ttl = this.determineCacheTTL(validatedResult);
      await this.setInCache(cacheKey, validatedResult, ttl);
      console.log(`APY calculated and cached for position ${debankPositionId} (TTL: ${ttl}s)`);
      
      return validatedResult;
    } catch (error) {
      console.error('Error in calculatePositionAPY:', error);
      const errorResult = this.createSystemErrorResult(error.message);
      
      // Cache error results for short time to prevent repeated failures
      const cacheKey = this.generateAPYCacheKey(userId, debankPositionId, targetDate);
      await this.setInCache(cacheKey, errorResult, 60); // 1 minute
      
      return errorResult;
    }
  }

  /**
   * Determine cache TTL based on data quality and confidence
   */
  static determineCacheTTL(apyResult) {
    if (!apyResult || !apyResult._qualityMetrics) {
      return 300; // 5 minutes for low quality data
    }

    const qualityMetrics = apyResult._qualityMetrics;
    const overallConfidence = qualityMetrics.overallConfidence;
    const dataCompleteness = qualityMetrics.dataCompleteness;

    // High quality data can be cached longer
    if (overallConfidence === 'high' && dataCompleteness >= 80) {
      return this.CACHE_CONFIG.APY_CALCULATION_TTL; // 1 hour
    } else if (overallConfidence === 'medium' && dataCompleteness >= 60) {
      return this.CACHE_CONFIG.APY_CALCULATION_TTL / 2; // 30 minutes
    } else {
      return this.CACHE_CONFIG.APY_CALCULATION_TTL / 4; // 15 minutes
    }
  }

  /**
   * Validate input parameters for APY calculation
   */
  static validateInputParameters(userId, debankPositionId, targetDate) {
    const errors = [];

    // Validate userId
    if (!userId) {
      errors.push('User ID is required');
    } else if (typeof userId !== 'string' && typeof userId !== 'object') {
      errors.push('User ID must be a valid string or ObjectId');
    }

    // Validate debankPositionId
    if (!debankPositionId) {
      errors.push('Debank Position ID is required');
    } else if (typeof debankPositionId !== 'string') {
      errors.push('Debank Position ID must be a string');
    } else if (debankPositionId.length < 3) {
      errors.push('Debank Position ID is too short');
    }

    // Validate targetDate
    if (!targetDate) {
      errors.push('Target date is required');
    } else if (!(targetDate instanceof Date)) {
      errors.push('Target date must be a valid Date object');
    } else if (isNaN(targetDate.getTime())) {
      errors.push('Target date is invalid');
    } else {
      // Check if target date is too far in the future
      const now = new Date();
      const daysDiff = (targetDate - now) / (1000 * 60 * 60 * 24);
      if (daysDiff > 1) {
        errors.push('Target date cannot be more than 1 day in the future');
      }
      
      // Check if target date is too far in the past (more than 5 years)
      if (daysDiff < -1825) {
        errors.push('Target date cannot be more than 5 years in the past');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate and enhance APY calculation results with outlier detection
   */
  static async validateAndEnhanceAPYResult(rawResult, userId, debankPositionId, targetDate) {
    if (!rawResult || typeof rawResult !== 'object') {
      return this.createValidationErrorResult(['Invalid APY calculation result']);
    }

    const enhancedResult = { ...rawResult };
    
    // Apply validation to each period
    for (const [period, data] of Object.entries(rawResult)) {
      if (data && typeof data === 'object') {
        enhancedResult[period] = await this.validatePeriodAPY(data, period, userId, debankPositionId, targetDate);
      }
    }

    // Cross-period validation
    enhancedResult._qualityMetrics = await this.calculateDataQualityMetrics(enhancedResult, userId, debankPositionId);
    
    return enhancedResult;
  }

  /**
   * Validate individual period APY data
   */
  static async validatePeriodAPY(periodData, periodName, userId, debankPositionId, targetDate) {
    const validated = { ...periodData };
    
    if (!periodData.apy && periodData.apy !== 0) {
      return validated; // Skip validation for null/undefined APY
    }

    // Statistical outlier detection
    const outlierFlags = await this.detectStatisticalOutliers(periodData, periodName, userId, debankPositionId);
    
    // Historical context validation
    const historicalFlags = await this.validateAgainstHistoricalContext(periodData, periodName, userId, debankPositionId, targetDate);
    
    // Market context validation
    const marketFlags = this.validateAgainstMarketContext(periodData, periodName);
    
    // Combine all validation flags
    validated.validationFlags = {
      outliers: outlierFlags,
      historical: historicalFlags,
      market: marketFlags
    };

    // Adjust confidence based on validation flags
    validated.confidence = this.calculateAdjustedConfidence(
      validated.confidence || 'medium',
      validated.validationFlags
    );

    // Add enhanced warnings
    validated.warnings = [
      ...(validated.warnings || []),
      ...this.generateValidationWarnings(validated.validationFlags)
    ];

    return validated;
  }

  /**
   * Detect statistical outliers using multiple methods
   */
  static async detectStatisticalOutliers(periodData, periodName, userId, debankPositionId) {
    const flags = {
      isStatisticalOutlier: false,
      outlierMethods: [],
      severity: 'low'
    };

    const apy = periodData.apy;
    if (!apy && apy !== 0) return flags;

    // Method 1: Z-Score Analysis (compared to historical data)
    const historicalAPYs = await this.getHistoricalAPYs(userId, debankPositionId, periodName, 30); // Last 30 calculations
    if (historicalAPYs.length >= 3) {
      const zScore = this.calculateZScore(apy, historicalAPYs);
      if (Math.abs(zScore) > 3) {
        flags.isStatisticalOutlier = true;
        flags.outlierMethods.push('z-score');
        flags.severity = Math.abs(zScore) > 5 ? 'high' : 'medium';
      }
    }

    // Method 2: Interquartile Range (IQR) Analysis
    if (historicalAPYs.length >= 5) {
      const iqrResult = this.calculateIQROutlier(apy, historicalAPYs);
      if (iqrResult.isOutlier) {
        flags.isStatisticalOutlier = true;
        flags.outlierMethods.push('iqr');
        flags.severity = Math.max(flags.severity === 'high' ? 3 : flags.severity === 'medium' ? 2 : 1, 
                                 iqrResult.severity === 'high' ? 3 : 2) === 3 ? 'high' : 'medium';
      }
    }

    // Method 3: Percentage Change Analysis
    if (periodData.historicalValue && periodData.positionValue) {
      const percentChange = Math.abs((periodData.positionValue / periodData.historicalValue) - 1) * 100;
      if (percentChange > 50) { // More than 50% change
        flags.isStatisticalOutlier = true;
        flags.outlierMethods.push('percentage-change');
        flags.severity = percentChange > 100 ? 'high' : 'medium';
      }
    }

    // Method 4: Time-based Volatility Analysis
    if (periodData.days < 7 && Math.abs(apy) > 500) {
      flags.isStatisticalOutlier = true;
      flags.outlierMethods.push('short-term-volatility');
      flags.severity = 'high';
    }

    return flags;
  }

  /**
   * Validate against historical context for the same position
   */
  static async validateAgainstHistoricalContext(periodData, periodName, userId, debankPositionId, targetDate) {
    const flags = {
      hasHistoricalData: false,
      isHistoricalAnomaly: false,
      historicalDeviation: 0,
      trendAnalysis: null
    };

    // Get last 10 APY calculations for trend analysis
    const recentAPYs = await this.getHistoricalAPYs(userId, debankPositionId, periodName, 10);
    
    if (recentAPYs.length >= 2) {
      flags.hasHistoricalData = true;
      
      // Calculate historical average and deviation
      const avgAPY = recentAPYs.reduce((sum, apy) => sum + apy, 0) / recentAPYs.length;
      const deviation = Math.abs(periodData.apy - avgAPY);
      const relativeDeviation = avgAPY !== 0 ? (deviation / Math.abs(avgAPY)) * 100 : 100;
      
      flags.historicalDeviation = relativeDeviation;
      
      // Flag as anomaly if deviation is > 200%
      if (relativeDeviation > 200) {
        flags.isHistoricalAnomaly = true;
      }

      // Trend analysis
      if (recentAPYs.length >= 3) {
        flags.trendAnalysis = this.analyzeTrend(recentAPYs);
      }
    }

    return flags;
  }

  /**
   * Validate against market context and expected ranges
   */
  static validateAgainstMarketContext(periodData, periodName) {
    const flags = {
      isMarketOutlier: false,
      marketContext: null,
      expectedRange: null
    };

    const apy = periodData.apy;
    if (!apy && apy !== 0) return flags;

    // Define expected APY ranges for different market contexts
    const marketRanges = {
      'stable_defi': { min: 0, max: 50, description: 'Stable DeFi protocols' },
      'lending': { min: 0, max: 25, description: 'Lending protocols' },
      'liquidity_provision': { min: -20, max: 200, description: 'Liquidity provision' },
      'yield_farming': { min: -50, max: 1000, description: 'Yield farming' },
      'extreme_risk': { min: -100, max: 10000, description: 'Extreme risk protocols' }
    };

    // Determine market context based on APY magnitude
    let marketContext = 'stable_defi';
    if (Math.abs(apy) > 1000) {
      marketContext = 'extreme_risk';
    } else if (Math.abs(apy) > 200) {
      marketContext = 'yield_farming';
    } else if (Math.abs(apy) > 50) {
      marketContext = 'liquidity_provision';
    } else if (Math.abs(apy) > 25) {
      marketContext = 'lending';
    }

    const range = marketRanges[marketContext];
    flags.marketContext = marketContext;
    flags.expectedRange = range;

    // Check if APY is outside expected range for the context
    if (apy < range.min || apy > range.max) {
      flags.isMarketOutlier = true;
    }

    return flags;
  }

  /**
   * Calculate adjusted confidence based on validation flags
   */
  static calculateAdjustedConfidence(originalConfidence, validationFlags) {
    let confidenceScore = originalConfidence === 'high' ? 3 : originalConfidence === 'medium' ? 2 : 1;

    // Reduce confidence for outliers
    if (validationFlags.outliers?.isStatisticalOutlier) {
      confidenceScore -= validationFlags.outliers.severity === 'high' ? 2 : 1;
    }

    // Reduce confidence for historical anomalies
    if (validationFlags.historical?.isHistoricalAnomaly) {
      confidenceScore -= 1;
    }

    // Reduce confidence for market outliers
    if (validationFlags.market?.isMarketOutlier) {
      confidenceScore -= 1;
    }

    // Ensure minimum confidence
    confidenceScore = Math.max(1, confidenceScore);

    return confidenceScore === 3 ? 'high' : confidenceScore === 2 ? 'medium' : 'low';
  }

  /**
   * Generate validation warnings based on flags
   */
  static generateValidationWarnings(validationFlags) {
    const warnings = [];

    if (validationFlags.outliers?.isStatisticalOutlier) {
      const methods = validationFlags.outliers.outlierMethods.join(', ');
      warnings.push(`Statistical outlier detected (${methods}) - verify data accuracy`);
    }

    if (validationFlags.historical?.isHistoricalAnomaly) {
      const deviation = validationFlags.historical.historicalDeviation.toFixed(1);
      warnings.push(`${deviation}% deviation from historical average - unusual performance`);
    }

    if (validationFlags.market?.isMarketOutlier) {
      const context = validationFlags.market.expectedRange.description;
      warnings.push(`APY outside expected range for ${context} - verify protocol type`);
    }

    if (validationFlags.historical?.trendAnalysis?.isVolatile) {
      warnings.push('High volatility detected in recent APY calculations');
    }

    return warnings;
  }

  /**
   * Calculate data quality metrics for the entire result set
   */
  static async calculateDataQualityMetrics(result, userId, debankPositionId) {
    const metrics = {
      overallConfidence: 'medium',
      dataCompleteness: 0,
      consistencyScore: 0,
      reliabilityScore: 0,
      lastDataUpdate: null
    };

    // Calculate data completeness
    const periods = ['daily', 'weekly', 'monthly', 'sixMonth', 'allTime'];
    const availablePeriods = periods.filter(period => result[period] && result[period].apy !== null);
    metrics.dataCompleteness = (availablePeriods.length / periods.length) * 100;

    // Calculate consistency score (how similar are the confidence levels)
    const confidenceLevels = availablePeriods.map(period => result[period].confidence);
    const highConfidence = confidenceLevels.filter(c => c === 'high').length;
    metrics.consistencyScore = (highConfidence / confidenceLevels.length) * 100;

    // Calculate overall confidence
    const avgConfidenceScore = confidenceLevels.reduce((sum, conf) => {
      return sum + (conf === 'high' ? 3 : conf === 'medium' ? 2 : 1);
    }, 0) / confidenceLevels.length;

    metrics.overallConfidence = avgConfidenceScore >= 2.5 ? 'high' : avgConfidenceScore >= 1.5 ? 'medium' : 'low';

    // Get last data update
    try {
      const lastPosition = await PositionHistory.findOne({
        userId,
        debankPositionId,
        isActive: true
      }).sort({ date: -1 });
      
      if (lastPosition) {
        metrics.lastDataUpdate = lastPosition.date;
      }
    } catch (error) {
      console.error('Error getting last data update:', error);
    }

    return metrics;
  }

  /**
   * Calculate APY for all positions of a user with intelligent caching
   */
  static async calculateAllPositionAPYs(userId, targetDate = new Date()) {
    try {
      // Check if we have a cached summary for all positions
      const summaryCacheKey = `${this.CACHE_CONFIG.PREFIX_SUMMARY}${userId}:${targetDate.toISOString().split('T')[0]}`;
      const cachedSummary = await this.getFromCache(summaryCacheKey);
      
      if (cachedSummary) {
        console.log(`All positions APY cache hit for user ${userId}`);
        return cachedSummary;
      }

      // Get all active positions for the user using Debank position IDs
      const activePositions = await PositionHistory.distinct('debankPositionId', {
        userId,
        date: { $lte: targetDate },
        isActive: true
      });

      const apyResults = {};
      const cacheHits = [];
      const cacheMisses = [];

      // Calculate APY for each position (leveraging individual position caching)
      for (const debankPositionId of activePositions) {
        const cacheKey = this.generateAPYCacheKey(userId, debankPositionId, targetDate);
        const cached = await this.getFromCache(cacheKey);
        
        if (cached) {
          apyResults[debankPositionId] = cached;
          cacheHits.push(debankPositionId);
        } else {
          apyResults[debankPositionId] = await this.calculatePositionAPY(userId, debankPositionId, targetDate);
          cacheMisses.push(debankPositionId);
        }
      }

      console.log(`APY calculation summary for user ${userId}: ${cacheHits.length} cache hits, ${cacheMisses.length} cache misses`);

      // Cache the complete summary
      await this.setInCache(summaryCacheKey, apyResults, this.CACHE_CONFIG.POSITION_SUMMARY_TTL);

      return apyResults;
    } catch (error) {
      console.error('Error calculating all position APYs:', error);
      return {};
    }
  }

  /**
   * Warm cache for critical positions (can be called during off-peak hours)
   */
  static async warmCache(userId, targetDate = new Date()) {
    try {
      console.log(`Starting cache warming for user ${userId}`);
      
      // Get all active positions
      const activePositions = await PositionHistory.distinct('debankPositionId', {
        userId,
        date: { $lte: targetDate },
        isActive: true
      });

      // Calculate APY for positions not in cache
      const warmingTasks = activePositions.map(async (debankPositionId) => {
        const cacheKey = this.generateAPYCacheKey(userId, debankPositionId, targetDate);
        const cached = await this.getFromCache(cacheKey);
        
        if (!cached) {
          await this.calculatePositionAPY(userId, debankPositionId, targetDate);
        }
      });

      await Promise.all(warmingTasks);
      console.log(`Cache warming completed for user ${userId}: ${activePositions.length} positions`);
      
    } catch (error) {
      console.error('Error warming cache:', error);
    }
  }

  /**
   * Invalidate all cached data for a user (call when new position data arrives)
   */
  static async invalidateUserCache(userId) {
    try {
      const patterns = [
        `${this.CACHE_CONFIG.PREFIX_APY}${userId}:*`,
        `${this.CACHE_CONFIG.PREFIX_PORTFOLIO}${userId}:*`,
        `${this.CACHE_CONFIG.PREFIX_SUMMARY}${userId}:*`
      ];

      for (const pattern of patterns) {
        await this.invalidateCache(pattern);
      }

      console.log(`Cache invalidated for user ${userId}`);
    } catch (error) {
      console.error('Error invalidating user cache:', error);
    }
  }

  /**
   * Invalidate cache for a specific position (call when position data changes)
   */
  static async invalidatePositionCache(userId, debankPositionId) {
    try {
      const pattern = `${this.CACHE_CONFIG.PREFIX_APY}${userId}:${debankPositionId}:*`;
      await this.invalidateCache(pattern);
      
      // Also invalidate summary cache since it includes this position
      const summaryPattern = `${this.CACHE_CONFIG.PREFIX_SUMMARY}${userId}:*`;
      await this.invalidateCache(summaryPattern);

      console.log(`Cache invalidated for position ${debankPositionId}`);
    } catch (error) {
      console.error('Error invalidating position cache:', error);
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  static async getCacheStats() {
    try {
      const stats = {
        cacheType: redisClient && redisClient.connected ? 'redis' : 'memory',
        memorySize: memoryCache.size,
        redisConnected: redisClient ? redisClient.connected : false
      };

      if (redisClient && redisClient.connected) {
        // Get Redis stats
        const info = await redisClient.info('memory');
        stats.redisMemoryUsage = info;
      }

      return stats;
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return { error: error.message };
    }
  }

  /**
   * Store position data for historical tracking using Debank position IDs
   */
  static async storePositionData(userId, walletAddress, protocolName, positionData) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Normalize to start of day
      const affectedPositions = [];

      for (const position of positionData) {
        // Use Debank position ID if available, otherwise generate one
        const debankPositionId = position.position_id || 
          `${protocolName}_${position.position_name}_${walletAddress}_${Date.now()}`.toLowerCase().replace(/\s+/g, '_');
        
        affectedPositions.push(debankPositionId);
        
        // Calculate unclaimed rewards value
        const unclaimedRewardsValue = (position.rewards || [])
          .reduce((sum, reward) => sum + (reward.usd_value || 0), 0);

        // Calculate total position value
        const totalValue = this.calculatePositionValue(position);

        // Store today's position data using new schema
        const positionHistory = new PositionHistory({
          userId,
          walletAddress,
          protocolName,
          positionName: position.position_name || 'Unknown Position',
          debankPositionId,
          date: today,
          totalValue,
          unclaimedRewardsValue,
          tokens: position.tokens || [],
          rewards: position.rewards || [],
          isActive: true,
          protocolData: {
            originalData: position
          }
        });

        await positionHistory.save();
      }

      // Invalidate cache for affected positions since new data arrived
      for (const debankPositionId of affectedPositions) {
        await this.invalidatePositionCache(userId, debankPositionId);
      }

      // Also invalidate user-level caches
      await this.invalidateUserCache(userId);
      
      console.log(`Stored position data and invalidated cache for ${affectedPositions.length} positions`);
      
    } catch (error) {
      console.error('Error storing position data:', error);
      throw error;
    }
  }

  /**
   * Initialize periodic cache cleanup (call once at app startup)
   */
  static initializeCacheCleanup() {
    // Setup periodic memory cache cleanup
    setInterval(() => {
      if (!redisClient || !redisClient.connected) {
        this.cleanupMemoryCache();
        console.log(`Memory cache cleanup completed. Current size: ${memoryCache.size}`);
      }
    }, this.CACHE_CONFIG.MEMORY_CACHE_CLEANUP_INTERVAL);

    console.log('Cache cleanup interval initialized');
  }

  /**
   * Mark positions as inactive if they no longer exist
   */
  static async markInactivePositions(userId, activeDebankPositionIds) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Find positions that were active yesterday but not today
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      await PositionHistory.updateMany({
        userId,
        date: { $gte: yesterday },
        debankPositionId: { $nin: activeDebankPositionIds },
        isActive: true
      }, {
        isActive: false
      });
    } catch (error) {
      console.error('Error marking inactive positions:', error);
    }
  }

  /**
   * Calculate total USD value of a position
   */
  static calculatePositionValue(position) {
    let totalValue = 0;

    // Add token values
    if (position.tokens) {
      totalValue += position.tokens.reduce((sum, token) => sum + (token.usd_value || 0), 0);
    }

    // Add reward values
    if (position.rewards) {
      totalValue += position.rewards.reduce((sum, reward) => sum + (reward.usd_value || 0), 0);
    }

    return totalValue;
  }

  /**
   * Get position performance summary with APY data
   */
  static async getPositionPerformanceSummary(userId, targetDate = new Date()) {
    try {
      const apyData = await this.calculateAllPositionAPYs(userId, targetDate);
      const positionSummaries = {};

      // Get latest position data for each active position
      for (const debankPositionId of Object.keys(apyData)) {
        const latestPosition = await PositionHistory.findOne({
          userId,
          debankPositionId,
          date: { $lte: targetDate },
          isActive: true
        }).sort({ date: -1 });

        if (latestPosition) {
          positionSummaries[debankPositionId] = {
            protocolName: latestPosition.protocolName,
            positionName: latestPosition.positionName,
            walletAddress: latestPosition.walletAddress,
            currentValue: latestPosition.totalValue,
            unclaimedRewardsValue: latestPosition.unclaimedRewardsValue,
            apy: apyData[debankPositionId],
            lastUpdated: latestPosition.date,
            debankPositionId: latestPosition.debankPositionId
          };
        }
      }

      return positionSummaries;
    } catch (error) {
      console.error('Error getting position performance summary:', error);
      return {};
    }
  }

  /**
   * Helper method to get historical APY values for statistical analysis
   */
  static async getHistoricalAPYs(userId, debankPositionId, periodName, limit = 30) {
    try {
      // This would be implemented by storing calculated APY values in a separate collection
      // For now, return empty array to avoid breaking the system
      // TODO: Implement APY history tracking
      console.log(`TODO: Get historical APYs for ${debankPositionId}, period: ${periodName}, limit: ${limit}, user: ${userId}`);
      return [];
    } catch (error) {
      console.error('Error getting historical APYs:', error);
      return [];
    }
  }

  /**
   * Calculate Z-Score for outlier detection
   */
  static calculateZScore(value, historicalValues) {
    if (historicalValues.length < 2) return 0;
    
    const mean = historicalValues.reduce((sum, val) => sum + val, 0) / historicalValues.length;
    const variance = historicalValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / historicalValues.length;
    const standardDeviation = Math.sqrt(variance);
    
    if (standardDeviation === 0) return 0;
    
    return (value - mean) / standardDeviation;
  }

  /**
   * Calculate IQR outlier detection
   */
  static calculateIQROutlier(value, historicalValues) {
    if (historicalValues.length < 4) return { isOutlier: false, severity: 'low' };
    
    const sorted = [...historicalValues].sort((a, b) => a - b);
    const q1Index = Math.floor(sorted.length * 0.25);
    const q3Index = Math.floor(sorted.length * 0.75);
    
    const q1 = sorted[q1Index];
    const q3 = sorted[q3Index];
    const iqr = q3 - q1;
    
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    const extremeLowerBound = q1 - 3 * iqr;
    const extremeUpperBound = q3 + 3 * iqr;
    
    if (value < extremeLowerBound || value > extremeUpperBound) {
      return { isOutlier: true, severity: 'high' };
    } else if (value < lowerBound || value > upperBound) {
      return { isOutlier: true, severity: 'medium' };
    }
    
    return { isOutlier: false, severity: 'low' };
  }

  /**
   * Analyze trend in historical data
   */
  static analyzeTrend(values) {
    if (values.length < 3) return { isVolatile: false, trend: 'insufficient_data' };
    
    // Calculate volatility (coefficient of variation)
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const standardDeviation = Math.sqrt(variance);
    const coefficientOfVariation = mean !== 0 ? (standardDeviation / Math.abs(mean)) * 100 : 100;
    
    // Calculate trend direction
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    const firstHalfAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
    
    let trend = 'stable';
    if (secondHalfAvg > firstHalfAvg * 1.1) {
      trend = 'increasing';
    } else if (secondHalfAvg < firstHalfAvg * 0.9) {
      trend = 'decreasing';
    }
    
    return {
      isVolatile: coefficientOfVariation > 50, // More than 50% CV is considered volatile
      trend,
      volatility: coefficientOfVariation,
      direction: secondHalfAvg > firstHalfAvg ? 'up' : 'down'
    };
  }

  /**
   * Create validation error result
   */
  static createValidationErrorResult(errors) {
    return {
      daily: {
        apy: null,
        periodReturn: null,
        days: 0,
        isNewPosition: false,
        confidence: 'low',
        warnings: errors,
        calculationMethod: 'validation_error',
        validationFlags: {
          outliers: { isStatisticalOutlier: false, outlierMethods: [], severity: 'low' },
          historical: { hasHistoricalData: false, isHistoricalAnomaly: false, historicalDeviation: 0 },
          market: { isMarketOutlier: false, marketContext: null, expectedRange: null }
        }
      },
      weekly: null,
      monthly: null,
      sixMonth: null,
      allTime: null,
      _qualityMetrics: {
        overallConfidence: 'low',
        dataCompleteness: 0,
        consistencyScore: 0,
        reliabilityScore: 0,
        lastDataUpdate: null
      }
    };
  }

  /**
   * Create system error result
   */
  static createSystemErrorResult(errorMessage) {
    return {
      daily: {
        apy: null,
        periodReturn: null,
        days: 0,
        isNewPosition: false,
        confidence: 'low',
        warnings: [`System error: ${errorMessage}`],
        calculationMethod: 'system_error',
        validationFlags: {
          outliers: { isStatisticalOutlier: false, outlierMethods: [], severity: 'low' },
          historical: { hasHistoricalData: false, isHistoricalAnomaly: false, historicalDeviation: 0 },
          market: { isMarketOutlier: false, marketContext: null, expectedRange: null }
        }
      },
      weekly: null,
      monthly: null,
      sixMonth: null,
      allTime: null,
      _qualityMetrics: {
        overallConfidence: 'low',
        dataCompleteness: 0,
        consistencyScore: 0,
        reliabilityScore: 0,
        lastDataUpdate: null
      }
    };
  }

  /**
   * Utility method to format APY data for frontend display
   */
  static formatAPYForDisplay(apyData) {
    const formatted = {};

    Object.entries(apyData).forEach(([period, data]) => {
      if (data && data.apy !== null && data.apy !== undefined) {
        formatted[period] = {
          apy: `${data.apy >= 0 ? '+' : ''}${data.apy.toFixed(2)}%`,
          periodReturn: `${data.periodReturn >= 0 ? '+' : ''}${data.periodReturn.toFixed(2)}%`,
          days: data.days,
          isPositive: data.apy >= 0,
          rawAPY: data.apy,
          rawPeriodReturn: data.periodReturn,
          isNewPosition: data.isNewPosition || false,
          confidence: data.confidence || 'medium',
          warnings: data.warnings || [],
          calculationMethod: data.calculationMethod || 'standard',
          positionValue: data.positionValue || null,
          rewardsValue: data.rewardsValue || null,
          rawDailyReturn: data.rawDailyReturn || null
        };
      } else {
        formatted[period] = {
          apy: 'No data',
          periodReturn: 'No data',
          days: 0,
          isPositive: null,
          rawAPY: null,
          rawPeriodReturn: null,
          isNewPosition: false
        };
      }
    });

    return formatted;
  }
}

module.exports = APYCalculationService;