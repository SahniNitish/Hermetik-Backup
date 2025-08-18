const mongoose = require('mongoose');
const PositionHistory = require('./models/PositionHistory');
const APYCalculationService = require('./services/apyCalculationService');

async function testAPYAPI() {
  try {
    // Connect to MongoDB (use your actual connection string)
    await mongoose.connect('mongodb://localhost:27017/hermetik');
    console.log('Connected to MongoDB');

    // Find a user with position data
    const samplePosition = await PositionHistory.findOne({}).sort({ date: -1 });
    if (!samplePosition) {
      console.log('No position data found');
      return;
    }

    const userId = samplePosition.userId;
    console.log(`Testing APY API for user: ${userId}`);

    // Test the APY calculation service directly
    console.log('\n=== Testing APY Calculation Service ===');
    const apyResults = await APYCalculationService.calculateAllPositionAPYs(userId);
    
    console.log('Raw APY Results:');
    console.log(JSON.stringify(apyResults, null, 2));

    // Test the formatted results
    console.log('\n=== Testing Formatted Results ===');
    const formattedResults = {};
    Object.entries(apyResults).forEach(([positionId, apyData]) => {
      formattedResults[positionId] = APYCalculationService.formatAPYForDisplay(apyData);
    });

    console.log('Formatted APY Results:');
    console.log(JSON.stringify(formattedResults, null, 2));

    // Test the API response format
    console.log('\n=== Testing API Response Format ===');
    const apiResponse = {
      userId,
      targetDate: new Date(),
      positions: formattedResults,
      positionCount: Object.keys(formattedResults).length,
      success: true
    };

    console.log('API Response:');
    console.log(JSON.stringify(apiResponse, null, 2));

  } catch (error) {
    console.error('Error testing APY API:', error);
  } finally {
    await mongoose.disconnect();
  }
}

testAPYAPI();