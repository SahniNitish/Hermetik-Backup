const mongoose = require('mongoose');
const DailySnapshot = require('./models/DailySnapshot');

mongoose.connect('mongodb://localhost:27017/hermetikdb').then(async () => {
  console.log('Connected to MongoDB');
  
  const userId = '689bca849fe4bbc83dc793a2';
  
  // Get current date in UTC
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  console.log(`\nChecking snapshots for user ${userId}:`);
  console.log('Today (UTC):', today.toISOString());
  console.log('Yesterday (UTC):', yesterday.toISOString());
  
  // Find snapshots for today
  const todaySnapshots = await DailySnapshot.find({
    userId: userId,
    date: { $gte: today }
  }).sort({createdAt: -1});
  
  console.log(`\nFound ${todaySnapshots.length} snapshots for today:`);
  todaySnapshots.forEach((snapshot, i) => {
    console.log(`\nSnapshot ${i+1}:`);
    console.log('  Date:', snapshot.date);
    console.log('  Created:', snapshot.createdAt);
    console.log('  Total positions:', snapshot.positions.length);
    const positionsWithValue = snapshot.positions.filter(pos => pos.totalUsdValue > 0);
    console.log('  Positions with value:', positionsWithValue.length);
    if(positionsWithValue.length > 0) {
      positionsWithValue.forEach((pos, j) => {
        console.log(`    - ${pos.protocolName}: $${pos.totalUsdValue}`);
        // Check for unclaimed rewards
        if(pos.rewardTokens && pos.rewardTokens.length > 0) {
          const totalRewards = pos.rewardTokens.reduce((sum, token) => {
            const tokenValue = token.usdValue || (token.amount * token.price) || 0;
            return sum + tokenValue;
          }, 0);
          console.log(`      Unclaimed rewards: $${totalRewards.toFixed(2)}`);
        }
      });
    } else {
      console.log('  All positions have $0 value');
    }
  });
  
  // Find snapshots for yesterday
  const yesterdaySnapshots = await DailySnapshot.find({
    userId: userId,
    date: { $gte: yesterday, $lt: today }
  }).sort({createdAt: -1});
  
  console.log(`\nFound ${yesterdaySnapshots.length} snapshots for yesterday:`);
  yesterdaySnapshots.forEach((snapshot, i) => {
    console.log(`\nSnapshot ${i+1}:`);
    console.log('  Date:', snapshot.date);
    console.log('  Created:', snapshot.createdAt);
    console.log('  Total positions:', snapshot.positions.length);
    const positionsWithValue = snapshot.positions.filter(pos => pos.totalUsdValue > 0);
    console.log('  Positions with value:', positionsWithValue.length);
    if(positionsWithValue.length > 0) {
      positionsWithValue.forEach((pos, j) => {
        console.log(`    - ${pos.protocolName}: $${pos.totalUsdValue}`);
        // Check for unclaimed rewards
        if(pos.rewardTokens && pos.rewardTokens.length > 0) {
          const totalRewards = pos.rewardTokens.reduce((sum, token) => {
            const tokenValue = token.usdValue || (token.amount * token.price) || 0;
            return sum + tokenValue;
          }, 0);
          console.log(`      Unclaimed rewards: $${totalRewards.toFixed(2)}`);
        }
      });
    } else {
      console.log('  All positions have $0 value');
    }
  });
  
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
