const mongoose = require('mongoose');
const WalletData = require('./models/WalletData');
require('dotenv').config();

async function debugStoredData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hermetik');
    console.log('✅ Connected to MongoDB');
    
    const wallets = [
      '0xE71Aa6f45A22Fa1e4C9fB29960248f4A3d4af918',
      '0xbfa2ef4cab56ace20a4e11bb6080a09d126bf5cd'
    ];
    
    console.log(`\n🔍 Debugging stored data queries...`);
    
    for (const wallet of wallets) {
      console.log(`\n📊 Wallet: ${wallet}`);
      
      // Test 1: Find ALL stored data for this wallet (any user)
      const allStoredData = await WalletData.find({ 
        walletAddress: wallet 
      }).sort({ timestamp: -1 }).limit(5);
      
      console.log(`   Test 1 - All stored data for wallet: ${allStoredData.length} entries`);
      allStoredData.forEach((data, index) => {
        console.log(`     ${index + 1}. User: ${data.userId}, Tokens: ${data.tokens?.length || 0}, Protocols: ${data.protocols?.length || 0}, Value: $${data.summary?.total_usd_value?.toFixed(2) || 0}`);
      });
      
      // Test 2: Find stored data with content for this wallet (any user)
      const storedDataWithContent = await WalletData.find({ 
        walletAddress: wallet,
        $or: [
          { 'tokens.0': { $exists: true } },
          { 'protocols.0': { $exists: true } }
        ]
      }).sort({ timestamp: -1 }).limit(5);
      
      console.log(`   Test 2 - Stored data with content: ${storedDataWithContent.length} entries`);
      storedDataWithContent.forEach((data, index) => {
        console.log(`     ${index + 1}. User: ${data.userId}, Tokens: ${data.tokens?.length || 0}, Protocols: ${data.protocols?.length || 0}, Value: $${data.summary?.total_usd_value?.toFixed(2) || 0}`);
      });
      
      // Test 3: Find stored data for specific user (user4@hermetik.com - ID: 688c0768f66b25215db90547)
      const userStoredData = await WalletData.find({ 
        userId: '688c0768f66b25215db90547',
        walletAddress: wallet
      }).sort({ timestamp: -1 }).limit(5);
      
      console.log(`   Test 3 - Stored data for user 688c0768f66b25215db90547: ${userStoredData.length} entries`);
      userStoredData.forEach((data, index) => {
        console.log(`     ${index + 1}. Tokens: ${data.tokens?.length || 0}, Protocols: ${data.protocols?.length || 0}, Value: $${data.summary?.total_usd_value?.toFixed(2) || 0}`);
      });
      
      // Test 4: Find stored data with content for specific user
      const userStoredDataWithContent = await WalletData.find({ 
        userId: '688c0768f66b25215db90547',
        walletAddress: wallet,
        $or: [
          { 'tokens.0': { $exists: true } },
          { 'protocols.0': { $exists: true } }
        ]
      }).sort({ timestamp: -1 }).limit(5);
      
      console.log(`   Test 4 - User stored data with content: ${userStoredDataWithContent.length} entries`);
      userStoredDataWithContent.forEach((data, index) => {
        console.log(`     ${index + 1}. Tokens: ${data.tokens?.length || 0}, Protocols: ${data.protocols?.length || 0}, Value: $${data.summary?.total_usd_value?.toFixed(2) || 0}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

debugStoredData();
