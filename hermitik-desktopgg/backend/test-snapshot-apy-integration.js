const mongoose = require('mongoose');
const User = require('./models/User');
const DailySnapshot = require('./models/DailySnapshot');
const APYCalculationService = require('./services/apyCalculationService');

async function testSnapshotAPYIntegration() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hermetik');
    console.log('✅ Connected to MongoDB');

    // Get a user that has wallet data
    const users = await User.find({ wallets: { $exists: true, $ne: [] } }).limit(5);
    console.log(`📊 Found ${users.length} users with wallets`);

    if (users.length === 0) {
      console.log('❌ No users with wallets found');
      await mongoose.disconnect();
      return;
    }

    // Check snapshots for each user
    for (const user of users) {
      console.log(`\n👤 Checking user: ${user.email} (${user._id})`);
      
      // Check if user has snapshots
      const snapshots = await DailySnapshot.find({ userId: user._id }).sort({ date: -1 }).limit(3);
      console.log(`📸 User has ${snapshots.length} snapshots`);

      if (snapshots.length > 0) {
        console.log('Latest snapshot details:');
        const latest = snapshots[0];
        console.log(`  Date: ${latest.date}`);
        console.log(`  Wallet: ${latest.walletAddress}`);
        console.log(`  Total NAV: $${latest.totalNavUsd.toFixed(2)}`);
        console.log(`  Positions: ${latest.positions?.length || 0}`);
        
        if (latest.positions && latest.positions.length > 0) {
          console.log('  Position details:');
          latest.positions.forEach((pos, idx) => {
            console.log(`    ${idx + 1}. ${pos.protocolName} - $${pos.totalUsdValue?.toFixed(2) || 0}`);
            console.log(`       Supply tokens: ${pos.supplyTokens?.length || 0}`);
            console.log(`       Reward tokens: ${pos.rewardTokens?.length || 0}`);
            if (pos.rewardTokens && pos.rewardTokens.length > 0) {
              const totalRewards = pos.rewardTokens.reduce((sum, r) => sum + (r.usdValue || 0), 0);
              console.log(`       Total rewards value: $${totalRewards.toFixed(2)}`);
            }
          });
        }

        // Now test APY calculation for this user
        console.log(`🧮 Testing APY calculation for user ${user.email}...`);
        try {
          const apyResults = await APYCalculationService.calculateAllPositionAPYs(user._id);
          console.log(`📈 APY Results:`);
          console.log(`   Position count: ${Object.keys(apyResults).length}`);
          
          Object.entries(apyResults).forEach(([positionId, apy]) => {
            console.log(`   ${positionId}: ${apy.apy?.toFixed(2) || 'N/A'}% (${apy.calculationMethod})`);
          });
        } catch (apyError) {
          console.error(`❌ APY calculation failed for ${user.email}:`, apyError.message);
        }
      } else {
        console.log('❌ No snapshots found for this user');
        console.log('💡 Try fetching wallet data through API to create snapshots');
      }
    }

    await mongoose.disconnect();
    console.log('✅ Test completed');
  } catch (error) {
    console.error('❌ Error in integration test:', error);
    await mongoose.disconnect();
  }
}

testSnapshotAPYIntegration();