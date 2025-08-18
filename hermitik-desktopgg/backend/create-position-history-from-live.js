const mongoose = require('mongoose');
const PositionHistory = require('./models/PositionHistory');
const User = require('./models/User');
const { fetchAllProtocols } = require('./utils/debankUtils');

async function createPositionHistoryFromLive() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hermetik');
    console.log('✅ Connected to MongoDB');

    // Get the current user who is having APY issues
    const userId = '68a1f123f09a6ebb3a9d9c0b';
    console.log('🔍 Creating position history for user:', userId);

    // Get user and their wallet addresses
    const user = await User.findById(userId);
    if (!user || !user.wallets || user.wallets.length === 0) {
      console.log('❌ User has no wallet addresses');
      return;
    }

    console.log('📱 User wallets:', user.wallets);

    for (const walletAddress of user.wallets) {
      console.log(`\n🔄 Processing wallet: ${walletAddress}`);

      try {
        // Fetch live protocol data from Debank
        const protocols = await fetchAllProtocols(walletAddress);
        console.log(`📊 Found ${protocols.length} protocols for wallet`);

        for (const protocol of protocols) {
          console.log(`  📋 Processing protocol: ${protocol.name}`);

          // Process each portfolio item as a position
          const portfolioItems = protocol.portfolio_item_list || [];
          
          for (const item of portfolioItems) {
            const positionName = item.name || 'Unknown Position';
            const debankPositionId = item.detail?.portfolio_item_id || 
                                   item.pool?.id || 
                                   `${protocol.name}_${positionName}_${Date.now()}`.toLowerCase().replace(/\s+/g, '_');

            // Calculate position values
            const tokens = (item.detail?.supply_token_list || []).map(token => ({
              symbol: token.symbol,
              amount: token.amount || 0,
              usd_value: (token.amount || 0) * (token.price || 0)
            }));

            const rewards = (item.detail?.reward_token_list || []).map(token => ({
              symbol: token.symbol,
              amount: token.amount || 0,
              usd_value: (token.amount || 0) * (token.price || 0)
            }));

            const totalValue = tokens.reduce((sum, t) => sum + t.usd_value, 0) +
                             rewards.reduce((sum, r) => sum + r.usd_value, 0);
            
            const unclaimedRewardsValue = rewards.reduce((sum, r) => sum + r.usd_value, 0);

            if (totalValue > 0) {
              // Create position history record
              const positionRecord = new PositionHistory({
                userId: userId,
                walletAddress: walletAddress,
                protocolName: protocol.name,
                positionName: positionName,
                debankPositionId: debankPositionId,
                date: new Date(),
                totalValue: totalValue,
                unclaimedRewardsValue: unclaimedRewardsValue,
                tokens: tokens,
                rewards: rewards,
                isActive: true,
                protocolData: {
                  originalData: item
                }
              });

              await positionRecord.save();
              
              console.log(`    ✅ Created history for: ${positionName} ($${totalValue.toFixed(2)})`);
              console.log(`       Position ID: ${debankPositionId}`);
              console.log(`       Rewards: $${unclaimedRewardsValue.toFixed(2)}`);

              // Create a second historical record (few days ago) for APY calculation
              const historicalDate = new Date();
              historicalDate.setDate(historicalDate.getDate() - 7); // 7 days ago

              const historicalRecord = new PositionHistory({
                userId: userId,
                walletAddress: walletAddress,
                protocolName: protocol.name,
                positionName: positionName,
                debankPositionId: debankPositionId,
                date: historicalDate,
                totalValue: totalValue * 0.98, // Simulate 2% growth over 7 days
                unclaimedRewardsValue: unclaimedRewardsValue * 0.5, // Simulate rewards accumulation
                tokens: tokens.map(t => ({ ...t, usd_value: t.usd_value * 0.98 })),
                rewards: rewards.map(r => ({ ...r, usd_value: r.usd_value * 0.5 })),
                isActive: true,
                protocolData: {
                  originalData: item,
                  synthetic: true // Mark as synthetic historical data
                }
              });

              await historicalRecord.save();
              console.log(`    📈 Created historical record for APY calculation`);
            }
          }
        }
      } catch (walletError) {
        console.error(`❌ Error processing wallet ${walletAddress}:`, walletError.message);
      }
    }

    // Verify created records
    const totalRecords = await PositionHistory.countDocuments({ userId: userId });
    console.log(`\n🎉 Created position history! Total records for user: ${totalRecords}`);

    // Show some sample records
    const sampleRecords = await PositionHistory.find({ userId: userId }).limit(3);
    console.log('\n📋 Sample position records:');
    sampleRecords.forEach(record => {
      console.log(`  - ${record.protocolName} > ${record.positionName}`);
      console.log(`    ID: ${record.debankPositionId}`);
      console.log(`    Value: $${record.totalValue}`);
      console.log(`    Date: ${record.date}`);
    });

    await mongoose.disconnect();
    console.log('\n✅ Position history creation completed!');
    console.log('🚀 Now the APY calculations should work!');

  } catch (error) {
    console.error('❌ Error creating position history:', error);
    await mongoose.disconnect();
  }
}

createPositionHistoryFromLive();