const mongoose = require('mongoose');
const DailySnapshot = require('./models/DailySnapshot');

async function testSnapshotFix() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect('mongodb://localhost:27017/hermetikdb');
    console.log('✅ Connected to MongoDB');

    const userId = '688135ac3d4dc6db33f2fbcd';
    const targetDate = new Date();
    
    console.log(`\n📊 Testing FIXED snapshot retrieval for user: ${userId}`);

    // Test the FIXED getTodaySnapshot logic
    console.log('\n🔍 Testing FIXED today\'s snapshot retrieval...');
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const todaySnapshot = await DailySnapshot.findOne({
      userId,
      date: { $gte: startOfDay, $lte: endOfDay }
    }).sort({ date: -1 });

    console.log(`   Today snapshot found: ${!!todaySnapshot}`);

    if (!todaySnapshot) {
      console.log('\n🔄 Trying FIXED fallback - most recent with positions...');
      const fallbackSnapshot = await DailySnapshot.findOne({
        userId,
        date: { $lte: targetDate },
        $or: [
          { 'positions.0': { $exists: true } }, // Has at least one position
          { totalNavUsd: { $gt: 0 } } // Or has positive total value
        ]
      }).sort({ date: -1 });

      console.log(`   Fallback snapshot found: ${!!fallbackSnapshot}`);
      
      if (fallbackSnapshot) {
        console.log(`   Fallback date: ${fallbackSnapshot.date.toISOString()}`);
        console.log(`   Fallback positions: ${fallbackSnapshot.positions?.length || 0}`);
        console.log(`   Fallback total value: $${fallbackSnapshot.totalNavUsd?.toFixed(2) || 'N/A'}`);
        
        if (fallbackSnapshot.positions && fallbackSnapshot.positions.length > 0) {
          console.log('\n📋 Sample positions from FIXED fallback snapshot:');
          fallbackSnapshot.positions.slice(0, 3).forEach((pos, i) => {
            console.log(`   ${i+1}. ${pos.protocolName} - ${pos.position_name}`);
            console.log(`      Value: $${pos.totalUsdValue?.toFixed(2) || 'N/A'}`);
            console.log(`      Rewards: $${pos.rewardTokens?.reduce((sum, r) => sum + (r.usdValue || 0), 0)?.toFixed(2) || '0'}`);
          });
        }
      }
    }

    // Test the FIXED getYesterdaySnapshot logic
    console.log('\n🔍 Testing FIXED yesterday\'s snapshot retrieval...');
    const yesterday = new Date(targetDate);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const startOfYesterday = new Date(yesterday);
    startOfYesterday.setHours(0, 0, 0, 0);
    
    const endOfYesterday = new Date(yesterday);
    endOfYesterday.setHours(23, 59, 59, 999);

    const yesterdaySnapshot = await DailySnapshot.findOne({
      userId,
      date: { $gte: startOfYesterday, $lte: endOfYesterday }
    }).sort({ date: -1 });

    console.log(`   Yesterday snapshot found: ${!!yesterdaySnapshot}`);

    if (!yesterdaySnapshot) {
      console.log('\n🔄 Trying FIXED fallback for yesterday...');
      const yesterdayFallback = await DailySnapshot.findOne({
        userId,
        date: { $lt: startOfYesterday },
        $or: [
          { 'positions.0': { $exists: true } }, // Has at least one position
          { totalNavUsd: { $gt: 0 } } // Or has positive total value
        ]
      }).sort({ date: -1 });

      console.log(`   Yesterday fallback found: ${!!yesterdayFallback}`);
      
      if (yesterdayFallback) {
        console.log(`   Yesterday fallback date: ${yesterdayFallback.date.toISOString()}`);
        console.log(`   Yesterday fallback positions: ${yesterdayFallback.positions?.length || 0}`);
        console.log(`   Yesterday fallback total value: $${yesterdayFallback.totalNavUsd?.toFixed(2) || 'N/A'}`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

testSnapshotFix();
