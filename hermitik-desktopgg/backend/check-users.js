const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function checkUsers() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect('mongodb://localhost:27017/hermetikdb');
    console.log('✅ Connected to MongoDB');

    // Get all users
    const users = await mongoose.connection.db.collection('users').find({}).toArray();
    console.log(`\n📊 Found ${users.length} users in database:`);
    
    users.forEach((user, i) => {
      console.log(`\n${i+1}. User Details:`);
      console.log(`   ID: ${user._id}`);
      console.log(`   Name: ${user.name}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Wallets: ${user.wallets ? user.wallets.length : 0}`);
      console.log(`   Has password: ${!!user.password}`);
      console.log(`   Password length: ${user.password ? user.password.length : 0}`);
      console.log(`   Created: ${user.createdAt}`);
    });

    // Test login for each user
    console.log('\n🔐 Testing login for each user:');
    
    for (const user of users) {
      console.log(`\n--- Testing login for ${user.email} ---`);
      
      if (!user.password) {
        console.log('❌ No password found for this user');
        continue;
      }

      // Test with a common password
      const testPasswords = ['password', '123456', 'admin', 'user', 'test'];
      
      for (const testPassword of testPasswords) {
        try {
          const match = await bcrypt.compare(testPassword, user.password);
          if (match) {
            console.log(`✅ Password found: "${testPassword}"`);
            break;
          }
        } catch (err) {
          console.log(`❌ Error testing password "${testPassword}":`, err.message);
        }
      }
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

checkUsers();