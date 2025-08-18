const mongoose = require('mongoose');
const APYCalculationService = require('./services/apyCalculationService');
const PositionHistory = require('./models/PositionHistory');

async function testAPYDirectly() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hermetik');
    console.log('✅ Connected to MongoDB');

    // Get a real user ID from the database
    const userId = '689e6ebb3be5843c1f7dcfc3';
    console.log('🔍 Testing APY for user:', userId);

    // Check what position history exists for this user
    const positions = await PositionHistory.find({ userId }).sort({ date: -1 }).limit(5);
    console.log('📊 Found', positions.length, 'position history records for user');
    
    if (positions.length > 0) {
      console.log('Latest position:', {
        protocolName: positions[0].protocolName,
        positionName: positions[0].positionName,
        debankPositionId: positions[0].debankPositionId,
        totalValue: positions[0].totalValue,
        unclaimedRewardsValue: positions[0].unclaimedRewardsValue,
        date: positions[0].date
      });

      // Test APY calculation for the first position
      console.log('🧮 Calculating APY for position:', positions[0].debankPositionId);
      const apyResult = await APYCalculationService.calculatePositionAPY(userId, positions[0].debankPositionId);
      console.log('📈 APY Result:', JSON.stringify(apyResult, null, 2));

      // Test calculating all position APYs
      console.log('🔄 Calculating all position APYs...');
      const allAPYs = await APYCalculationService.calculateAllPositionAPYs(userId);
      console.log('📊 All APYs:', JSON.stringify(allAPYs, null, 2));
    } else {
      console.log('❌ No position history found for user');
    }

    await mongoose.disconnect();
    console.log('✅ Test completed');
  } catch (error) {
    console.error('❌ Error testing APY:', error);
    await mongoose.disconnect();
  }
}

testAPYDirectly();