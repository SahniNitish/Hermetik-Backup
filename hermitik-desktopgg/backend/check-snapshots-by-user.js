const mongoose = require('mongoose');
const User = require('./models/User');
const DailySnapshot = require('./models/DailySnapshot');
const APYCalculationService = require('./services/apyCalculationService');

async function checkSnapshotsByUser() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hermetik');
    console.log('✅ Connected to MongoDB');

    // Check Gary's user from server logs
    const garyUser = await User.findOne({ email: 'gary@example.com' });
    if (!garyUser) {
      console.log('❌ Gary user not found, trying to find any user with wallets...');
      const anyUser = await User.findOne({ wallets: { $exists: true, $ne: [] } });
      if (anyUser) {
        console.log(`👤 Found user: ${anyUser.email} (${anyUser._id}) - wallets: ${anyUser.wallets?.length || 0}`);
        const testUserId = anyUser._id;
        const snapshots = await DailySnapshot.find({ userId: testUserId }).sort({ date: -1 }).limit(5);
        console.log(`📸 Found ${snapshots.length} snapshots for this user`);
        return;
      }
      return;
    }
    
    const testUserId = garyUser._id;
    console.log(`👤 Gary found: ${garyUser.email} (${testUserId}) - wallets: ${garyUser.wallets?.length || 0}`);
    
    // Check snapshots for Gary
    const snapshots = await DailySnapshot.find({ userId: testUserId }).sort({ date: -1 }).limit(5);
    console.log(`📸 Found ${snapshots.length} snapshots for this user`);

    snapshots.forEach((snapshot, idx) => {
      console.log(`\nSnapshot ${idx + 1}:`);
      console.log(`  Date: ${snapshot.date}`);
      console.log(`  Wallet: ${snapshot.walletAddress}`);
      console.log(`  Total NAV: $${snapshot.totalNavUsd.toFixed(2)}`);
      console.log(`  Positions: ${snapshot.positions?.length || 0}`);
      
      if (snapshot.positions && snapshot.positions.length > 0) {
        console.log('  Position details:');
        snapshot.positions.forEach((pos, pidx) => {
          console.log(`    ${pidx + 1}. ${pos.protocolName} - $${pos.totalUsdValue?.toFixed(2) || 0}`);
          console.log(`       Supply tokens: ${pos.supplyTokens?.length || 0}`);
          console.log(`       Reward tokens: ${pos.rewardTokens?.length || 0}`);
          if (pos.rewardTokens && pos.rewardTokens.length > 0) {
            const totalRewards = pos.rewardTokens.reduce((sum, r) => sum + (r.usdValue || 0), 0);
            console.log(`       Total rewards value: $${totalRewards.toFixed(2)}`);
          }
        });
      }
    });

    if (snapshots.length > 0) {
      // Test APY calculation for this user
      console.log(`\n🧮 Testing APY calculation for user ${testUserId}...`);
      try {
        const apyResults = await APYCalculationService.calculateAllPositionAPYs(testUserId);
        console.log(`📈 APY Results:`);
        console.log(`   Position count: ${Object.keys(apyResults).length}`);
        
        Object.entries(apyResults).forEach(([positionId, apy]) => {
          console.log(`   ${positionId}: ${apy.apy?.toFixed(2) || 'N/A'}% (${apy.calculationMethod})`);
        });
      } catch (apyError) {
        console.error(`❌ APY calculation failed:`, apyError.message);
      }
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

checkSnapshotsByUser();