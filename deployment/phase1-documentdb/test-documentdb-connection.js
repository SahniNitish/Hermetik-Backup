/**
 * Test DocumentDB connection from EC2 instance
 */

const mongoose = require('mongoose');

// DocumentDB connection string
const DOCUMENTDB_URI = process.env.DOCUMENTDB_URI || 'mongodb://admin1:Hermetik2025@hermetik-docdb-final.cagkrtwngcl9.us-east-1.docdb.amazonaws.com:27017/hermetikdb?tls=true&tlsCAFile=global-bundle.pem&retryWrites=false&authSource=admin';

async function testDocumentDBConnection() {
  try {
    console.log('🧪 Testing DocumentDB connection...');
    console.log('🔗 Connection string:', DOCUMENTDB_URI.replace(/:[^:]*@/, ':****@')); // Hide password
    
    // Connect with DocumentDB-specific options
    await mongoose.connect(DOCUMENTDB_URI, {
      ssl: true,
      sslValidate: true,
      sslCA: './global-bundle.pem',
      retryWrites: false
    });
    
    console.log('✅ Connected to DocumentDB successfully!');
    
    // Test basic operations
    console.log('🧪 Testing basic database operations...');
    
    // Test collection operations
    const testCollection = mongoose.connection.db.collection('test_connection');
    
    // Insert test document
    const insertResult = await testCollection.insertOne({
      test: true,
      timestamp: new Date(),
      message: 'DocumentDB connection test'
    });
    console.log('✅ Insert test successful:', insertResult.insertedId);
    
    // Find test document
    const findResult = await testCollection.findOne({ test: true });
    console.log('✅ Find test successful:', findResult._id);
    
    // Delete test document
    const deleteResult = await testCollection.deleteOne({ test: true });
    console.log('✅ Delete test successful:', deleteResult.deletedCount);
    
    // List existing collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('📊 Existing collections:', collections.map(c => c.name));
    
    console.log('\n🎉 DocumentDB connection test completed successfully!');
    console.log('🚀 Ready to migrate data');
    
    return true;
    
  } catch (error) {
    console.error('❌ DocumentDB connection test failed:', error.message);
    console.error('Full error:', error);
    
    // Common troubleshooting tips
    console.log('\n🔧 Troubleshooting tips:');
    console.log('1. Make sure global-bundle.pem file exists in current directory');
    console.log('2. Verify DocumentDB cluster is in "available" status');
    console.log('3. Check security group allows access from this EC2 instance');
    console.log('4. Verify the connection string credentials');
    
    return false;
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('🔌 Disconnected from DocumentDB');
    }
  }
}

async function listDatabases() {
  try {
    console.log('📊 Listing DocumentDB databases...');
    
    await mongoose.connect(DOCUMENTDB_URI, {
      ssl: true,
      sslValidate: true,
      sslCA: './global-bundle.pem',
      retryWrites: false
    });
    
    const admin = mongoose.connection.db.admin();
    const databases = await admin.listDatabases();
    
    console.log('📋 Available databases:');
    databases.databases.forEach(db => {
      console.log(`  - ${db.name}: ${(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB`);
    });
    
    return databases;
    
  } catch (error) {
    console.error('❌ Failed to list databases:', error.message);
    return null;
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  }
}

async function main() {
  const command = process.argv[2];
  
  if (command === 'test') {
    const success = await testDocumentDBConnection();
    process.exit(success ? 0 : 1);
  } else if (command === 'list') {
    await listDatabases();
  } else {
    console.log('Available commands:');
    console.log('  test - Test DocumentDB connection and basic operations');
    console.log('  list - List available databases');
    console.log('');
    console.log('Examples:');
    console.log('  node test-documentdb-connection.js test');
    console.log('  node test-documentdb-connection.js list');
    console.log('');
    console.log('Environment variables:');
    console.log('  DOCUMENTDB_URI - DocumentDB connection string (optional, uses default)');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testDocumentDBConnection, listDatabases };


