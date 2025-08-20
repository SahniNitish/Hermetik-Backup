const mongoose = require('mongoose');
const DailySnapshot = require('./models/DailySnapshot');

async function createTestSnapshot() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hermetikdb');
    console.log('✅ Connected to MongoDB');

    // Create a simple test snapshot for today
    const testSnapshot = new DailySnapshot({
      userId: '689bcacf9fe4bbc83dc79fd1', // User from frontend logs
      walletAddress: '0x7e73dA415Af2BBCC11f45aeEf7F2cA60222EC736',
      date: new Date(),
      totalNavUsd: 150.97,
      tokensNavUsd: 150.97,
      positionsNavUsd: 0,
      tokens: [{
        symbol: 'USDT',
        name: 'Tether USD',
        chain: 'eth',
        amount: 150.97,
        price: 1.0,
        usdValue: 150.97
      }],
      positions: [{
        protocolId: 'test_protocol',
        protocolName: 'Test Protocol',
        chain: 'eth',
        supplyTokens: [{
          symbol: 'USDT',
          amount: 150.97,
          price: 1.0,
          usdValue: 150.97
        }],
        rewardTokens: [{
          symbol: 'REWARD',
          amount: 1.0,
          price: 1.0,
          usdValue: 1.0
        }],
        totalUsdValue: 151.97
      }]
    });

    await testSnapshot.save();
    console.log('✅ Test snapshot created successfully!');
    
    // Verify it was created
    const snapshots = await DailySnapshot.find({ userId: '689bcacf9fe4bbc83dc79fd1' })
      .sort({ date: -1 })
      .limit(1);
      
    if (snapshots.length > 0) {
      const latest = snapshots[0];
      console.log('📸 Latest snapshot:');
      console.log(`  Date: ${latest.date}`);
      console.log(`  NAV: $${latest.totalNavUsd}`);
      console.log(`  Positions: ${latest.positions.length}`);
      console.log(`  Has Reward Tokens: ${latest.positions.some(p => p.rewardTokens.length > 0)}`);
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

createTestSnapshot();