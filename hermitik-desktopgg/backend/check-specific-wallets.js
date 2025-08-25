const mongoose = require('mongoose');
const WalletData = require('./models/WalletData');
require('dotenv').config();

async function checkSpecificWallets() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hermetik');
    console.log('✅ Connected to MongoDB');
    
    const wallets = [
      '0xE71Aa6f45A22Fa1e4C9fB29960248f4A3d4af918',
      '0xbfa2ef4cab56ace20a4e11bb6080a09d126bf5cd'
    ];
    
    console.log(`\n🔍 Checking stored data for specific wallets...`);
    
    for (const wallet of wallets) {
      console.log(`\n📊 Wallet: ${wallet}`);
      
      // Get the most recent stored data for this wallet
      const storedData = await WalletData.findOne({ 
        walletAddress: wallet 
      }).sort({ timestamp: -1 });
      
      if (storedData) {
        console.log(`   Found stored data from: ${storedData.timestamp}`);
        console.log(`   Tokens: ${storedData.tokens?.length || 0}`);
        console.log(`   Protocols: ${storedData.protocols?.length || 0}`);
        console.log(`   Summary: $${storedData.summary?.total_usd_value?.toFixed(2) || 0}`);
        
        if (storedData.tokens && storedData.tokens.length > 0) {
          console.log('   Token details:');
          storedData.tokens.forEach(token => {
            console.log(`     - ${token.symbol}: ${token.amount} ($${token.usd_value})`);
          });
        }
        
        if (storedData.protocols && storedData.protocols.length > 0) {
          console.log('   Protocol details:');
          storedData.protocols.forEach(protocol => {
            console.log(`     - ${protocol.name}: $${protocol.net_usd_value}`);
          });
        }
      } else {
        console.log(`   ❌ No stored data found`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

checkSpecificWallets();
