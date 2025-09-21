require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

async function createAdminUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Check if admin user already exists
    const existingAdmin = await User.findOne({ email: 'admin@hermetik.com' });
    if (existingAdmin) {
      console.log('⚠️ Admin user already exists');
      console.log('Email: admin@hermetik.com');
      console.log('You can reset the password or use existing credentials');
      return;
    }

    // Create new admin user
    const hashedPassword = await bcrypt.hash('Hermetik2025!', 12);
    
    const adminUser = new User({
      name: 'Admin User',
      email: 'admin@hermetik.com',
      password: hashedPassword,
      role: 'admin',
      wallets: []
    });

    await adminUser.save();
    console.log('✅ Admin user created successfully!');
    console.log('📧 Email: admin@hermetik.com');
    console.log('🔑 Password: Hermetik2025!');
    console.log('👤 Role: admin');

  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

createAdminUser();


