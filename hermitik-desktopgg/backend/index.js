// backend/index.js - FIXED VERSION
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
require('./crons/snapshotJob');  // This runs the cron job


dotenv.config();
const app = express();

// Add CORS middleware BEFORE routes
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176', 'http://localhost:4173'], // Frontend URLs (dev & preview)
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json());

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

// Global variable to track if data collection is running
let dataCollectionRunning = false;

// Add admin route for manual collection with protection against multiple calls
app.post('/api/admin/collect-data', async (req, res) => {
  try {
    // Check if data collection is already running
    if (dataCollectionRunning) {
      return res.status(429).json({ 
        error: 'Data collection is already running. Please wait for it to complete.',
        status: 'already_running'
      });
    }

    // Set the flag to prevent concurrent runs
    dataCollectionRunning = true;
    
    console.log('🚀 Manual data collection triggered');
    
    // Import the service (lazy loading to avoid circular dependencies)
    const DailyDataCollectionService = require('./services/dailyDataCollection');
    
    // Run data collection in background and respond immediately
    const results = await DailyDataCollectionService.runDailyCollection();
    
    res.json({ 
      message: 'Data collection completed', 
      results,
      summary: {
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }
    });
    
  } catch (error) {
    console.error('❌ Error in manual data collection:', error);
    res.status(500).json({ 
      error: error.message,
      status: 'error'
    });
  } finally {
    // Always reset the flag when done
    dataCollectionRunning = false;
  }
});

// Add a status endpoint to check if data collection is running
app.get('/api/admin/collect-data/status', (req, res) => {
  res.json({ 
    running: dataCollectionRunning,
    status: dataCollectionRunning ? 'running' : 'idle'
  });
});

// Add a health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    dataCollection: dataCollectionRunning ? 'running' : 'idle'
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check available at http://localhost:${PORT}/api/health`);
});