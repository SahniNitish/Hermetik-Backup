const cron = require('cron');
const mongoose = require('mongoose');
const User = require('../models/User');
const DailySnapshot = require('../models/DailySnapshot');
const { processWalletData } = require('../services/walletProcessor');

const runDailySnapshot = async () => {
  console.log(' Running daily snapshot job...');
  const users = await User.find({});

  for (const user of users) {
    const wallets = user.wallets || [];

    for (const wallet of wallets) {
      try {
        console.log(` Processing wallet: ${wallet}`);
        const { tokens, protocols, summary } = await processWalletData(wallet, true);
        console.log('tokens', tokens);
        console.log('protocols', protocols);
        console.log('summary', summary);

        const snapshot = new DailySnapshot({
          userId: user._id,
          walletAddress: wallet,

          totalNavUsd: summary.total_usd_value,
          tokensNavUsd: summary.token_usd_value,
          positionsNavUsd: summary.protocol_usd_value,
          date: new Date(),

          tokens: tokens.map(t => ({
            symbol: t.symbol,
            name: t.name,
            chain: t.chain,
            amount: t.amount,
            price: t.price,
            usdValue: t.usd_value,
            decimals: t.decimals,
            logoUrl: t.logo_url
          })),

          positions: protocols.flatMap(p =>
            (p.portfolio_item_list || []).map(item => ({
              protocolId: p.id || p.protocol_id,
              protocolName: p.name,
              chain: p.chain,
              positionName: item.name || `${p.name}_${item.position_index || 'position'}`,
              assetUsdValue: item.stats?.asset_usd_value || 0,
              debtUsdValue: item.stats?.debt_usd_value || 0,
              totalUsdValue: item.stats?.net_usd_value || 0,
              supplyTokens: item.detail?.supply_token_list || [],
              rewardTokens: item.detail?.reward_token_list || [],
              borrowTokens: item.detail?.borrow_token_list || [],
              dailyApy: p.lending_rate,
              lendingRate: p.lending_rate,
              itemType: item.name,
              positionIndex: item.position_index,
              description: item.detail?.description,
              poolId: item.pool?.id
            }))
          )
        });

        await snapshot.save();
        console.log(`✅ Snapshot saved for ${wallet}`);

      } catch (err) {
        console.error(`❌ Failed for wallet ${wallet}:`, err.message);
      }
    }
  }
};

// Schedule: every day at midnight
const job = new cron.CronJob('0 0 * * *', async () => {
  await runDailySnapshot();
}, null, true, 'America/New_York');


module.exports = runDailySnapshot;