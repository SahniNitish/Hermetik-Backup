/**
 * Database Optimization Script
 * Creates indexes and optimizes database performance
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const WalletData = require('../models/WalletData');
const DailySnapshot = require('../models/DailySnapshot');

dotenv.config();

async function optimizeDatabase() {
  try {
    console.log('🚀 Starting database optimization...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Helper function to create index safely
    const createIndexSafely = async (collection, indexSpec, options = {}) => {
      try {
        await collection.createIndex(indexSpec, options);
        return true;
      } catch (error) {
        if (error.code === 86 || error.code === 85) { // IndexKeySpecsConflict or IndexOptionsConflict
          console.log(`⚠️  Index already exists for ${JSON.stringify(indexSpec)}: ${error.errmsg}`);
          return false;
        }
        throw error;
      }
    };

    // Create indexes for User model
    console.log('\n📊 Creating User indexes...');
    await createIndexSafely(User.collection, { email: 1 }, { unique: true });
    await createIndexSafely(User.collection, { role: 1 });
    await createIndexSafely(User.collection, { createdAt: -1 });
    console.log('✅ User indexes created');

    // Create indexes for WalletData model
    console.log('\n📊 Creating WalletData indexes...');
    await createIndexSafely(WalletData.collection, { walletAddress: 1 });
    await createIndexSafely(WalletData.collection, { userId: 1 });
    await createIndexSafely(WalletData.collection, { timestamp: -1 });
    await createIndexSafely(WalletData.collection, { userId: 1, walletAddress: 1 });
    await createIndexSafely(WalletData.collection, { userId: 1, timestamp: -1 });
    await createIndexSafely(WalletData.collection, { walletAddress: 1, timestamp: -1 });
    
    // Compound index for efficient queries
    await createIndexSafely(WalletData.collection, { 
      userId: 1, 
      walletAddress: 1, 
      timestamp: -1 
    }, { name: 'user_wallet_timestamp_compound' });
    
    // Index for stored data with content
    await createIndexSafely(WalletData.collection, { 
      'tokens.0': 1 
    }, { 
      sparse: true,
      name: 'tokens_exists'
    });
    
    await createIndexSafely(WalletData.collection, { 
      'protocols.0': 1 
    }, { 
      sparse: true,
      name: 'protocols_exists'
    });
    
    console.log('✅ WalletData indexes created');

    // Create indexes for DailySnapshot model
    console.log('\n📊 Creating DailySnapshot indexes...');
    await createIndexSafely(DailySnapshot.collection, { userId: 1 });
    await createIndexSafely(DailySnapshot.collection, { date: -1 });
    await createIndexSafely(DailySnapshot.collection, { userId: 1, date: -1 }, { name: 'user_date_unique' });
    await createIndexSafely(DailySnapshot.collection, { 'portfolio.totalValue': -1 }, { name: 'portfolio_value' });
    console.log('✅ DailySnapshot indexes created');

    // Create text indexes for search functionality
    console.log('\n🔍 Creating text search indexes...');
    await createIndexSafely(WalletData.collection, {
      'tokens.name': 'text',
      'tokens.symbol': 'text',
      'protocols.name': 'text'
    }, {
      name: 'wallet_content_text_search'
    });
    console.log('✅ Text search indexes created');

    // Get index information
    console.log('\n📈 Database optimization complete!');
    
    const userIndexes = await User.collection.indexes();
    const walletDataIndexes = await WalletData.collection.indexes();
    const snapshotIndexes = await DailySnapshot.collection.indexes();
    
    console.log('\n📋 Index Summary:');
    console.log(`User indexes: ${userIndexes.length}`);
    console.log(`WalletData indexes: ${walletDataIndexes.length}`);
    console.log(`DailySnapshot indexes: ${snapshotIndexes.length}`);
    
    // Get collection stats
    console.log('\n📊 Collection Statistics:');
    const userCount = await User.countDocuments();
    const walletCount = await WalletData.countDocuments();
    const snapshotCount = await DailySnapshot.countDocuments();
    
    console.log(`Users: ${userCount} documents`);
    console.log(`WalletData: ${walletCount} documents`);
    console.log(`DailySnapshots: ${snapshotCount} documents`);
    
    console.log('\n🎉 Database optimization completed successfully!');
    
  } catch (error) {
    console.error('❌ Database optimization failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

// Run optimization if called directly
if (require.main === module) {
  optimizeDatabase();
}

module.exports = { optimizeDatabase };
