/**
 * Test the HistoricalDataService
 */

const mongoose = require('mongoose');
const HistoricalDataService = require('./services/historicalDataService');

async function connectDB() {
  try {
    await mongoose.connect('mongodb://localhost:27017/hermetikdb');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

async function testHistoricalService() {
  try {
    console.log('🧪 Testing HistoricalDataService.getNAVDataForMonth...');
    
    const result = await HistoricalDataService.getNAVDataForMonth(
      '68a1f123f09a6ebb3a9d9c0b',
      2025,
      8 // August (1-based)
    );
    
    console.log('✅ HistoricalDataService result:');
    console.log('- navSettings exists:', !!result.navSettings);
    if (result.navSettings) {
      console.log('- navSettings.navCalculations:');
      console.log('  - investments:', result.navSettings.navCalculations?.investments);
      console.log('  - totalAssets:', result.navSettings.navCalculations?.totalAssets);
      console.log('  - dividendsReceivable:', result.navSettings.navCalculations?.dividendsReceivable);
      console.log('  - preFeeNav:', result.navSettings.navCalculations?.preFeeNav);
      console.log('  - netAssets:', result.navSettings.navCalculations?.netAssets);
      console.log('- navSettings.feeSettings:');
      console.log('  - monthlyExpense:', result.navSettings.feeSettings?.monthlyExpense);
      console.log('  - hurdleRate:', result.navSettings.feeSettings?.hurdleRate);
    }
    
  } catch (error) {
    console.error('❌ HistoricalDataService error:', error.message);
  }
}

async function main() {
  await connectDB();
  await testHistoricalService();
  await mongoose.disconnect();
}

main().catch(console.error);
