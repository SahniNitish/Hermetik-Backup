const mongoose = require('mongoose');
const WalletData = require('./models/WalletData');
const User = require('./models/User');
require('dotenv').config();

async function checkStoredWalletData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hermetik');
    console.log('✅ Connected to MongoDB');
    
    // Get all stored wallet data
    const allWalletData = await WalletData.find({}).sort({ timestamp: -1 });
    console.log(`\n📊 Found ${allWalletData.length} stored wallet data entries:`);
    
    allWalletData.forEach((data, index) => {
      console.log(`\n${index + 1}. Wallet: ${data.walletAddress}`);
      console.log(`   User ID: ${data.userId}`);
      console.log(`   Timestamp: ${data.timestamp}`);
      console.log(`   Tokens: ${data.tokens?.length || 0}`);
      console.log(`   Protocols: ${data.protocols?.length || 0}`);
      console.log(`   Summary: $${data.summary?.total_usd_value?.toFixed(2) || 0}`);
      
      if (data.tokens && data.tokens.length > 0) {
        console.log('   Token details:');
        data.tokens.forEach(token => {
          console.log(`     - ${token.symbol}: ${token.amount} ($${token.usd_value})`);
        });
      }
      
      if (data.protocols && data.protocols.length > 0) {
        console.log('   Protocol details:');
        data.protocols.forEach(protocol => {
          console.log(`     - ${protocol.name}: $${protocol.net_usd_value}`);
        });
      }
    });
    
    // Check specific wallet that should have data
    const specificWallet = await WalletData.findOne({ 
      walletAddress: '0x7e73dA415Af2BBCC11f45aeEf7F2cA60222EC736' 
    }).sort({ timestamp: -1 });
    
    if (specificWallet) {
      console.log(`\n🔍 Specific wallet 0x7e73dA415Af2BBCC11f45aeEf7F2cA60222EC736:`);
      console.log(`   Tokens: ${specificWallet.tokens?.length || 0}`);
      console.log(`   Protocols: ${specificWallet.protocols?.length || 0}`);
      console.log(`   Summary: $${specificWallet.summary?.total_usd_value?.toFixed(2) || 0}`);
    } else {
      console.log('\n❌ No stored data found for wallet 0x7e73dA415Af2BBCC11f45aeEf7F2cA60222EC736');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

checkStoredWalletData();
