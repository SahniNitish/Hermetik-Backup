/**
 * Fix NAV calculations script
 * This script will recalculate and fix NAV settings that have incorrect values
 */

const mongoose = require('mongoose');
const NAVSettings = require('./models/NAVSettings');
const User = require('./models/User');

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

async function fixNAVCalculations() {
  try {
    console.log('🔧 Starting NAV calculations fix...\n');

    // Get all NAV settings
    const navSettings = await NAVSettings.find({});
    console.log(`📊 Found ${navSettings.length} NAV settings to check`);

    let fixedCount = 0;
    let errorCount = 0;

    for (const setting of navSettings) {
      try {
        console.log(`\n🔍 Checking NAV setting for user ${setting.userId}, ${setting.year}-${setting.month}`);
        
        const portfolioData = setting.portfolioData || {};
        const navCalculations = setting.navCalculations || {};
        
        // Calculate expected values from portfolio data
        const expectedInvestments = (portfolioData.totalTokensValue || 0) + 
                                   (portfolioData.totalPositionsValue || 0) - 
                                   (portfolioData.totalRewards || 0);
        const expectedDividendsReceivable = portfolioData.totalRewards || 0;
        const expectedTotalAssets = expectedInvestments + expectedDividendsReceivable;
        
        // Check if calculations need fixing
        const currentInvestments = navCalculations.investments || 0;
        const currentDividendsReceivable = navCalculations.dividendsReceivable || 0;
        const currentTotalAssets = navCalculations.totalAssets || 0;
        
        const needsFix = Math.abs(expectedInvestments - currentInvestments) > 0.01 ||
                        Math.abs(expectedDividendsReceivable - currentDividendsReceivable) > 0.01 ||
                        Math.abs(expectedTotalAssets - currentTotalAssets) > 0.01;
        
        if (needsFix) {
          console.log(`   ❌ Fixing calculations:`);
          console.log(`      - Current Investments: $${currentInvestments}`);
          console.log(`      - Expected Investments: $${expectedInvestments}`);
          console.log(`      - Current Dividends: $${currentDividendsReceivable}`);
          console.log(`      - Expected Dividends: $${expectedDividendsReceivable}`);
          console.log(`      - Current Total Assets: $${currentTotalAssets}`);
          console.log(`      - Expected Total Assets: $${expectedTotalAssets}`);
          
          // Update the calculations
          const updatedCalculations = {
            ...navCalculations,
            investments: expectedInvestments,
            dividendsReceivable: expectedDividendsReceivable,
            totalAssets: expectedTotalAssets
          };
          
          // Recalculate other values if needed
          const feeSettings = setting.feeSettings || {};
          const monthlyExpense = feeSettings.monthlyExpense || 50;
          const accruedExpenses = monthlyExpense;
          const totalLiabilities = accruedExpenses;
          const preFeeNav = expectedTotalAssets - accruedExpenses;
          
          // Update these values too
          updatedCalculations.accruedExpenses = accruedExpenses;
          updatedCalculations.totalLiabilities = totalLiabilities;
          updatedCalculations.preFeeNav = preFeeNav;
          
          // Update the setting
          await NAVSettings.findByIdAndUpdate(setting._id, {
            navCalculations: updatedCalculations
          });
          
          console.log(`   ✅ Fixed calculations`);
          fixedCount++;
        } else {
          console.log(`   ✅ Calculations are correct`);
        }
        
      } catch (error) {
        console.error(`   ❌ Error fixing NAV setting ${setting._id}:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n📊 Fix Summary:`);
    console.log(`   - Total NAV settings checked: ${navSettings.length}`);
    console.log(`   - Fixed: ${fixedCount}`);
    console.log(`   - Errors: ${errorCount}`);
    console.log(`   - No changes needed: ${navSettings.length - fixedCount - errorCount}`);

  } catch (error) {
    console.error('❌ Error during NAV calculations fix:', error);
  }
}

async function createSampleNAVSetting(userId, year, month) {
  try {
    console.log(`\n📝 Creating sample NAV setting for user ${userId}, ${year}-${month}`);
    
    // Check if setting already exists
    const existing = await NAVSettings.findOne({ userId, year, month });
    if (existing) {
      console.log(`   ⚠️ NAV setting already exists for ${year}-${month}`);
      return existing;
    }
    
    // Create sample portfolio data
    const portfolioData = {
      totalTokensValue: 50000,
      totalPositionsValue: 25000,
      totalRewards: 5000
    };
    
    // Calculate NAV values
    const investments = portfolioData.totalTokensValue + portfolioData.totalPositionsValue - portfolioData.totalRewards;
    const dividendsReceivable = portfolioData.totalRewards;
    const totalAssets = investments + dividendsReceivable;
    const monthlyExpense = 50;
    const accruedExpenses = monthlyExpense;
    const totalLiabilities = accruedExpenses;
    const preFeeNav = totalAssets - accruedExpenses;
    const priorPreFeeNav = 70000; // Sample prior NAV
    const netFlows = 0;
    const performance = preFeeNav - priorPreFeeNav + netFlows;
    const hurdleRate = 0;
    const highWaterMark = 0;
    const performanceFee = 0; // No performance fee if hurdle not met
    const accruedPerformanceFees = dividendsReceivable * 0.25; // 25% of dividends
    const netAssets = preFeeNav - performanceFee - accruedPerformanceFees;
    
    const navSetting = new NAVSettings({
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
      navCalculations: {
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
        hurdleAmount: 0,
        validationWarnings: [],
        calculationDate: new Date(),
        priorPreFeeNavSource: 'manual'
      },
      portfolioData
    });
    
    await navSetting.save();
    console.log(`   ✅ Created sample NAV setting with:`);
    console.log(`      - Investments: $${investments}`);
    console.log(`      - Total Assets: $${totalAssets}`);
    console.log(`      - Pre-Fee NAV: $${preFeeNav}`);
    console.log(`      - Net Assets: $${netAssets}`);
    
    return navSetting;
    
  } catch (error) {
    console.error(`   ❌ Error creating sample NAV setting:`, error);
    throw error;
  }
}

async function main() {
  await connectDB();
  
  const command = process.argv[2];
  
  if (command === 'fix') {
    await fixNAVCalculations();
  } else if (command === 'create-sample') {
    const userId = process.argv[3];
    const year = parseInt(process.argv[4]) || new Date().getFullYear();
    const month = parseInt(process.argv[5]) || new Date().getMonth() + 1;
    
    if (!userId) {
      console.error('❌ Please provide a user ID');
      console.log('Usage: node fix-nav-calculations.js create-sample <userId> [year] [month]');
      process.exit(1);
    }
    
    await createSampleNAVSetting(userId, year, month);
  } else {
    console.log('Available commands:');
    console.log('  fix - Fix existing NAV calculations');
    console.log('  create-sample <userId> [year] [month] - Create a sample NAV setting');
    console.log('');
    console.log('Examples:');
    console.log('  node fix-nav-calculations.js fix');
    console.log('  node fix-nav-calculations.js create-sample 507f1f77bcf86cd799439011');
  }
  
  await mongoose.disconnect();
  console.log('\n✅ Script completed');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { fixNAVCalculations, createSampleNAVSetting };
