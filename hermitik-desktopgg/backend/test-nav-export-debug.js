/**
 * Debug script to test NAV export functionality
 * This script will help identify why NAV exports are showing zero values
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

async function debugNAVExport() {
  try {
    console.log('🔍 Starting NAV export debug...\n');

    // Get all users
    const users = await User.find({});
    console.log(`📊 Found ${users.length} users`);

    for (const user of users) {
      console.log(`\n👤 User: ${user.name} (${user.id})`);
      
      // Get all NAV settings for this user
      const navSettings = await NAVSettings.find({ userId: user.id }).sort({ year: -1, month: -1 });
      console.log(`   📈 Found ${navSettings.length} NAV settings`);

      if (navSettings.length > 0) {
        const latest = navSettings[0];
        console.log(`   📅 Latest NAV setting: ${latest.year}-${latest.month}`);
        console.log(`   💰 Investments: $${latest.navCalculations?.investments || 0}`);
        console.log(`   💰 Total Assets: $${latest.navCalculations?.totalAssets || 0}`);
        console.log(`   💰 Dividends Receivable: $${latest.navCalculations?.dividendsReceivable || 0}`);
        console.log(`   💰 Pre-Fee NAV: $${latest.navCalculations?.preFeeNav || 0}`);
        console.log(`   💰 Net Assets: $${latest.navCalculations?.netAssets || 0}`);
        console.log(`   📊 Portfolio Data:`);
        console.log(`      - Total Tokens Value: $${latest.portfolioData?.totalTokensValue || 0}`);
        console.log(`      - Total Positions Value: $${latest.portfolioData?.totalPositionsValue || 0}`);
        console.log(`      - Total Rewards: $${latest.portfolioData?.totalRewards || 0}`);
        
        // Check if calculations match portfolio data
        const expectedInvestments = (latest.portfolioData?.totalTokensValue || 0) + 
                                   (latest.portfolioData?.totalPositionsValue || 0) - 
                                   (latest.portfolioData?.totalRewards || 0);
        const expectedDividends = latest.portfolioData?.totalRewards || 0;
        const expectedTotalAssets = expectedInvestments + expectedDividends;
        
        console.log(`   🔍 Validation:`);
        console.log(`      - Expected Investments: $${expectedInvestments}`);
        console.log(`      - Stored Investments: $${latest.navCalculations?.investments || 0}`);
        console.log(`      - Match: ${Math.abs(expectedInvestments - (latest.navCalculations?.investments || 0)) < 0.01 ? '✅' : '❌'}`);
        console.log(`      - Expected Total Assets: $${expectedTotalAssets}`);
        console.log(`      - Stored Total Assets: $${latest.navCalculations?.totalAssets || 0}`);
        console.log(`      - Match: ${Math.abs(expectedTotalAssets - (latest.navCalculations?.totalAssets || 0)) < 0.01 ? '✅' : '❌'}`);
      }
    }

    // Test specific user if provided
    const testUserId = process.argv[2];
    if (testUserId) {
      console.log(`\n🧪 Testing specific user: ${testUserId}`);
      const testUser = await User.findById(testUserId);
      if (testUser) {
        console.log(`   👤 User found: ${testUser.name}`);
        
        // Get current month/year
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1; // 1-based
        
        console.log(`   📅 Testing for: ${currentYear}-${currentMonth}`);
        
        const navSetting = await NAVSettings.findOne({
          userId: testUserId,
          year: currentYear,
          month: currentMonth
        });
        
        if (navSetting) {
          console.log(`   ✅ Found NAV setting for current month`);
          console.log(`   💰 Investments: $${navSetting.navCalculations?.investments || 0}`);
          console.log(`   💰 Total Assets: $${navSetting.navCalculations?.totalAssets || 0}`);
          console.log(`   💰 Pre-Fee NAV: $${navSetting.navCalculations?.preFeeNav || 0}`);
          console.log(`   💰 Net Assets: $${navSetting.navCalculations?.netAssets || 0}`);
        } else {
          console.log(`   ❌ No NAV setting found for current month`);
          
          // Check if there are any NAV settings for this user
          const allSettings = await NAVSettings.find({ userId: testUserId });
          if (allSettings.length > 0) {
            console.log(`   📊 Available NAV settings:`);
            allSettings.forEach(setting => {
              console.log(`      - ${setting.year}-${setting.month}: Investments $${setting.navCalculations?.investments || 0}, Total Assets $${setting.navCalculations?.totalAssets || 0}`);
            });
          } else {
            console.log(`   ❌ No NAV settings found for this user at all`);
          }
        }
      } else {
        console.log(`   ❌ User not found`);
      }
    }

  } catch (error) {
    console.error('❌ Error during debug:', error);
  }
}

async function main() {
  await connectDB();
  await debugNAVExport();
  await mongoose.disconnect();
  console.log('\n✅ Debug completed');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { debugNAVExport };
