// Quick way to check recent snapshots without API
const mongoose = require('mongoose');
const DailySnapshot = require('./models/DailySnapshot');

async function quickSnapshotCheck() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hermetikdb');
    
    console.log('📸 RECENT SNAPSHOTS (Last 24 hours):');
    console.log('=====================================');
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const recentSnapshots = await DailySnapshot
      .find({ date: { $gte: yesterday } })
      .sort({ date: -1, createdAt: -1 })
      .limit(10);
    
    if (recentSnapshots.length === 0) {
      console.log('❌ No snapshots found in last 24 hours');
      console.log('💡 Try opening a profile or fetching wallet data to create snapshots');
    } else {
      recentSnapshots.forEach((snapshot, idx) => {
        const time = new Date(snapshot.createdAt || snapshot.date).toLocaleString();
        console.log(`${idx + 1}. ${time}`);
        console.log(`   User: ${snapshot.userId}`);
        console.log(`   Wallet: ${snapshot.walletAddress}`);
        console.log(`   NAV: $${snapshot.totalNavUsd?.toFixed(2) || 0}`);
        console.log(`   Positions: ${snapshot.positions?.length || 0}`);
        console.log(`   Created: ${snapshot.createdAt ? 'Just now' : 'Existing'}`);
        console.log('');
      });
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await mongoose.disconnect();
  }
}

// Run it
quickSnapshotCheck();

// Also export for reuse
module.exports = quickSnapshotCheck;