const compression = require('compression');
const NodeCache = require('node-cache');

// Response compression middleware
const responseCompression = compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6, // Compression level (1-9, 6 is good balance)
  threshold: 1024, // Only compress responses larger than 1KB
});

// Create cache instances
const shortCache = new NodeCache({ 
  stdTTL: 300, // 5 minutes
  checkperiod: 60, // Check for expired keys every 60 seconds
  useClones: false // Better performance
});

const mediumCache = new NodeCache({ 
  stdTTL: 1800, // 30 minutes
  checkperiod: 300,
  useClones: false
});

const longCache = new NodeCache({ 
  stdTTL: 3600, // 1 hour
  checkperiod: 600,
  useClones: false
});

// Cache middleware factory
const createCacheMiddleware = (cache, keyGenerator) => {
  return (req, res, next) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const key = keyGenerator ? keyGenerator(req) : `${req.originalUrl}`;
    const cachedResponse = cache.get(key);

    if (cachedResponse) {
      console.log(`🚀 CACHE HIT: ${key}`);
      if (!res.headersSent) {
        res.set('X-Cache', 'HIT');
      }
      return res.json(cachedResponse);
    }

    // Store original res.json
    const originalJson = res.json;
    
    // Override res.json to cache the response
    res.json = function(data) {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cache.set(key, data);
        console.log(`💾 CACHED: ${key}`);
      }
      
      if (!res.headersSent) {
        res.set('X-Cache', 'MISS');
      }
      return originalJson.call(this, data);
    };

    next();
  };
};

// Specific cache middleware for different endpoints
const walletDataCache = createCacheMiddleware(
  shortCache, 
  (req) => `wallet:${req.user?.userId}:${req.params.address || req.query.address}`
);

const analyticsCache = createCacheMiddleware(
  mediumCache,
  (req) => `analytics:${req.user?.userId}:${JSON.stringify(req.query)}`
);

const publicDataCache = createCacheMiddleware(
  longCache,
  (req) => `public:${req.originalUrl}`
);

// Performance monitoring middleware
const performanceMonitor = (req, res, next) => {
  const startTime = process.hrtime.bigint();
  const startMemory = process.memoryUsage();

  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const endMemory = process.memoryUsage();
    
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    const memoryDelta = {
      rss: endMemory.rss - startMemory.rss,
      heapUsed: endMemory.heapUsed - startMemory.heapUsed,
      heapTotal: endMemory.heapTotal - startMemory.heapTotal,
      external: endMemory.external - startMemory.external
    };

    // Log slow requests (>1000ms)
    if (duration > 1000) {
      console.warn(`🐌 SLOW REQUEST: ${req.method} ${req.originalUrl} - ${duration.toFixed(2)}ms`, {
        memoryDelta,
        userAgent: req.get('user-agent'),
        ip: req.ip
      });
    }

    // Log memory-intensive requests
    if (memoryDelta.heapUsed > 10 * 1024 * 1024) { // 10MB
      console.warn(`🧠 HIGH MEMORY: ${req.method} ${req.originalUrl} - ${(memoryDelta.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    }

    // Add performance headers (only if headers haven't been sent)
    if (!res.headersSent) {
      res.set('X-Response-Time', `${duration.toFixed(2)}ms`);
      res.set('X-Memory-Used', `${(memoryDelta.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    }
  });

  next();
};

// Cache invalidation helpers
const invalidateCache = {
  wallet: (userId, address) => {
    const patterns = [
      `wallet:${userId}:${address}`,
      `wallet:${userId}:*`,
      `analytics:${userId}:*`
    ];
    
    patterns.forEach(pattern => {
      if (pattern.includes('*')) {
        // Get all keys and filter by pattern
        const keys = shortCache.keys().concat(mediumCache.keys());
        const regex = new RegExp(pattern.replace('*', '.*'));
        keys.filter(key => regex.test(key)).forEach(key => {
          shortCache.del(key);
          mediumCache.del(key);
        });
      } else {
        shortCache.del(pattern);
        mediumCache.del(pattern);
      }
    });
    
    console.log(`🗑️  CACHE INVALIDATED: wallet data for user ${userId}`);
  },

  user: (userId) => {
    const keys = shortCache.keys().concat(mediumCache.keys()).concat(longCache.keys());
    const userKeys = keys.filter(key => key.includes(`${userId}:`));
    
    userKeys.forEach(key => {
      shortCache.del(key);
      mediumCache.del(key);
      longCache.del(key);
    });
    
    console.log(`🗑️  CACHE INVALIDATED: all data for user ${userId}`);
  },

  all: () => {
    shortCache.flushAll();
    mediumCache.flushAll();
    longCache.flushAll();
    console.log(`🗑️  CACHE INVALIDATED: all caches cleared`);
  }
};

// Health check for cache
const getCacheStats = () => {
  return {
    short: {
      keys: shortCache.keys().length,
      stats: shortCache.getStats()
    },
    medium: {
      keys: mediumCache.keys().length,
      stats: mediumCache.getStats()
    },
    long: {
      keys: longCache.keys().length,
      stats: longCache.getStats()
    }
  };
};

module.exports = {
  responseCompression,
  walletDataCache,
  analyticsCache,
  publicDataCache,
  performanceMonitor,
  invalidateCache,
  getCacheStats,
  shortCache,
  mediumCache,
  longCache
};
