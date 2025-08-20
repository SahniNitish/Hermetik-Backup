const mongoose = require('mongoose');
const DailySnapshot = require('./models/DailySnapshot');

async function testAPYDebug() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect('mongodb://localhost:27017/hermetikdb');
    console.log('✅ Connected to MongoDB');

    const userId = '688135ac3d4dc6db33f2fbcd';
    const targetDate = new Date();
    
    console.log(`\n📊 Testing APY calculation for user: ${userId}`);
    console.log(`📅 Target date: ${targetDate.toISOString()}`);

    // Check all snapshots for this user
    const allSnapshots = await DailySnapshot.find({ userId }).sort({ date: -1 });
    console.log(`📈 Total snapshots for user: ${allSnapshots.length}`);
    
    if (allSnapshots.length > 0) {
      console.log('\n📋 Recent snapshots:');
      allSnapshots.slice(0, 5).forEach((snapshot, i) => {
        console.log(`  ${i+1}. Date: ${snapshot.date.toISOString()}`);
        console.log(`     Positions: ${snapshot.positions?.length || 0}`);
        console.log(`     Total value: $${snapshot.totalNavUsd?.toFixed(2) || 'N/A'}`);
      });
    }

    // Test today's snapshot retrieval
    console.log('\n🔍 Testing today\'s snapshot retrieval...');
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    console.log(`   Looking between: ${startOfDay.toISOString()} and ${endOfDay.toISOString()}`);
    
    const todaySnapshot = await DailySnapshot.findOne({
      userId,
      date: { $gte: startOfDay, $lte: endOfDay }
    }).sort({ date: -1 });

    console.log(`   Today snapshot found: ${!!todaySnapshot}`);

    if (!todaySnapshot) {
      console.log('\n🔄 Trying fallback - most recent before target date...');
      const fallbackSnapshot = await DailySnapshot.findOne({
        userId,
        date: { $lte: targetDate }
      }).sort({ date: -1 });

      console.log(`   Fallback snapshot found: ${!!fallbackSnapshot}`);
      
      if (fallbackSnapshot) {
        console.log(`   Fallback date: ${fallbackSnapshot.date.toISOString()}`);
        console.log(`   Fallback positions: ${fallbackSnapshot.positions?.length || 0}`);
        console.log(`   Fallback total value: $${fallbackSnapshot.totalNavUsd?.toFixed(2) || 'N/A'}`);
        
        if (fallbackSnapshot.positions && fallbackSnapshot.positions.length > 0) {
          console.log('\n📋 Sample positions from fallback snapshot:');
          fallbackSnapshot.positions.slice(0, 3).forEach((pos, i) => {
            console.log(`   ${i+1}. ${pos.protocolName} - ${pos.position_name}`);
            console.log(`      Value: $${pos.totalUsdValue?.toFixed(2) || 'N/A'}`);
            console.log(`      Rewards: $${pos.rewardTokens?.reduce((sum, r) => sum + (r.usdValue || 0), 0)?.toFixed(2) || '0'}`);
          });
        }
      }
    }

    // Test yesterday's snapshot retrieval
    console.log('\n🔍 Testing yesterday\'s snapshot retrieval...');
    const yesterday = new Date(targetDate);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const startOfYesterday = new Date(yesterday);
    startOfYesterday.setHours(0, 0, 0, 0);
    
    const endOfYesterday = new Date(yesterday);
    endOfYesterday.setHours(23, 59, 59, 999);

    console.log(`   Looking between: ${startOfYesterday.toISOString()} and ${endOfYesterday.toISOString()}`);
    
    const yesterdaySnapshot = await DailySnapshot.findOne({
      userId,
      date: { $gte: startOfYesterday, $lte: endOfYesterday }
    }).sort({ date: -1 });

    console.log(`   Yesterday snapshot found: ${!!yesterdaySnapshot}`);

    if (!yesterdaySnapshot) {
      console.log('\n🔄 Trying fallback for yesterday...');
      const yesterdayFallback = await DailySnapshot.findOne({
        userId,
        date: { $lt: startOfYesterday }
      }).sort({ date: -1 });

      console.log(`   Yesterday fallback found: ${!!yesterdayFallback}`);
      
      if (yesterdayFallback) {
        console.log(`   Yesterday fallback date: ${yesterdayFallback.date.toISOString()}`);
        console.log(`   Yesterday fallback positions: ${yesterdayFallback.positions?.length || 0}`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

testAPYDebug();
