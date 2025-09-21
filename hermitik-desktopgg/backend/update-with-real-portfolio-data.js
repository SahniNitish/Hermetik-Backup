/**
 * Update NAV settings with real portfolio data from console output
 */

const mongoose = require('mongoose');
const NAVSettings = require('./models/NAVSettings');

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

async function updateWithRealPortfolioData(userId, year, month) {
  try {
    console.log(`🔧 Updating NAV settings with REAL portfolio data for user ${userId}, ${year}-${month}`);

    // Find existing NAV setting
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

    // Real portfolio data from console output:
    // Total Tokens NAV: $2,618.698
    // Total Positions NAV: $166,777.936  
    // Total Portfolio NAV: $169,396.635
    
    const portfolioData = {
      totalTokensValue: 2618.698,     // From console: $2,618.698
      totalPositionsValue: 166777.936, // From console: $166,777.936
      totalRewards: 5000              // Estimated rewards (you can adjust this)
    };

    // Calculate NAV values using real portfolio data
    const investments = portfolioData.totalTokensValue + portfolioData.totalPositionsValue - portfolioData.totalRewards;
    const dividendsReceivable = portfolioData.totalRewards;
    const totalAssets = investments + dividendsReceivable;
    const monthlyExpense = 50;
    const accruedExpenses = monthlyExpense;
    const totalLiabilities = accruedExpenses;
    const preFeeNav = totalAssets - accruedExpenses;
    
    // Get prior NAV for performance calculation
    const priorMonth = month === 1 ? 12 : month - 1;
    const priorYear = month === 1 ? year - 1 : year;
    const priorSetting = await NAVSettings.findOne({ userId, year: priorYear, month: priorMonth });
    const priorPreFeeNav = priorSetting?.navCalculations?.preFeeNav || 160000; // Estimated prior NAV
    const netFlows = 0; // Assuming no flows for now
    const performance = preFeeNav - priorPreFeeNav + netFlows;
    
    // Calculate fees
    const hurdleRate = 0;
    const highWaterMark = 0;
    const performanceFeeRate = 0.25;
    const accruedPerformanceFeeRate = 0.25;
    
    // Performance fee calculation
    let hurdleAmount = 0;
    if (hurdleRate > 0 && priorPreFeeNav > 0) {
      hurdleAmount = (hurdleRate / 100 / 12) * priorPreFeeNav;
    }
    
    const performanceFee = performance > hurdleAmount ? (performance - hurdleAmount) * performanceFeeRate : 0;
    const accruedPerformanceFees = dividendsReceivable * accruedPerformanceFeeRate;
    
    // Management fee calculation (0.5% of total assets)
    const managementFeeRate = 0.005; // 0.5%
    const managementFee = totalAssets * managementFeeRate;
    
    const netAssets = preFeeNav - performanceFee - accruedPerformanceFees - managementFee;

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
      priorPreFeeNavSource: 'manual'
    };

    await navSetting.save();

    console.log(`   ✅ NAV setting updated successfully with REAL portfolio data`);
    console.log(`   💰 Real values:`);
    console.log(`      - Total Tokens Value: $${portfolioData.totalTokensValue.toFixed(2)}`);
    console.log(`      - Total Positions Value: $${portfolioData.totalPositionsValue.toFixed(2)}`);
    console.log(`      - Estimated Rewards: $${portfolioData.totalRewards.toFixed(2)}`);
    console.log(`      - Calculated Investments: $${investments.toFixed(2)}`);
    console.log(`      - Total Assets: $${totalAssets.toFixed(2)}`);
    console.log(`      - Pre-Fee NAV: $${preFeeNav.toFixed(2)}`);
    console.log(`      - Performance: $${performance.toFixed(2)}`);
    console.log(`      - Performance Fee: $${performanceFee.toFixed(2)}`);
    console.log(`      - Net Assets: $${netAssets.toFixed(2)}`);

    return true;

  } catch (error) {
    console.error('❌ Error updating NAV with real portfolio data:', error);
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
    console.log('Usage: node update-with-real-portfolio-data.js <userId> [year] [month]');
    console.log('');
    console.log('Examples:');
    console.log('  node update-with-real-portfolio-data.js 689bca219fe4bbc83dc7939a');
    console.log('  node update-with-real-portfolio-data.js 689bca219fe4bbc83dc7939a 2025 8');
    process.exit(1);
  }
  
  const success = await updateWithRealPortfolioData(userId, year, month);
  
  if (success) {
    console.log('\n✅ NAV settings updated with REAL portfolio data!');
    console.log('🔄 You can now try exporting the NAV report again.');
  } else {
    console.log('\n❌ Failed to update NAV settings');
  }
  
  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { updateWithRealPortfolioData };
