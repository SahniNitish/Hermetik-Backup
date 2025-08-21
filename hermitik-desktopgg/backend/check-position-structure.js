const mongoose = require('mongoose');
const DailySnapshot = require('./models/DailySnapshot');

mongoose.connect('mongodb://localhost:27017/hermetikdb').then(async () => {
  console.log('Connected to MongoDB');
  
  const userId = '689bca849fe4bbc83dc793a2';
  
  // Find snapshots with positions that have values
  const snapshots = await DailySnapshot.find({
    userId: userId,
    'positions.totalUsdValue': { $gt: 0 }
  }).sort({createdAt: -1}).limit(1);
  
  if(snapshots.length > 0) {
    console.log('\nPosition structure:');
    const position = snapshots[0].positions[0];
    console.log(JSON.stringify(position, null, 2));
    
    // Check if the APY service logic would find this position valuable
    const hasPositionsWithValue = snapshots[0].positions.some(pos => 
      pos.totalUsdValue > 0 || 
      (pos.supplyTokens && pos.supplyTokens.some(token => (token.usdValue || (token.amount * token.price)) > 0)) ||
      (pos.rewardTokens && pos.rewardTokens.some(token => (token.usdValue || (token.amount * token.price)) > 0))
    );
    
    console.log('\nAPY service would find this snapshot valuable:', hasPositionsWithValue);
  } else {
    console.log('No snapshots with position values found');
  }
  
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
