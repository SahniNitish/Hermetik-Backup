/**
 * Daily Snapshot Setup Script
 * Sets up and manages the daily snapshot collection for historical data
 */

const runDailySnapshot = require('./crons/snapshotJob');
const mongoose = require('mongoose');

async function setupDailySnapshots() {
  try {
    console.log('🚀 Setting up daily snapshot collection...');
    
    // Connect to MongoDB
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hermetik', {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
      console.log('✅ Connected to MongoDB');
    }
    
    console.log('📊 Running initial snapshot collection...');
    
    // Run the snapshot job immediately
    await runDailySnapshot();
    
    console.log('✅ Daily snapshot setup completed!');
    console.log('');
    console.log('📋 What happens next:');
    console.log('  ✅ Daily snapshots will run automatically at midnight');
    console.log('  ✅ Historical data will be available for Excel reports');
    console.log('  ✅ Use /api/analytics/export/historical for accurate historical reports');
    console.log('  ✅ Performance calculations will be based on real historical data');
    console.log('');
    console.log('🔄 To run manual snapshot:');
    console.log('  node setup-daily-snapshots.js');
    console.log('');
    console.log('📊 To test historical export:');
    console.log('  curl -H "Authorization: Bearer YOUR_TOKEN" \\');
    console.log('       "http://localhost:3001/api/analytics/export/historical?date=2025-08-26"');
    
  } catch (error) {
    console.error('❌ Error setting up daily snapshots:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  setupDailySnapshots().then(() => {
    console.log('🎉 Setup complete! Exiting...');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Setup failed:', error);
    process.exit(1);
  });
}

module.exports = setupDailySnapshots;
