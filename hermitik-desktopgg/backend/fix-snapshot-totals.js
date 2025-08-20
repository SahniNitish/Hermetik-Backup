const mongoose = require('mongoose');
require('dotenv').config();
const DailySnapshot = require('./models/DailySnapshot');

async function fixSnapshotTotals() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('🔗 Connected to MongoDB');
    
    // Get all snapshots that need fixing (no totalUsdValue on positions)
    const snapshots = await DailySnapshot.find({
      'positions.totalUsdValue': { $exists: false }
    });
    
    console.log(`📊 Found ${snapshots.length} snapshots to fix`);
    
    for (const snapshot of snapshots) {
      let modified = false;
      
      for (const position of snapshot.positions) {
        if (!position.totalUsdValue) {
          // Calculate totalUsdValue from tokens
          const supplyValue = (position.supplyTokens || []).reduce((sum, token) => {
            const value = (token.amount || 0) * (token.price || 0);
            return sum + value;
          }, 0);
          
          const rewardValue = (position.rewardTokens || []).reduce((sum, token) => {
            const value = (token.amount || 0) * (token.price || 0);
            return sum + value;
          }, 0);
          
          position.totalUsdValue = supplyValue + rewardValue;
          
          // Also set usdValue on individual tokens if missing
          (position.supplyTokens || []).forEach(token => {
            if (!token.usdValue) {
              token.usdValue = (token.amount || 0) * (token.price || 0);
            }
          });
          
          (position.rewardTokens || []).forEach(token => {
            if (!token.usdValue) {
              token.usdValue = (token.amount || 0) * (token.price || 0);
            }
          });
          
          modified = true;
        }
      }
      
      if (modified) {
        await snapshot.save();
        console.log(`✅ Fixed snapshot for user ${snapshot.userId} on ${snapshot.date}`);
      }
    }
    
    console.log('🎉 All snapshots fixed!');
    
  } catch (error) {
    console.error('❌ Error fixing snapshots:', error);
  } finally {
    process.exit(0);
  }
}

fixSnapshotTotals();