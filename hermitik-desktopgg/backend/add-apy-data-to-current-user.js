const mongoose = require('mongoose');
const PositionHistory = require('./models/PositionHistory');

async function addAPYDataToCurrentUser() {
  try {
    await mongoose.connect('mongodb://localhost:27017/hermetik');
    console.log('Connected to MongoDB');

    // Using the current logged-in user ID that needs APY data
    const YOUR_USER_ID = '68a1f123f09a6ebb3a9d9c0b';
    
    console.log('✅ Using your actual user ID from Network tab:', YOUR_USER_ID);

    // Create sample positions with dates 2 days ago to trigger new position logic
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    twoDaysAgo.setHours(0, 0, 0, 0);

    const samplePositions = [
      {
        userId: YOUR_USER_ID,
        walletAddress: '0x14B5AbD73626a0c1182a6E7DEdB54d3dea1D3a14', // Using current user's wallet address
        protocolName: 'Uniswap V3',
        positionName: 'ETH/USDC Pool',
        debankPositionId: 'uniswap_v3_eth_usdc_001',
        date: twoDaysAgo,
        totalValue: 177090.804,
        unclaimedRewardsValue: 20.794,
        tokens: [
          {
            symbol: 'ETH',
            amount: 50,
            usd_value: 150000
          },
          {
            symbol: 'USDC',
            amount: 27090.804,
            usd_value: 27090.804
          }
        ],
        rewards: [
          {
            symbol: 'UNI',
            amount: 25,
            usd_value: 20.794
          }
        ],
        isActive: true,
        protocolData: {
          originalData: {
            position_id: 'uniswap_v3_eth_usdc_001',
            position_name: 'ETH/USDC Pool'
          }
        }
      }
    ];

    // Add the new position data (don't delete existing)
    const insertedPositions = await PositionHistory.insertMany(samplePositions);
    
    console.log(`✅ Added ${insertedPositions.length} APY-enabled positions for your user`);
    console.log('Sample data:');
    insertedPositions.forEach(pos => {
      console.log(`- ${pos.protocolName}/${pos.positionName} (${pos.debankPositionId})`);
      console.log(`  Value: $${pos.totalValue}, Rewards: $${pos.unclaimedRewardsValue}, Date: ${pos.date}`);
    });

    console.log(`\n🚀 APY data should now appear for your current user!`);

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error adding APY data:', error);
  }
}

addAPYDataToCurrentUser();