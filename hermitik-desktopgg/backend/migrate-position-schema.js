// Migration script to update PositionHistory schema from old to new format
const mongoose = require('mongoose');
require('dotenv').config();

// Database connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hermetik');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
};

// Migration function
const migratePositionSchema = async () => {
  try {
    console.log('🔄 Starting PositionHistory schema migration...');
    
    // Get the collection directly
    const db = mongoose.connection.db;
    const collection = db.collection('positionhistories');
    
    // Check if collection exists and has data
    const documentCount = await collection.countDocuments();
    console.log(`📊 Found ${documentCount} documents to migrate`);
    
    if (documentCount === 0) {
      console.log('⚠️  No documents found. Creating sample data for testing...');
      await createSampleData(collection);
      return;
    }
    
    // Check current schema format
    const sampleDoc = await collection.findOne();
    console.log('🔍 Current document structure:', Object.keys(sampleDoc));
    
    let migratedCount = 0;
    let skippedCount = 0;
    
    // Migration operations
    const updates = [];
    
    // Find documents with old schema (has positionId but no debankPositionId)
    const documentsToMigrate = await collection.find({
      positionId: { $exists: true },
      debankPositionId: { $exists: false }
    }).toArray();
    
    console.log(`🎯 Found ${documentsToMigrate.length} documents to migrate`);
    
    for (const doc of documentsToMigrate) {
      const updateOperations = {};
      
      // 1. Rename positionId to debankPositionId
      if (doc.positionId) {
        updateOperations.$set = updateOperations.$set || {};
        updateOperations.$set.debankPositionId = doc.positionId;
        updateOperations.$unset = updateOperations.$unset || {};
        updateOperations.$unset.positionId = '';
      }
      
      // 2. Calculate and set unclaimedRewardsValue
      let unclaimedRewardsValue = 0;
      if (doc.rewards && Array.isArray(doc.rewards)) {
        unclaimedRewardsValue = doc.rewards.reduce((sum, reward) => {
          return sum + (reward.usd_value || 0);
        }, 0);
      }
      updateOperations.$set = updateOperations.$set || {};
      updateOperations.$set.unclaimedRewardsValue = unclaimedRewardsValue;
      
      // 3. Remove old session-related fields
      updateOperations.$unset = updateOperations.$unset || {};
      updateOperations.$unset.sessionId = '';
      updateOperations.$unset.sessionStartDate = '';
      
      // Add to batch updates
      updates.push({
        updateOne: {
          filter: { _id: doc._id },
          update: updateOperations
        }
      });
      
      migratedCount++;
    }
    
    // Execute batch update
    if (updates.length > 0) {
      console.log(`⚡ Executing batch update for ${updates.length} documents...`);
      const result = await collection.bulkWrite(updates);
      console.log(`✅ Migration completed:`, {
        matched: result.matchedCount,
        modified: result.modifiedCount,
        migrated: migratedCount
      });
    }
    
    // Verify migration
    const verifyCount = await collection.countDocuments({
      debankPositionId: { $exists: true },
      unclaimedRewardsValue: { $exists: true }
    });
    
    console.log(`🔍 Verification: ${verifyCount} documents now have new schema`);
    
    // Show sample migrated document
    const sampleMigrated = await collection.findOne({
      debankPositionId: { $exists: true }
    });
    
    if (sampleMigrated) {
      console.log('📋 Sample migrated document:', {
        debankPositionId: sampleMigrated.debankPositionId,
        unclaimedRewardsValue: sampleMigrated.unclaimedRewardsValue,
        totalValue: sampleMigrated.totalValue,
        protocolName: sampleMigrated.protocolName,
        hasOldFields: {
          positionId: !!sampleMigrated.positionId,
          sessionId: !!sampleMigrated.sessionId
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
};

// Create sample data for testing if no existing data
const createSampleData = async (collection) => {
  const sampleData = [
    {
      userId: new mongoose.Types.ObjectId(),
      walletAddress: '0x742d35cc6aa09e95df0b7d38d618c7b76d46db12',
      protocolName: 'Uniswap V3',
      positionName: 'ETH/USDC LP',
      debankPositionId: 'uniswap_v3_eth_usdc_001',
      date: new Date(),
      totalValue: 5000,
      unclaimedRewardsValue: 75,
      tokens: [
        { symbol: 'ETH', amount: 1.5, usd_value: 3000 },
        { symbol: 'USDC', amount: 2000, usd_value: 2000 }
      ],
      rewards: [
        { symbol: 'UNI', amount: 15, usd_value: 75 }
      ],
      isActive: true,
      protocolData: { originalData: {} },
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      userId: new mongoose.Types.ObjectId(),
      walletAddress: '0x742d35cc6aa09e95df0b7d38d618c7b76d46db12',
      protocolName: 'Compound',
      positionName: 'USDC Lending',
      debankPositionId: 'compound_usdc_lending_001',
      date: new Date(),
      totalValue: 10000,
      unclaimedRewardsValue: 25,
      tokens: [
        { symbol: 'cUSDC', amount: 5000, usd_value: 10000 }
      ],
      rewards: [
        { symbol: 'COMP', amount: 0.5, usd_value: 25 }
      ],
      isActive: true,
      protocolData: { originalData: {} },
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];
  
  const result = await collection.insertMany(sampleData);
  console.log(`✅ Created ${result.insertedCount} sample documents for testing`);
  
  // Show expected APY calculations
  sampleData.forEach((doc, index) => {
    const expectedAPY = (doc.unclaimedRewardsValue / doc.totalValue) * 365 * 100;
    console.log(`📊 Sample ${index + 1} Expected APY: ${expectedAPY.toFixed(2)}%`);
    console.log(`   Formula: (${doc.unclaimedRewardsValue} / ${doc.totalValue}) * 365 * 100`);
  });
};

// Run migration
const runMigration = async () => {
  try {
    await connectDB();
    await migratePositionSchema();
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Restart your backend server');
    console.log('2. Check frontend - APY data should now appear');
    console.log('3. Test the API: GET /analytics/positions/apy');
    
  } catch (error) {
    console.error('❌ Migration script failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
};

// Handle script execution
if (require.main === module) {
  runMigration();
}

module.exports = { migratePositionSchema, createSampleData };