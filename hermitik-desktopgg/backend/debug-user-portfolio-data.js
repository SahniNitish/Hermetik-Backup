const mongoose = require('mongoose');
const User = require('./models/User');
const DailySnapshot = require('./models/DailySnapshot');
const NAVSettings = require('./models/NAVSettings');

async function debugUserPortfolioData() {
  try {
    await mongoose.connect('mongodb://localhost:27017/hermetik');
    
    console.log('🔍 Checking all users and their portfolio data...\n');
    
    const users = await User.find({});
    console.log(`📊 Found ${users.length} users total\n`);
    
    for (const user of users) {
      console.log(`👤 User: ${user.name} (${user.email})`);
      console.log(`   Role: ${user.role}`);
      console.log(`   ID: ${user._id}`);
      console.log(`   Wallets: ${user.wallets?.length || 0} wallets`);
      
      if (user.wallets && user.wallets.length > 0) {
        console.log(`   Wallet addresses:`);
        user.wallets.forEach((wallet, i) => {
          console.log(`     ${i + 1}. ${wallet}`);
        });
      }
      
      // Check snapshots for this user
      const snapshots = await DailySnapshot.find({ userId: user._id }).sort({ date: -1 }).limit(5);
      console.log(`   📸 Snapshots: ${snapshots.length} total`);
      
      if (snapshots.length > 0) {
        console.log(`   Latest snapshots:`);
        snapshots.forEach((snapshot, i) => {
          console.log(`     ${i + 1}. ${snapshot.date.toISOString().split('T')[0]} - $${snapshot.totalNavUsd?.toFixed(2) || '0'} (${snapshot.walletAddress})`);
        });
      }
      
      // Check NAV settings
      const navSettings = await NAVSettings.find({ userId: user._id }).sort({ year: -1, month: -1 }).limit(3);
      console.log(`   🧮 NAV Settings: ${navSettings.length} entries`);
      
      if (navSettings.length > 0) {
        console.log(`   Recent NAV settings:`);
        navSettings.forEach((nav, i) => {
          console.log(`     ${i + 1}. ${nav.year}/${nav.month} - Assets: $${nav.navCalculations?.totalAssets || 0}, NetFlows: $${nav.navCalculations?.netFlows || 0}`);
        });
      }
      
      console.log(''); // Empty line
    }
    
    // Check if the admin user exists and is being used correctly
    const adminUser = users.find(u => u.role === 'admin');
    if (adminUser) {
      console.log('🔧 ADMIN USER ANALYSIS:');
      console.log(`   Admin ID: ${adminUser._id}`);
      console.log(`   Admin Email: ${adminUser.email}`);
      console.log(`   Admin Wallets: ${adminUser.wallets?.length || 0}`);
      
      if (adminUser.wallets?.length === 0) {
        console.log('   ⚠️  ISSUE: Admin has no wallets - this is why reports show zero!');
        console.log('   💡 SOLUTION: Admin should either:');
        console.log('      1. Add wallets to admin user, OR');
        console.log('      2. Export reports for users who have wallets');
      }
    }
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

debugUserPortfolioData();
