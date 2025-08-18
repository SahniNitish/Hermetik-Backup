const mongoose = require('mongoose');
const PositionHistory = require('./models/PositionHistory');

async function createAPYHistory() {
  try {
    await mongoose.connect('mongodb://localhost:27017/hermetik');
    console.log('✅ Connected to MongoDB');

    const userId = '68a1f123f09a6ebb3a9d9c0b';
    const walletAddress = '0x14B5AbD73626a0c1182a6E7DEdB54d3dea1D3a14';
    const positionId = 'uniswap_v3_eth_usdc_001';

    // Create historical records at different time points to enable APY calculation
    const historicalRecords = [
      // Current (today)
      {
        userId,
        walletAddress,
        protocolName: 'Uniswap V3',
        positionName: 'ETH/USDC Pool',
        debankPositionId: positionId,
        date: new Date(),
        totalValue: 177090.804,
        unclaimedRewardsValue: 20.794,
        tokens: [
          { symbol: 'ETH', amount: 50, usd_value: 150000 },
          { symbol: 'USDC', amount: 27090.804, usd_value: 27090.804 }
        ],
        rewards: [
          { symbol: 'UNI', amount: 25, usd_value: 20.794 }
        ],
        isActive: true
      },
      // 1 day ago
      {
        userId,
        walletAddress,
        protocolName: 'Uniswap V3',
        positionName: 'ETH/USDC Pool',
        debankPositionId: positionId,
        date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        totalValue: 176500.0,
        unclaimedRewardsValue: 15.5,
        tokens: [
          { symbol: 'ETH', amount: 50, usd_value: 149500 },
          { symbol: 'USDC', amount: 27000, usd_value: 27000 }
        ],
        rewards: [
          { symbol: 'UNI', amount: 20, usd_value: 15.5 }
        ],
        isActive: true
      },
      // 7 days ago
      {
        userId,
        walletAddress,
        protocolName: 'Uniswap V3',
        positionName: 'ETH/USDC Pool',
        debankPositionId: positionId,
        date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        totalValue: 175000.0,
        unclaimedRewardsValue: 10.0,
        tokens: [
          { symbol: 'ETH', amount: 50, usd_value: 148000 },
          { symbol: 'USDC', amount: 27000, usd_value: 27000 }
        ],
        rewards: [
          { symbol: 'UNI', amount: 15, usd_value: 10.0 }
        ],
        isActive: true
      },
      // 30 days ago
      {
        userId,
        walletAddress,
        protocolName: 'Uniswap V3',
        positionName: 'ETH/USDC Pool',
        debankPositionId: positionId,
        date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        totalValue: 170000.0,
        unclaimedRewardsValue: 5.0,
        tokens: [
          { symbol: 'ETH', amount: 50, usd_value: 143000 },
          { symbol: 'USDC', amount: 27000, usd_value: 27000 }
        ],
        rewards: [
          { symbol: 'UNI', amount: 10, usd_value: 5.0 }
        ],
        isActive: true
      }
    ];

    // Clear existing records for this position to avoid duplicates
    await PositionHistory.deleteMany({ userId, debankPositionId: positionId });
    console.log('🗑️ Cleared existing records for position');

    // Insert new historical records
    await PositionHistory.insertMany(historicalRecords);
    console.log(`✅ Created ${historicalRecords.length} historical records for APY calculation`);

    // Show the progression
    console.log('\n📈 Position value progression:');
    historicalRecords.sort((a, b) => a.date - b.date).forEach(record => {
      const daysAgo = Math.round((Date.now() - record.date.getTime()) / (1000 * 60 * 60 * 24));
      console.log(`  ${daysAgo} days ago: $${record.totalValue.toLocaleString()} (rewards: $${record.unclaimedRewardsValue})`);
    });

    const totalReturn = ((177090.804 / 170000.0) - 1) * 100;
    console.log(`\n📊 Expected 30-day return: ${totalReturn.toFixed(2)}%`);
    console.log('🚀 APY calculations should now work with multiple data points!');

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error creating APY history:', error);
    await mongoose.disconnect();
  }
}

createAPYHistory();