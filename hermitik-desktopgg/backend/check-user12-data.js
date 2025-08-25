const mongoose = require('mongoose');
const User = require('./models/User');
const WalletData = require('./models/WalletData');
require('dotenv').config();

async function checkUser12Data() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hermetik');
    console.log('✅ Connected to MongoDB');
    
    // Find user12
    const user12 = await User.findOne({ email: 'user12@hermetik.com' });
    if (!user12) {
      console.log('❌ user12@hermetik.com not found');
      return;
    }
    
    console.log('\n📊 User12 Details:');
    console.log(`   ID: ${user12._id}`);
    console.log(`   Name: ${user12.name}`);
    console.log(`   Email: ${user12.email}`);
    console.log(`   Wallets: ${user12.wallets?.length || 0}`);
    
    if (user12.wallets && user12.wallets.length > 0) {
      console.log('   Wallet addresses:');
      user12.wallets.forEach((wallet, index) => {
        console.log(`     ${index + 1}. ${wallet}`);
      });
    }
    
    // Check stored wallet data for user12
    console.log('\n🔍 Checking stored wallet data for user12...');
    
    const storedData = await WalletData.find({ 
      userId: user12._id.toString()
    }).sort({ timestamp: -1 }).limit(10);
    
    console.log(`\n📦 Found ${storedData.length} stored wallet data entries:`);
    
    storedData.forEach((data, index) => {
      console.log(`\n${index + 1}. Wallet: ${data.walletAddress}`);
      console.log(`   Timestamp: ${data.timestamp.toLocaleString()}`);
      console.log(`   Tokens: ${data.tokens?.length || 0}`);
      console.log(`   Protocols: ${data.protocols?.length || 0}`);
      console.log(`   Total Value: $${data.summary?.total_usd_value?.toFixed(2) || 0}`);
      
      if (data.protocols && data.protocols.length > 0) {
        console.log('   Protocol details:');
        data.protocols.forEach((protocol, pIndex) => {
          console.log(`     ${pIndex + 1}. ${protocol.name}: $${protocol.net_usd_value?.toFixed(2) || 0}`);
          console.log(`        Chain: ${protocol.chain || 'unknown'}`);
          console.log(`        Protocol ID: ${protocol.protocol_id || 'unknown'}`);
          if (protocol.positions && protocol.positions.length > 0) {
            console.log(`        Positions: ${protocol.positions.length}`);
            protocol.positions.forEach((pos, posIndex) => {
              console.log(`          ${posIndex + 1}. ${pos.name || 'Unknown'}: $${pos.net_usd_value?.toFixed(2) || 0}`);
            });
          }
        });
      }
      
      if (data.tokens && data.tokens.length > 0) {
        console.log('   Token details:');
        data.tokens.slice(0, 5).forEach((token, tIndex) => {
          console.log(`     ${tIndex + 1}. ${token.symbol}: ${token.amount} ($${token.usd_value?.toFixed(2) || 0})`);
        });
      }
    });
    
    // Check for specific protocols
    console.log('\n🔍 Searching for Convex and Uniswap protocols...');
    
    const convexData = await WalletData.find({
      userId: user12._id.toString(),
      'protocols.name': { $regex: /convex/i }
    }).sort({ timestamp: -1 }).limit(5);
    
    const uniswapData = await WalletData.find({
      userId: user12._id.toString(),
      'protocols.name': { $regex: /uniswap/i }
    }).sort({ timestamp: -1 }).limit(5);
    
    console.log(`\n🎯 Convex entries found: ${convexData.length}`);
    convexData.forEach((data, index) => {
      const convexProtocols = data.protocols.filter(p => /convex/i.test(p.name));
      console.log(`   ${index + 1}. ${data.timestamp.toLocaleString()}: ${convexProtocols.length} Convex protocols`);
      convexProtocols.forEach(p => {
        console.log(`      - ${p.name}: $${p.net_usd_value?.toFixed(2) || 0}`);
      });
    });
    
    console.log(`\n🦄 Uniswap entries found: ${uniswapData.length}`);
    uniswapData.forEach((data, index) => {
      const uniswapProtocols = data.protocols.filter(p => /uniswap/i.test(p.name));
      console.log(`   ${index + 1}. ${data.timestamp.toLocaleString()}: ${uniswapProtocols.length} Uniswap protocols`);
      uniswapProtocols.forEach(p => {
        console.log(`      - ${p.name}: $${p.net_usd_value?.toFixed(2) || 0}`);
      });
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

checkUser12Data();
