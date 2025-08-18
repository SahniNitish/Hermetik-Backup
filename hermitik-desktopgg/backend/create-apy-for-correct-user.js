const mongoose = require('mongoose');
const PositionHistory = require('./models/PositionHistory');

async function createAPYForCorrectUser() {
  try {
    await mongoose.connect('mongodb://localhost:27017/hermetik');
    console.log('Connected to MongoDB');

    // Using the correct user ID from the console logs
    const CORRECT_USER_ID = '689bca219fe4bbc83dc7939a';
    
    console.log('✅ Creating APY data for user:', CORRECT_USER_ID);

    // Create sample positions with dates 2 days ago to trigger new position logic
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    twoDaysAgo.setHours(0, 0, 0, 0);

    const samplePositions = [
      {
        userId: CORRECT_USER_ID,
        walletAddress: '0xe71aa6f45a22fa1e4c9fb29960248f4a3d4af918',
        protocolName: 'Uniswap V3',
        positionName: 'ETH/USDC Pool',
        debankPositionId: 'uniswap_v3_eth_usdc_current_user',
        date: twoDaysAgo,
        totalValue: 177674.959,
        unclaimedRewardsValue: 23.311,
        tokens: [
          {
            symbol: 'ETH',
            amount: 50,
            usd_value: 150000
          },
          {
            symbol: 'USDC',
            amount: 27674.959,
            usd_value: 27674.959
          }
        ],
        rewards: [
          {
            symbol: 'UNI',
            amount: 28,
            usd_value: 23.311
          }
        ],
        isActive: true,
        protocolData: {
          originalData: {
            position_id: 'uniswap_v3_eth_usdc_current_user',
            position_name: 'ETH/USDC Pool'
          }
        }
      }
    ];

    // Remove any existing test data for this user first
    await PositionHistory.deleteMany({ userId: CORRECT_USER_ID });
    
    // Add the new position data
    const insertedPositions = await PositionHistory.insertMany(samplePositions);
    
    console.log(`✅ Added ${insertedPositions.length} APY-enabled positions for user ${CORRECT_USER_ID}`);
    console.log('Sample data:');
    insertedPositions.forEach(pos => {
      console.log(`- ${pos.protocolName}/${pos.positionName} (${pos.debankPositionId})`);
      console.log(`  Value: $${pos.totalValue}, Rewards: $${pos.unclaimedRewardsValue}, Date: ${pos.date}`);
      
      // Calculate expected APY
      const expectedAPY = (pos.unclaimedRewardsValue / pos.totalValue) * 365 * 100;
      console.log(`  Expected APY: ${expectedAPY.toFixed(2)}%`);
    });

    console.log(`\n🚀 APY data should now appear for the current user!`);
    console.log(`📊 Expected APY: ${((23.311 / 177674.959) * 365 * 100).toFixed(2)}%`);

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error creating APY data:', error);
  }
}

createAPYForCorrectUser();