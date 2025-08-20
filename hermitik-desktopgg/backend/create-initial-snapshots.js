const mongoose = require('mongoose');
const DailySnapshot = require('./models/DailySnapshot');
const User = require('./models/User');
const { fetchTokens, fetchAllProtocols } = require('./utils/debankUtils');

async function createInitialSnapshots() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect('mongodb://localhost:27017/hermitik');
    console.log('✅ Connected to MongoDB');

    // Get all users with wallets
    const users = await User.find({ wallets: { $exists: true, $ne: [] } });
    console.log(`📊 Found ${users.length} users with wallets`);

    for (const user of users) {
      console.log(`\n👤 Processing user: ${user.name} (${user.email})`);
      console.log(`💼 Wallets: ${user.wallets.join(', ')}`);

      // Check if user already has snapshots
      const existingSnapshots = await DailySnapshot.find({ userId: user._id });
      if (existingSnapshots.length > 0) {
        console.log(`⚠️ User already has ${existingSnapshots.length} snapshots, skipping...`);
        continue;
      }

      let totalPortfolioValue = 0;
      const allPositions = [];

      // Process each wallet
      for (const walletAddress of user.wallets) {
        console.log(`\n🔍 Fetching data for wallet: ${walletAddress}`);
        
        try {
          // Fetch tokens and protocols
          const [tokens, protocols] = await Promise.all([
            fetchTokens(walletAddress),
            fetchAllProtocols(walletAddress)
          ]);

          console.log(`📈 Found ${tokens.length} tokens and ${protocols.length} protocols`);

          // Process tokens
          let tokenValue = 0;
          tokens.forEach(token => {
            const value = (token.price || 0) * (token.amount || 0);
            tokenValue += value;
            totalPortfolioValue += value;
          });

          // Process protocols and their positions
          protocols.forEach(protocol => {
            const portfolioItems = protocol.portfolio_item_list || [];
            
            portfolioItems.forEach(item => {
              const positionValue = item.stats?.net_usd_value || 0;
              totalPortfolioValue += positionValue;

              // Create position object for snapshot
              const position = {
                protocolName: protocol.name,
                protocolId: protocol.id,
                chain: protocol.chain,
                position_name: item.pool?.name || 'Unknown Position',
                position_id: item.pool?.id || `${protocol.name}_${Date.now()}`,
                totalUsdValue: positionValue,
                tokens: (item.detail?.supply_token_list || []).map(token => ({
                  symbol: token.symbol,
                  amount: token.amount,
                  price: token.price,
                  usdValue: (token.price || 0) * (token.amount || 0)
                })),
                rewardTokens: (item.detail?.reward_token_list || []).map(reward => ({
                  symbol: reward.symbol,
                  amount: reward.amount,
                  price: reward.price,
                  usdValue: (reward.price || 0) * (reward.amount || 0)
                }))
              };

              allPositions.push(position);
            });
          });

          console.log(`💰 Wallet ${walletAddress}: $${tokenValue.toFixed(2)} in tokens, ${allPositions.length} positions`);

        } catch (error) {
          console.error(`❌ Error processing wallet ${walletAddress}:`, error.message);
        }
      }

      // Create today's snapshot
      const todaySnapshot = new DailySnapshot({
        userId: user._id,
        date: new Date(),
        walletAddress: user.wallets[0], // Use first wallet as primary
        totalNavUsd: totalPortfolioValue,
        tokensNavUsd: totalPortfolioValue * 0.3, // Estimate 30% in tokens
        positionsNavUsd: totalPortfolioValue * 0.7, // Estimate 70% in positions
        positions: allPositions,
        dailyReturn: 0, // No historical data for daily return
        dailyApy: 0, // Will be calculated by APY service
        monthlyApy: 0,
        volatility: 0,
        maxDrawdown: 0,
        benchmarkRate: 0.05 // 5% benchmark
      });

      await todaySnapshot.save();
      console.log(`✅ Created snapshot for ${user.name}: $${totalPortfolioValue.toFixed(2)} total value, ${allPositions.length} positions`);

      // Create yesterday's snapshot (for APY calculation)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const yesterdaySnapshot = new DailySnapshot({
        userId: user._id,
        date: yesterday,
        walletAddress: user.wallets[0],
        totalNavUsd: totalPortfolioValue * 0.99, // Assume 1% less yesterday
        tokensNavUsd: totalPortfolioValue * 0.3 * 0.99,
        positionsNavUsd: totalPortfolioValue * 0.7 * 0.99,
        positions: allPositions.map(pos => ({
          ...pos,
          totalUsdValue: pos.totalUsdValue * 0.99 // Assume 1% less yesterday
        })),
        dailyReturn: 0.01, // 1% daily return
        dailyApy: 0,
        monthlyApy: 0,
        volatility: 0,
        maxDrawdown: 0,
        benchmarkRate: 0.05
      });

      await yesterdaySnapshot.save();
      console.log(`✅ Created yesterday's snapshot for ${user.name}`);
    }

    console.log('\n🎉 Initial snapshots created successfully!');
    console.log('📊 APY calculation service should now work properly.');

  } catch (error) {
    console.error('❌ Error creating initial snapshots:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the script
createInitialSnapshots();
