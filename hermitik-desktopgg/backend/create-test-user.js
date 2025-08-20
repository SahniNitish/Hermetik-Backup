const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('./models/User');

async function createTestUser() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hermetik');
    console.log('✅ Connected to MongoDB');

    // Check if user already exists
    let user = await User.findOne({ email: 'test@example.com' });
    
    if (user) {
      console.log('👤 User already exists, updating password...');
      // Update password to a known value
      const hashedPassword = await bcrypt.hash('password123', 10);
      user.password = hashedPassword;
      user.wallets = ['0x1234567890123456789012345678901234567890']; // Add a test wallet
      await user.save();
      console.log('✅ Updated user with known password and wallet');
    } else {
      console.log('👤 Creating new test user...');
      const hashedPassword = await bcrypt.hash('password123', 10);
      user = new User({
        email: 'test@example.com',
        password: hashedPassword,
        role: 'user',
        wallets: ['0x1234567890123456789012345678901234567890']
      });
      await user.save();
      console.log('✅ Created test user');
    }

    console.log('User details:', {
      id: user._id,
      email: user.email,
      wallets: user.wallets
    });

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

createTestUser();