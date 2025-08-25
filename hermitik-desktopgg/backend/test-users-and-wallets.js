const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function testUsersAndWallets() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hermetik');
    console.log('✅ Connected to MongoDB');
    
    // Get all users
    const users = await User.find({});
    console.log(`\n📊 Found ${users.length} users in database:`);
    
    users.forEach((user, index) => {
      console.log(`\n${index + 1}. User: ${user.name} (${user.email})`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Wallets: ${user.wallets.length}`);
      if (user.wallets.length > 0) {
        user.wallets.forEach((wallet, walletIndex) => {
          console.log(`     ${walletIndex + 1}. ${wallet}`);
        });
      } else {
        console.log('     ❌ No wallets found');
      }
    });
    
    // Test login for a user with wallets
    const userWithWallets = users.find(u => u.wallets.length > 0);
    if (userWithWallets) {
      console.log(`\n🔍 Testing with user: ${userWithWallets.name} (${userWithWallets.email})`);
      console.log(`   Has ${userWithWallets.wallets.length} wallets`);
    } else {
      console.log('\n❌ No users with wallets found!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

testUsersAndWallets();
