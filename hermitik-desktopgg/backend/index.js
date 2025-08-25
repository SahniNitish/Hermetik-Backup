// backend/index.js - PRODUCTION SECURED VERSION
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
require('./crons/snapshotJob');  // This runs the cron job

// Load environment variables first
dotenv.config();

// Import security and performance middleware
const { 
  securityHeaders, 
  generalLimiter, 
  speedLimiter, 
  sanitizeBody,
  securityLogger 
} = require('./middleware/security');

const { 
  responseCompression, 
  performanceMonitor 
} = require('./middleware/performance');

const { requestLogger } = require('./utils/logger');

const app = express();

// Apply security headers FIRST
app.use(securityHeaders);

// Performance monitoring
app.use(performanceMonitor);

// Request logging
app.use(requestLogger);

// Response compression
app.use(responseCompression);

// Disable rate limiting for development
// app.use(generalLimiter);
// app.use(speedLimiter);

// Security logging
app.use(securityLogger);

// CORS configuration - simplified for development
app.use(cors({
  origin: true, // Allow all origins in development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['X-Cache', 'X-Response-Time', 'X-Memory-Used'],
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
}));

// Body parsing with size limits
app.use(express.json({ 
  limit: '10mb',
  strict: true
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb' 
}));

// Sanitize request bodies to prevent NoSQL injection
app.use(sanitizeBody);

// Import error handling middleware
const { globalErrorHandler } = require('./middleware/errorHandler');
const ApiResponse = require('./utils/responseFormatter');

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI).then(() => {
  console.log('Connected to MongoDB');
}).catch(err => {
  console.error('MongoDB connection failed:', err.message);
});

// Your existing routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/wallet', require('./routes/wallet'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/nav', require('./routes/nav'));

// Global variable to track if data collection is running
let dataCollectionRunning = false;

// Add admin route for manual collection with protection against multiple calls
app.post('/api/admin/collect-data', async (req, res) => {
  try {
    // Check if data collection is already running
    if (dataCollectionRunning) {
      return res.status(429).json(ApiResponse.error(
        'Snapshot collection is already running. Please wait for it to complete.',
        429,
        { status: 'already_running' }
      ));
    }

    // Set the flag to prevent concurrent runs
    dataCollectionRunning = true;
    
    console.log('🚀 Manual data collection triggered');
    
    // Import the service (lazy loading to avoid circular dependencies)
    const DailyDataCollectionService = require('./services/dailyDataCollection');
    
    // Run data collection in background and respond immediately
    const results = await DailyDataCollectionService.runDailyCollection();
    
    res.json(ApiResponse.success(
      {
        results,
        summary: {
          total: results.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length
        }
      },
      'Snapshots collected successfully for all users'
    ));
    
  } catch (error) {
    console.error('❌ Error in manual data collection:', error);
    res.status(500).json(ApiResponse.error(
      `Snapshot collection failed: ${error.message}`,
      500,
      { status: 'error' }
    ));
  } finally {
    // Always reset the flag when done
    dataCollectionRunning = false;
  }
});

// Add a status endpoint to check if data collection is running
app.get('/api/admin/collect-data/status', (req, res) => {
  res.json(ApiResponse.success(
    { 
      running: dataCollectionRunning,
      status: dataCollectionRunning ? 'running' : 'idle'
    },
    'Snapshot status retrieved successfully'
  ));
});

// Add a comprehensive health check endpoint
app.get('/api/health', (req, res) => {
  const { getCacheStats } = require('./middleware/performance');
  const uptime = process.uptime();
  const memory = process.memoryUsage();
  
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`,
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    dataCollection: dataCollectionRunning ? 'running' : 'idle',
    memory: {
      rss: `${Math.round(memory.rss / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memory.heapTotal / 1024 / 1024)}MB`,
      external: `${Math.round(memory.external / 1024 / 1024)}MB`
    },
    cache: getCacheStats(),
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Add cache management endpoints for admins
app.get('/api/admin/cache/stats', (req, res) => {
  const { getCacheStats } = require('./middleware/performance');
  res.json(ApiResponse.success(getCacheStats(), 'Cache statistics retrieved'));
});

app.post('/api/admin/cache/clear', (req, res) => {
  const { invalidateCache } = require('./middleware/performance');
  const { type, userId } = req.body;
  
  try {
    if (type === 'all') {
      invalidateCache.all();
    } else if (type === 'user' && userId) {
      invalidateCache.user(userId);
    } else {
      return res.status(400).json(ApiResponse.error('Invalid cache clear request'));
    }
    
    res.json(ApiResponse.success({}, 'Cache cleared successfully'));
  } catch (error) {
    res.status(500).json(ApiResponse.error('Failed to clear cache'));
  }
});

// Global error handler (must be last middleware)
app.use(globalErrorHandler);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check available at http://localhost:${PORT}/api/health`);
});