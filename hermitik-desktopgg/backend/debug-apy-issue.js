const mongoose = require('mongoose');
const DailySnapshot = require('./models/DailySnapshot');
const APYCalculationService = require('./services/apyCalculationService');

async function debugAPYIssue() {
  try {
    await mongoose.connect('mongodb://localhost:27017/hermetik');
    console.log('✅ Connected to MongoDB');

    // Find a user with snapshots
    const snapshot = await DailySnapshot.findOne({}).sort({ date: -1 });
    if (!snapshot) {
      console.log('❌ No snapshots found');
      return;
    }

    const userId = snapshot.userId;
    console.log(`🔍 Debugging APY for user: ${userId}`);
    console.log(`📅 Snapshot date: ${snapshot.date}`);
    console.log(`💰 Total NAV: $${snapshot.totalNavUsd}`);
    console.log(`📊 Positions count: ${snapshot.positions?.length || 0}`);

    // Check if positions have unclaimed rewards
    if (snapshot.positions && snapshot.positions.length > 0) {
      console.log('\n🔍 Checking positions for unclaimed rewards:');
      snapshot.positions.forEach((position, index) => {
        const unclaimedRewards = APYCalculationService.calculateUnclaimedRewards(position);
        console.log(`  ${index + 1}. ${position.protocolName} (${position.chain})`);
        console.log(`     Value: $${position.totalUsdValue}`);
        console.log(`     Unclaimed rewards: $${unclaimedRewards}`);
        console.log(`     Reward tokens: ${position.rewardTokens?.length || 0}`);
        
        if (position.rewardTokens && position.rewardTokens.length > 0) {
          position.rewardTokens.forEach((reward, rIndex) => {
            console.log(`       ${rIndex + 1}. ${reward.symbol}: $${reward.usdValue} (${reward.amount} tokens)`);
          });
        }
        console.log('');
      });
    }

    // Check if there are snapshots with different values
    const snapshots = await DailySnapshot.find({ userId }).sort({ date: -1 }).limit(5);
    console.log('\n📈 Recent snapshots for comparison:');
    snapshots.forEach((snap, index) => {
      console.log(`  ${index + 1}. ${snap.date.toISOString().split('T')[0]} - NAV: $${snap.totalNavUsd}`);
    });

    // Test APY calculation
    console.log('\n🧮 Testing APY calculation...');
    const apyResults = await APYCalculationService.calculateAllPositionAPYs(userId);
    
    console.log(`📊 APY Results: ${Object.keys(apyResults).length} positions`);
    Object.entries(apyResults).forEach(([positionId, apyData]) => {
      console.log(`  ${positionId}:`);
      console.log(`    APY: ${apyData.apy}%`);
      console.log(`    Method: ${apyData.calculationMethod}`);
      console.log(`    Confidence: ${apyData.confidence}`);
      console.log(`    Notes: ${apyData.notes}`);
      console.log('');
    });

    // Check if the issue is with the data structure
    console.log('\n🔍 Checking data structure issues...');
    const todaySnapshot = await APYCalculationService.getTodaySnapshot(userId, new Date());
    const yesterdaySnapshot = await APYCalculationService.getYesterdaySnapshot(userId, new Date());
    
    console.log(`📅 Today's snapshot: ${todaySnapshot ? 'Found' : 'Not found'}`);
    console.log(`📅 Yesterday's snapshot: ${yesterdaySnapshot ? 'Found' : 'Not found'}`);
    
    if (todaySnapshot && yesterdaySnapshot) {
      console.log(`📊 Today positions: ${todaySnapshot.positions?.length || 0}`);
      console.log(`📊 Yesterday positions: ${yesterdaySnapshot.positions?.length || 0}`);
      
      // Check if position IDs match
      if (todaySnapshot.positions && yesterdaySnapshot.positions) {
        const todayIds = todaySnapshot.positions.map(p => APYCalculationService.generatePositionId(p));
        const yesterdayIds = yesterdaySnapshot.positions.map(p => APYCalculationService.generatePositionId(p));
        
        console.log(`🔗 Today position IDs: ${todayIds.join(', ')}`);
        console.log(`🔗 Yesterday position IDs: ${yesterdayIds.join(', ')}`);
        
        const matchingIds = todayIds.filter(id => yesterdayIds.includes(id));
        console.log(`✅ Matching positions: ${matchingIds.length}`);
      }
    }

  } catch (error) {
    console.error('❌ Error debugging APY:', error);
  } finally {
    await mongoose.disconnect();
  }
}

debugAPYIssue();
