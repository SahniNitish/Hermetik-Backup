const mongoose = require('mongoose');
const PositionHistory = require('./models/PositionHistory');

async function testImprovedAPY() {
  try {
    await mongoose.connect('mongodb://localhost:27017/hermetik');
    console.log('Connected to MongoDB');

    // Test the improved APY calculation
    const testUserId = '6873cdf90688a80b7bea4a45';
    
    console.log('🧪 Testing improved APY calculation...');
    
    // Test different scenarios
    const testCases = [
      {
        name: 'Reasonable daily return (0.25%)',
        positionValue: 10000,
        rewardsValue: 25,
        expectedDailyReturn: 0.25
      },
      {
        name: 'High daily return (1.5%)', 
        positionValue: 5000,
        rewardsValue: 75,
        expectedDailyReturn: 1.5
      },
      {
        name: 'Very high daily return (10%)',
        positionValue: 1000,
        rewardsValue: 100,
        expectedDailyReturn: 10
      },
      {
        name: 'Zero rewards',
        positionValue: 5000,
        rewardsValue: 0,
        expectedDailyReturn: 0
      },
      {
        name: 'Negative return',
        positionValue: 5000,
        rewardsValue: -50,
        expectedDailyReturn: -1
      }
    ];
    
    for (const testCase of testCases) {
      console.log(`\n📊 Testing: ${testCase.name}`);
      console.log(`Position: $${testCase.positionValue}, Rewards: $${testCase.rewardsValue}`);
      
      const dailyReturn = testCase.rewardsValue / testCase.positionValue;
      const dailyReturnPercent = dailyReturn * 100;
      
      // Apply the new compound formula logic
      let confidence = 'high';
      let warnings = [];
      
      if (dailyReturnPercent > 5) {
        confidence = 'low';
        warnings.push(`Daily return of ${dailyReturnPercent.toFixed(2)}% seems unrealistically high`);
      } else if (dailyReturnPercent > 1) {
        confidence = 'medium';
        warnings.push(`Daily return of ${dailyReturnPercent.toFixed(2)}% is quite high, please verify`);
      }
      
      if (dailyReturnPercent < 0) {
        confidence = 'low';
        warnings.push(`Negative daily return of ${dailyReturnPercent.toFixed(2)}% - position may be losing value`);
      }
      
      let compoundAPY = 0;
      let method = 'compound_formula';
      
      if (dailyReturn > -1 && dailyReturn < 100) {
        // Proper compound APY formula: (1 + daily_return)^365 - 1
        compoundAPY = (Math.pow(1 + dailyReturn, 365) - 1) * 100;
        
        if (compoundAPY > 1000) {
          compoundAPY = Math.min(compoundAPY, 1000);
          confidence = 'low';
          warnings.push('APY capped at 1000% due to extreme daily returns');
          method = 'capped_compound';
        }
      } else {
        // Fallback for extreme cases
        compoundAPY = dailyReturnPercent * 365;
        confidence = 'low';
        warnings.push('Using simple annualization due to extreme values');
        method = 'simple_annualization';
      }
      
      console.log(`Daily Return: ${dailyReturnPercent.toFixed(4)}%`);
      console.log(`OLD Simple APY: ${(dailyReturnPercent * 365).toFixed(2)}%`);
      console.log(`NEW Compound APY: ${compoundAPY.toFixed(2)}%`);
      console.log(`Confidence: ${confidence}`);
      console.log(`Method: ${method}`);
      if (warnings.length > 0) {
        console.log(`Warnings: ${warnings.join(', ')}`);
      }
    }
    
    console.log('\n🎯 Real Database Test with existing positions...');
    
    // Test with actual database positions
    const positions = await PositionHistory.find({ userId: testUserId }).limit(2);
    
    for (const position of positions) {
      console.log(`\n📈 Testing position: ${position.protocolName}/${position.positionName}`);
      
      const apyResults = await PositionHistory.calculatePositionAPY(
        testUserId, 
        position.debankPositionId
      );
      
      if (apyResults.daily) {
        console.log('APY Results:', JSON.stringify(apyResults.daily, null, 2));
      } else {
        console.log('No APY results found');
      }
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error testing improved APY:', error);
  }
}

testImprovedAPY();