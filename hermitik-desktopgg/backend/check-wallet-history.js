const mongoose = require('mongoose');
const WalletData = require('./models/WalletData');
require('dotenv').config();

async function checkWalletHistory() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hermetik');
    console.log('✅ Connected to MongoDB');
    
    const wallets = [
      '0xE71Aa6f45A22Fa1e4C9fB29960248f4A3d4af918',
      '0xbfa2ef4cab56ace20a4e11bb6080a09d126bf5cd'
    ];
    
    console.log(`\n🔍 Checking wallet data history...`);
    
    for (const wallet of wallets) {
      console.log(`\n📊 Wallet: ${wallet}`);
      
      // Get all stored data for this wallet, sorted by timestamp
      const storedDataHistory = await WalletData.find({ 
        walletAddress: wallet 
      }).sort({ timestamp: -1 }).limit(10);
      
      console.log(`   Found ${storedDataHistory.length} stored data entries`);
      
      storedDataHistory.forEach((data, index) => {
        console.log(`   ${index + 1}. ${data.timestamp.toLocaleString()}`);
        console.log(`      Tokens: ${data.tokens?.length || 0}`);
        console.log(`      Protocols: ${data.protocols?.length || 0}`);
        console.log(`      Summary: $${data.summary?.total_usd_value?.toFixed(2) || 0}`);
        
        if (data.tokens && data.tokens.length > 0) {
          console.log(`      Token examples: ${data.tokens.slice(0, 3).map(t => `${t.symbol}: $${t.usd_value}`).join(', ')}`);
        }
        
        if (data.protocols && data.protocols.length > 0) {
          console.log(`      Protocol examples: ${data.protocols.slice(0, 3).map(p => `${p.name}: $${p.net_usd_value}`).join(', ')}`);
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

checkWalletHistory();
