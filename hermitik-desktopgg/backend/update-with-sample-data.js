/**
 * Update NAV settings with sample data for testing
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

async function updateWithSampleData(userId, year, month) {
  try {
    console.log(`🔧 Updating NAV settings with sample data for user ${userId}, ${year}-${month}`);

    // Find existing NAV setting
    const navSetting = await NAVSettings.findOne({ userId, year, month });
    
    if (!navSetting) {
      console.log(`   ❌ No NAV setting found for ${year}-${month}`);
      return false;
    }

    console.log(`   📝 Found existing NAV setting, updating with sample data`);

    // Create realistic sample portfolio data
    const portfolioData = {
      totalTokensValue: 75000,    // $75,000 in tokens
      totalPositionsValue: 45000, // $45,000 in DeFi positions
      totalRewards: 3000          // $3,000 in unclaimed rewards
    };

    // Calculate NAV values
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
    const priorPreFeeNav = priorSetting?.navCalculations?.preFeeNav || 115000; // Sample prior NAV
    const netFlows = 5000; // Sample net flows (deposits)
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
      priorPreFeeNavSource: 'manual'
    };

    await navSetting.save();

    console.log(`   ✅ NAV setting updated successfully with sample data`);
    console.log(`   💰 Sample values:`);
    console.log(`      - Investments: $${investments.toFixed(2)}`);
    console.log(`      - Total Assets: $${totalAssets.toFixed(2)}`);
    console.log(`      - Pre-Fee NAV: $${preFeeNav.toFixed(2)}`);
    console.log(`      - Performance: $${performance.toFixed(2)}`);
    console.log(`      - Performance Fee: $${performanceFee.toFixed(2)}`);
    console.log(`      - Net Assets: $${netAssets.toFixed(2)}`);

    return true;

  } catch (error) {
    console.error('❌ Error updating NAV with sample data:', error);
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
    console.log('Usage: node update-with-sample-data.js <userId> [year] [month]');
    console.log('');
    console.log('Examples:');
    console.log('  node update-with-sample-data.js 68a1f123f09a6ebb3a9d9c0b');
    console.log('  node update-with-sample-data.js 68a1f123f09a6ebb3a9d9c0b 2025 8');
    process.exit(1);
  }
  
  const success = await updateWithSampleData(userId, year, month);
  
  if (success) {
    console.log('\n✅ NAV settings updated with sample data!');
    console.log('🔄 You can now try exporting the NAV report again.');
  } else {
    console.log('\n❌ Failed to update NAV settings');
  }
  
  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { updateWithSampleData };
