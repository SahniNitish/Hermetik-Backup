const mongoose = require('mongoose');
require('dotenv').config();
const APYCalculationService = require('./services/apyCalculationService');

async function testFullAPYFlow() {
  try {
    console.log('🔍 Testing complete APY flow...');
    
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    
    const testUserId = '689bca849fe4bbc83dc793a2';
    const targetDate = new Date();
    
    console.log(`\n📊 Testing APY calculation for user: ${testUserId}`);
    
    // Test APY calculation
    const apyResults = await APYCalculationService.calculateAllPositionAPYs(testUserId, targetDate);
    
    console.log(`\n📈 APY Results (${Object.keys(apyResults).length} positions):`);
    
    // Format results like the API would
    const formattedResults = {};
    Object.entries(apyResults).forEach(([positionId, apyData]) => {
      const formatted = APYCalculationService.formatAPYForDisplay(apyData);
      if (formatted) {
        formattedResults[positionId] = formatted;
      }
    });
    
    console.log('\n📊 Formatted results for frontend:');
    Object.entries(formattedResults).forEach(([id, data]) => {
      console.log(`- ${id}: ${data.formattedAPY} (${data.formattedValue})`);
    });
    
    // Test average calculation (like Dashboard does)
    const apyValues = Object.values(formattedResults)
      .filter(apy => apy.apy !== null && apy.apy !== undefined)
      .map(apy => apy.apy);
    
    const avgApy = apyValues.length > 0 
      ? apyValues.reduce((sum, apy) => sum + apy, 0) / apyValues.length 
      : 0;
    
    console.log(`\n🎯 Dashboard Average APY: ${avgApy >= 0 ? '+' : ''}${avgApy.toFixed(2)}%`);
    console.log(`🎯 Position Count: ${Object.keys(formattedResults).length}`);
    
    // Create API response format
    const apiResponse = {
      success: true,
      data: {
        userId: testUserId,
        targetDate: targetDate,
        positions: formattedResults,
        positionCount: Object.keys(formattedResults).length
      },
      message: 'APY calculations retrieved successfully'
    };
    
    console.log('\n🚀 Complete API Response:');
    console.log(JSON.stringify(apiResponse, null, 2));
    
    console.log('\n✅ Full APY flow working! Ready for Dashboard integration.');
    
  } catch (error) {
    console.error('❌ APY Flow Error:', error);
    console.error('Stack:', error.stack);
  } finally {
    process.exit(0);
  }
}

testFullAPYFlow();