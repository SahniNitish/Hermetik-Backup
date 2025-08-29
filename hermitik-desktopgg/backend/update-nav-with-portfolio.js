/**
 * Update NAV settings with actual portfolio data
 * This script fetches real portfolio data and updates NAV settings
 */

const mongoose = require('mongoose');
const NAVSettings = require('./models/NAVSettings');
const User = require('./models/User');

// Import the wallet processing functions
const { fetchTokens, fetchAllProtocols, fetchPricesFromCoinGecko } = require('./utils/debankUtils');

// Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect('mongodb://localhost:27017/hermetikdb', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

// Helper function to ensure numbers are valid for calculations
function safeNumber(value) {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  const num = typeof value === 'string' ? parseFloat(value) : Number(value);
  return isFinite(num) ? num : 0;
}

async function fetchPortfolioData(userId) {
  try {
    console.log(`📊 Fetching portfolio data for user: ${userId}`);
    
    const user = await User.findById(userId);
    if (!user || !user.wallets?.length) {
      console.log(`   ❌ No wallets found for user`);
      return null;
    }

    console.log(`   💼 Found ${user.wallets.length} wallet(s)`);
    
    let totalTokensValue = 0;
    let totalPositionsValue = 0;
    let totalRewards = 0;

    for (const walletAddress of user.wallets) {
      console.log(`   🔄 Processing wallet: ${walletAddress}`);
      
      try {
        // Fetch tokens and protocols in parallel
        const [tokens, rawProtocols] = await Promise.all([
          fetchTokens(walletAddress),
          fetchAllProtocols(walletAddress)
        ]);

        console.log(`      📈 Found ${tokens.length} tokens and ${rawProtocols.length} protocols`);

        // Deduplicate protocols by name
        const protocolsMap = new Map();
        rawProtocols.forEach(protocol => {
          const key = protocol.name;
          if (!protocolsMap.has(key)) {
            protocolsMap.set(key, protocol);
          } else {
            const existing = protocolsMap.get(key);
            existing.portfolio_item_list = [
              ...(existing.portfolio_item_list || []),
              ...(protocol.portfolio_item_list || [])
            ];
            if (protocol.net_usd_value > existing.net_usd_value) {
              existing.net_usd_value = protocol.net_usd_value;
            }
          }
        });
        const protocols = Array.from(protocolsMap.values());

        // Get prices from CoinGecko
        const coinGeckoPrices = await fetchPricesFromCoinGecko(tokens);

        // Process tokens
        const enrichedTokens = tokens.map(token => {
          const symbol = (token.symbol || '').toLowerCase();
          let finalPrice = 0;

          if (coinGeckoPrices[symbol]) {
            finalPrice = coinGeckoPrices[symbol];
          } else if (symbol.startsWith('w') && coinGeckoPrices[symbol.substring(1)]) {
            finalPrice = coinGeckoPrices[symbol.substring(1)];
          } else if (token.price && token.price > 0) {
            finalPrice = token.price;
          }

          const usdValue = finalPrice * safeNumber(token.amount || 0);
          totalTokensValue += usdValue;

          return {
            symbol: token.symbol,
            amount: token.amount || 0,
            price: finalPrice,
            usd_value: usdValue
          };
        });

        // Process protocols with deduplication
        for (const protocol of protocols) {
          const portfolioItems = protocol.portfolio_item_list || [];

          // Deduplicate positions
          const uniqueItemsMap = new Map();
          portfolioItems.forEach(item => {
            const tokenAmounts = (item.detail?.supply_token_list || [])
              .map(t => `${t.symbol}:${safeNumber(t.amount).toFixed(6)}`)
              .sort()
              .join('|');
            const itemKey = `${item.pool?.id || 'no-pool'}-${tokenAmounts}`;

            if (!uniqueItemsMap.has(itemKey)) {
              uniqueItemsMap.set(itemKey, item);

              // Add position value to investments
              const itemValue = safeNumber(item.stats?.net_usd_value || 0);
              totalPositionsValue += itemValue;

              // Add rewards to dividends receivable
              if (item.detail?.reward_token_list) {
                for (const reward of item.detail.reward_token_list) {
                  const rewardValue = safeNumber(reward.amount || 0) * safeNumber(reward.price || 0);
                  totalRewards += rewardValue;
                }
              }
            }
          });
        }

        console.log(`      💰 Wallet totals: Tokens $${totalTokensValue.toFixed(2)}, Positions $${totalPositionsValue.toFixed(2)}, Rewards $${totalRewards.toFixed(2)}`);

      } catch (error) {
        console.error(`      ❌ Error processing wallet ${walletAddress}:`, error.message);
      }
    }

    const portfolioData = {
      totalTokensValue,
      totalPositionsValue,
      totalRewards
    };

    console.log(`   📊 Total portfolio data:`);
    console.log(`      - Total Tokens Value: $${totalTokensValue.toFixed(2)}`);
    console.log(`      - Total Positions Value: $${totalPositionsValue.toFixed(2)}`);
    console.log(`      - Total Rewards: $${totalRewards.toFixed(2)}`);

    return portfolioData;

  } catch (error) {
    console.error('❌ Error fetching portfolio data:', error);
    return null;
  }
}

async function updateNAVWithPortfolioData(userId, year, month) {
  try {
    console.log(`\n🔧 Updating NAV settings for user ${userId}, ${year}-${month}`);

    // Fetch current portfolio data
    const portfolioData = await fetchPortfolioData(userId);
    if (!portfolioData) {
      console.log(`   ❌ Could not fetch portfolio data`);
      return false;
    }

    // Check if NAV setting exists
    let navSetting = await NAVSettings.findOne({ userId, year, month });
    
    if (!navSetting) {
      console.log(`   📝 Creating new NAV setting for ${year}-${month}`);
      navSetting = new NAVSettings({
        userId,
        year,
        month,
        feeSettings: {
          annualExpense: 600,
          monthlyExpense: 50,
          performanceFeeRate: 0.25,
          accruedPerformanceFeeRate: 0.25,
          hurdleRate: 0,
          hurdleRateType: 'annual',
          highWaterMark: 0,
          feePaymentStatus: 'not_paid',
          partialPaymentAmount: 0,
          priorPreFeeNavSource: 'manual'
        },
        navCalculations: {},
        portfolioData: {}
      });
    } else {
      console.log(`   📝 Updating existing NAV setting for ${year}-${month}`);
    }

    // Calculate NAV values
    const investments = portfolioData.totalTokensValue + portfolioData.totalPositionsValue - portfolioData.totalRewards;
    const dividendsReceivable = portfolioData.totalRewards;
    const totalAssets = investments + dividendsReceivable;
    const monthlyExpense = navSetting.feeSettings?.monthlyExpense || 50;
    const accruedExpenses = monthlyExpense;
    const totalLiabilities = accruedExpenses;
    const preFeeNav = totalAssets - accruedExpenses;
    
    // Get prior NAV for performance calculation
    const priorMonth = month === 1 ? 12 : month - 1;
    const priorYear = month === 1 ? year - 1 : year;
    const priorSetting = await NAVSettings.findOne({ userId, year: priorYear, month: priorMonth });
    const priorPreFeeNav = priorSetting?.navCalculations?.preFeeNav || 0;
    const netFlows = 0; // Assuming no flows for now
    const performance = preFeeNav - priorPreFeeNav + netFlows;
    
    // Calculate fees
    const hurdleRate = navSetting.feeSettings?.hurdleRate || 0;
    const highWaterMark = navSetting.feeSettings?.highWaterMark || 0;
    const performanceFeeRate = navSetting.feeSettings?.performanceFeeRate || 0.25;
    const accruedPerformanceFeeRate = navSetting.feeSettings?.accruedPerformanceFeeRate || 0.25;
    
    // Performance fee calculation
    let hurdleAmount = 0;
    if (hurdleRate > 0 && priorPreFeeNav > 0) {
      if (navSetting.feeSettings?.hurdleRateType === 'annual') {
        hurdleAmount = (hurdleRate / 100 / 12) * priorPreFeeNav;
      } else {
        hurdleAmount = (hurdleRate / 100) * priorPreFeeNav;
      }
    }
    
    const performanceFee = performance > hurdleAmount ? (performance - hurdleAmount) * performanceFeeRate : 0;
    const accruedPerformanceFees = dividendsReceivable * accruedPerformanceFeeRate;
    const netAssets = preFeeNav - performanceFee - accruedPerformanceFees;

    // Update the NAV setting
    navSetting.portfolioData = portfolioData;
    navSetting.navCalculations = {
      investments,
      dividendsReceivable,
      totalAssets,
      accruedExpenses,
      totalLiabilities,
      preFeeNav,
      performance,
      performanceFee,
      accruedPerformanceFees,
      netAssets,
      netFlows,
      priorPreFeeNav,
      hurdleAmount,
      validationWarnings: [],
      calculationDate: new Date(),
      priorPreFeeNavSource: 'portfolio_estimate'
    };

    await navSetting.save();

    console.log(`   ✅ NAV setting updated successfully`);
    console.log(`   💰 New values:`);
    console.log(`      - Investments: $${investments.toFixed(2)}`);
    console.log(`      - Total Assets: $${totalAssets.toFixed(2)}`);
    console.log(`      - Pre-Fee NAV: $${preFeeNav.toFixed(2)}`);
    console.log(`      - Net Assets: $${netAssets.toFixed(2)}`);

    return true;

  } catch (error) {
    console.error('❌ Error updating NAV with portfolio data:', error);
    return false;
  }
}

async function main() {
  await connectDB();
  
  const userId = process.argv[2];
  const year = parseInt(process.argv[3]) || new Date().getFullYear();
  const month = parseInt(process.argv[4]) || new Date().getMonth() + 1;
  
  if (!userId) {
    console.error('❌ Please provide a user ID');
    console.log('Usage: node update-nav-with-portfolio.js <userId> [year] [month]');
    console.log('');
    console.log('Examples:');
    console.log('  node update-nav-with-portfolio.js 68a1f123f09a6ebb3a9d9c0b');
    console.log('  node update-nav-with-portfolio.js 68a1f123f09a6ebb3a9d9c0b 2025 8');
    process.exit(1);
  }
  
  const success = await updateNAVWithPortfolioData(userId, year, month);
  
  if (success) {
    console.log('\n✅ NAV settings updated successfully!');
    console.log('🔄 You can now try exporting the NAV report again.');
  } else {
    console.log('\n❌ Failed to update NAV settings');
  }
  
  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { updateNAVWithPortfolioData, fetchPortfolioData };
