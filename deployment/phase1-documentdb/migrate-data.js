/**
 * Migrate data from local MongoDB to DocumentDB
 */

const mongoose = require('mongoose');
const fs = require('fs');

// Source (local) and target (DocumentDB) connections
const LOCAL_MONGO_URI = 'mongodb://localhost:27017/hermetikdb';
const DOCUMENTDB_URI = process.env.DOCUMENTDB_URI || 'mongodb://hermetikadmin:password@cluster.docdb.amazonaws.com:27017/hermetikdb?ssl=true&replicaSet=rs0&readPreference=secondaryPreferred&retryWrites=false';

// Import all models
const User = require('../../hermitik-desktopgg/backend/models/User');
const NAVSettings = require('../../hermitik-desktopgg/backend/models/NAVSettings');
const DailySnapshot = require('../../hermitik-desktopgg/backend/models/DailySnapshot');
const PositionHistory = require('../../hermitik-desktopgg/backend/models/PositionHistory');
const WalletData = require('../../hermitik-desktopgg/backend/models/WalletData');

async function connectToSource() {
  try {
    await mongoose.connect(LOCAL_MONGO_URI);
    console.log('✅ Connected to local MongoDB');
    return mongoose.connection;
  } catch (error) {
    console.error('❌ Failed to connect to local MongoDB:', error);
    throw error;
  }
}

async function connectToTarget() {
  try {
    // Create separate connection for DocumentDB
    const targetConnection = mongoose.createConnection(DOCUMENTDB_URI, {
      ssl: true,
      sslValidate: false, // For development - set to true in production with proper cert
      retryWrites: false
    });
    
    await new Promise((resolve, reject) => {
      targetConnection.on('connected', resolve);
      targetConnection.on('error', reject);
    });
    
    console.log('✅ Connected to DocumentDB');
    return targetConnection;
  } catch (error) {
    console.error('❌ Failed to connect to DocumentDB:', error);
    throw error;
  }
}

async function migrateCollection(sourceModel, targetConnection, collectionName) {
  try {
    console.log(`\n📊 Migrating ${collectionName}...`);
    
    // Get data from source
    const sourceData = await sourceModel.find({}).lean();
    console.log(`   📈 Found ${sourceData.length} documents in source`);
    
    if (sourceData.length === 0) {
      console.log(`   ⚠️ No data to migrate for ${collectionName}`);
      return { success: true, migrated: 0 };
    }
    
    // Create target model
    const targetModel = targetConnection.model(collectionName, sourceModel.schema);
    
    // Clear target collection (optional - comment out if you want to preserve existing data)
    await targetModel.deleteMany({});
    console.log(`   🗑️ Cleared target collection`);
    
    // Insert data in batches
    const batchSize = 100;
    let migratedCount = 0;
    
    for (let i = 0; i < sourceData.length; i += batchSize) {
      const batch = sourceData.slice(i, i + batchSize);
      await targetModel.insertMany(batch);
      migratedCount += batch.length;
      console.log(`   📤 Migrated ${migratedCount}/${sourceData.length} documents`);
    }
    
    // Verify migration
    const targetCount = await targetModel.countDocuments();
    console.log(`   ✅ Migration completed: ${targetCount} documents in target`);
    
    return { success: true, migrated: targetCount };
    
  } catch (error) {
    console.error(`   ❌ Failed to migrate ${collectionName}:`, error);
    return { success: false, error: error.message };
  }
}

async function migrateAllData() {
  let sourceConnection = null;
  let targetConnection = null;
  
  try {
    console.log('🚀 Starting data migration from local MongoDB to DocumentDB\n');
    
    // Connect to both databases
    sourceConnection = await connectToSource();
    targetConnection = await connectToTarget();
    
    // Collections to migrate
    const collections = [
      { model: User, name: 'User' },
      { model: NAVSettings, name: 'NAVSettings' },
      { model: DailySnapshot, name: 'DailySnapshot' },
      { model: PositionHistory, name: 'PositionHistory' },
      { model: WalletData, name: 'WalletData' }
    ];
    
    const results = [];
    
    // Migrate each collection
    for (const collection of collections) {
      const result = await migrateCollection(collection.model, targetConnection, collection.name);
      results.push({ collection: collection.name, ...result });
    }
    
    // Summary
    console.log('\n📊 Migration Summary:');
    console.log('='.repeat(50));
    
    let totalMigrated = 0;
    let successCount = 0;
    
    results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${result.collection}: ${result.migrated || 0} documents ${result.error ? `(Error: ${result.error})` : ''}`);
      
      if (result.success) {
        successCount++;
        totalMigrated += result.migrated || 0;
      }
    });
    
    console.log('='.repeat(50));
    console.log(`📊 Total: ${totalMigrated} documents migrated`);
    console.log(`✅ Success: ${successCount}/${collections.length} collections`);
    
    if (successCount === collections.length) {
      console.log('\n🎉 All data migrated successfully!');
      console.log('🚀 Ready to proceed with Phase 2 (EC2 Backend deployment)');
    } else {
      console.log('\n⚠️ Some collections failed to migrate. Check errors above.');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    // Close connections
    if (sourceConnection) {
      await sourceConnection.close();
      console.log('🔌 Disconnected from local MongoDB');
    }
    if (targetConnection) {
      await targetConnection.close();
      console.log('🔌 Disconnected from DocumentDB');
    }
  }
}

async function testDocumentDBConnection() {
  try {
    console.log('🧪 Testing DocumentDB connection...');
    
    const connection = await connectToTarget();
    
    // Test basic operations
    const testCollection = connection.collection('test');
    await testCollection.insertOne({ test: true, timestamp: new Date() });
    const testDoc = await testCollection.findOne({ test: true });
    await testCollection.deleteOne({ test: true });
    
    console.log('✅ DocumentDB connection test successful!');
    console.log('📊 Test document:', testDoc);
    
    await connection.close();
    return true;
    
  } catch (error) {
    console.error('❌ DocumentDB connection test failed:', error);
    return false;
  }
}

async function main() {
  const command = process.argv[2];
  
  if (command === 'test') {
    await testDocumentDBConnection();
  } else if (command === 'migrate') {
    await migrateAllData();
  } else {
    console.log('Available commands:');
    console.log('  test    - Test DocumentDB connection');
    console.log('  migrate - Migrate all data from local MongoDB to DocumentDB');
    console.log('');
    console.log('Examples:');
    console.log('  node migrate-data.js test');
    console.log('  DOCUMENTDB_URI="mongodb://..." node migrate-data.js migrate');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { migrateAllData, testDocumentDBConnection };


