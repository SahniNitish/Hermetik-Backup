const mongoose = require('mongoose');
const PositionHistory = require('./models/PositionHistory');

async function createSampleData() {
  try {
    await mongoose.connect('mongodb://localhost:27017/hermetik');
    console.log('Connected to MongoDB');

    // Create a sample user ID
    const sampleUserId = new mongoose.Types.ObjectId();

    // Create sample positions with dates 2 days ago to trigger new position logic
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    twoDaysAgo.setHours(0, 0, 0, 0);

    const samplePositions = [
      {
        userId: sampleUserId,
        walletAddress: '0x1234567890123456789012345678901234567890',
        protocolName: 'Compound',
        positionName: 'USDC Lending',
        debankPositionId: 'compound_usdc_lending_001',
        date: twoDaysAgo,
        totalValue: 10000,
        unclaimedRewardsValue: 25,
        tokens: [
          {
            symbol: 'USDC',
            amount: 10000,
            usd_value: 10000
          }
        ],
        rewards: [
          {
            symbol: 'COMP',
            amount: 0.5,
            usd_value: 25
          }
        ],
        isActive: true,
        protocolData: {
          originalData: {
            position_id: 'compound_usdc_lending_001',
            position_name: 'USDC Lending'
          }
        }
      },
      {
        userId: sampleUserId,
        walletAddress: '0x1234567890123456789012345678901234567890',
        protocolName: 'Aave',
        positionName: 'ETH Lending',
        debankPositionId: 'aave_eth_lending_002',
        date: twoDaysAgo,
        totalValue: 5000,
        unclaimedRewardsValue: 75,
        tokens: [
          {
            symbol: 'ETH',
            amount: 2,
            usd_value: 5000
          }
        ],
        rewards: [
          {
            symbol: 'AAVE',
            amount: 1.2,
            usd_value: 75
          }
        ],
        isActive: true,
        protocolData: {
          originalData: {
            position_id: 'aave_eth_lending_002',
            position_name: 'ETH Lending'
          }
        }
      }
    ];

    // Clear existing data and insert new sample data
    await PositionHistory.deleteMany({});
    const insertedPositions = await PositionHistory.insertMany(samplePositions);
    
    console.log(`✅ Created ${insertedPositions.length} sample positions`);
    console.log('Sample data:');
    insertedPositions.forEach(pos => {
      console.log(`- ${pos.protocolName}/${pos.positionName} (${pos.debankPositionId})`);
      console.log(`  Value: $${pos.totalValue}, Rewards: $${pos.unclaimedRewardsValue}, Date: ${pos.date}`);
    });

    console.log(`\n📝 Test user ID: ${sampleUserId}`);
    console.log('🚀 You can now test the APY API with this user ID');

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error creating sample data:', error);
  }
}

createSampleData();