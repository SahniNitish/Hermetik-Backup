const mongoose = require('mongoose');
const WalletData = require('./models/WalletData');
require('dotenv').config();

async function debugProtocolSearch() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hermetik');
    console.log('✅ Connected to MongoDB');
    
    const wallet = '0x7e73dA415Af2BBCC11f45aeEf7F2cA60222EC736';
    
    console.log('\n🔍 Testing different protocol search queries...');
    
    // Test 1: Look for any protocols (should find the data from Aug 23rd)
    console.log('\n1. Looking for any protocols...');
    const anyProtocols = await WalletData.findOne({ 
      walletAddress: wallet,
      'protocols.0': { $exists: true }
    }).sort({ timestamp: -1 });
    
    if (anyProtocols) {
      console.log(`✅ Found data with protocols: ${anyProtocols.protocols.length} protocols from ${anyProtocols.timestamp.toLocaleString()}`);
      console.log('   Protocols:');
      anyProtocols.protocols.forEach(p => {
        console.log(`     - ${p.name}: $${p.net_usd_value?.toFixed(2) || 0}`);
      });
    } else {
      console.log('❌ No protocols found');
    }
    
    // Test 2: Check all entries for this wallet
    console.log('\n2. All entries for this wallet:');
    const allEntries = await WalletData.find({ 
      walletAddress: wallet
    }).sort({ timestamp: -1 }).limit(15);
    
    console.log(`Found ${allEntries.length} total entries:`);
    allEntries.forEach((entry, index) => {
      console.log(`   ${index + 1}. ${entry.timestamp.toLocaleString()}: ${entry.tokens?.length || 0} tokens, ${entry.protocols?.length || 0} protocols`);
      if (entry.protocols && entry.protocols.length > 0) {
        entry.protocols.forEach(p => {
          console.log(`      - ${p.name}: $${p.net_usd_value?.toFixed(2) || 0}`);
        });
      }
    });
    
    // Test 3: Check what the current query is actually returning
    console.log('\n3. Testing current fallback logic:');
    
    // First try to find data with protocols (higher priority)
    let storedWallet = await WalletData.findOne({ 
      walletAddress: wallet,
      'protocols.0': { $exists: true }  // Has at least one protocol
    }).sort({ timestamp: -1 });
    
    if (storedWallet) {
      console.log(`✅ First query found: ${storedWallet.protocols.length} protocols from ${storedWallet.timestamp.toLocaleString()}`);
    } else {
      console.log('❌ First query found no protocols');
      
      // If no protocol data found, fallback to any data with content
      storedWallet = await WalletData.findOne({ 
        walletAddress: wallet,
        $or: [
          { 'tokens.0': { $exists: true } },  // Has at least one token
          { 'protocols.0': { $exists: true } }  // Has at least one protocol
        ]
      }).sort({ timestamp: -1 });
      
      if (storedWallet) {
        console.log(`✅ Fallback query found: ${storedWallet.tokens?.length || 0} tokens, ${storedWallet.protocols?.length || 0} protocols from ${storedWallet.timestamp.toLocaleString()}`);
      } else {
        console.log('❌ No data found at all');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

debugProtocolSearch();
