const mongoose = require('mongoose');
require('dotenv').config();
const DailyDataCollectionService = require('./services/dailyDataCollection');

async function debugPositions() {
  try {
    console.log('🔍 Debug: Testing position creation...');
    
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    
    // Test with a single wallet to see what happens
    const testUserId = '689bca849fe4bbc83dc793a2';
    const testWallet = '0x14B5AbD73626a0c1182a6E7DEdB54d3dea1D3a14';
    
    console.log(`Testing wallet: ${testWallet}`);
    
    // Call the data collection directly
    console.log('🚀 Starting data collection...');
    const result = await DailyDataCollectionService.processWallet(testUserId, testWallet);
    
    console.log('📊 Result summary:');
    console.log('- totalNavUsd:', result.totalNavUsd);
    console.log('- positions count:', result.positions?.length || 0);
    
    if (result.positions?.length > 0) {
      console.log('\n🎯 Position details:');
      result.positions.forEach((pos, i) => {
        console.log(`Position ${i + 1}:`);
        console.log('  - Protocol:', pos.protocolName);
        console.log('  - totalUsdValue:', pos.totalUsdValue);
        console.log('  - supplyTokens:', pos.supplyTokens?.length || 0);
        console.log('  - rewardTokens:', pos.rewardTokens?.length || 0);
        
        if (pos.supplyTokens?.length > 0) {
          console.log('  - First supply token:', {
            symbol: pos.supplyTokens[0].symbol,
            usdValue: pos.supplyTokens[0].usdValue
          });
        }
        
        if (pos.rewardTokens?.length > 0) {
          console.log('  - First reward token:', {
            symbol: pos.rewardTokens[0].symbol,
            usdValue: pos.rewardTokens[0].usdValue
          });
        }
      });
    } else {
      console.log('❌ No positions found in result');
    }
    
  } catch (error) {
    console.error('❌ Debug Error:', error);
    console.error('Stack:', error.stack);
  } finally {
    process.exit(0);
  }
}

debugPositions();