const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function resetUserPasswords() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect('mongodb://localhost:27017/hermetikdb');
    console.log('✅ Connected to MongoDB');

    // Set a simple password for all users
    const newPassword = 'password123';
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    console.log(`🔐 Resetting all user passwords to: "${newPassword}"`);

    // Update all users with the new password
    const result = await mongoose.connection.db.collection('users').updateMany(
      {}, // Update all users
      { $set: { password: hashedPassword } }
    );

    console.log(`✅ Updated ${result.modifiedCount} users with new password`);

    // Show all users with their login credentials
    const users = await mongoose.connection.db.collection('users').find({}).toArray();
    console.log('\n📋 User Login Credentials:');
    console.log('========================');
    
    users.forEach((user, i) => {
      console.log(`\n${i+1}. ${user.name} (${user.role})`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Password: ${newPassword}`);
      console.log(`   ID: ${user._id}`);
    });

    console.log('\n🎉 All users can now log in with the password above!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

resetUserPasswords();
