const mongoose = require('mongoose');
require('dotenv').config();
const APYCalculationService = require('./services/apyCalculationService');

async function testAPYService() {
  try {
    console.log('🧪 Testing APY Service...');
    
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    
    // Test with a real user ID from our recent snapshot data
    const testUserId = '689bca849fe4bbc83dc793a2'; // One of the users from snapshot results
    console.log(`Testing APY calculation for user: ${testUserId}`);
    
    const apyResults = await APYCalculationService.calculateAllPositionAPYs(testUserId);
    
    console.log('📊 APY Results:');
    console.log('Position count:', Object.keys(apyResults).length);
    console.log('Results:', apyResults);
    
    if (Object.keys(apyResults).length > 0) {
      console.log('✅ APY Service is working!');
      
      // Test formatting
      const formatted = {};
      Object.entries(apyResults).forEach(([positionId, apyData]) => {
        formatted[positionId] = APYCalculationService.formatAPYForDisplay(apyData);
      });
      
      console.log('📊 Formatted Results:');
      console.log(JSON.stringify(formatted, null, 2));
    } else {
      console.log('⚠️ No APY results returned - checking snapshots...');
      
      const DailySnapshot = require('./models/DailySnapshot');
      const snapshots = await DailySnapshot.find({ userId: testUserId }).sort({ date: -1 }).limit(2);
      console.log(`Found ${snapshots.length} snapshots for user`);
      
      if (snapshots.length > 0) {
        console.log('Latest snapshot:', {
          date: snapshots[0].date,
          positionsCount: snapshots[0].positions?.length || 0,
          totalNavUsd: snapshots[0].totalNavUsd
        });
        
        if (snapshots[0].positions?.length > 0) {
          console.log('First position sample:', {
            protocolName: snapshots[0].positions[0].protocolName,
            supplyTokensCount: snapshots[0].positions[0].supplyTokens?.length || 0,
            rewardTokensCount: snapshots[0].positions[0].rewardTokens?.length || 0,
            totalUsdValue: snapshots[0].positions[0].totalUsdValue
          });
        }
      }
    }
    
  } catch (error) {
    console.error('❌ APY Service Test Error:', error);
    console.error('Stack:', error.stack);
  } finally {
    process.exit(0);
  }
}

testAPYService();