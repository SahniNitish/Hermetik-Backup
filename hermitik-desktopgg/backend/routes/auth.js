// backend/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const ApiResponse = require('../utils/responseFormatter');
const { AppError, catchAsync } = require('../middleware/errorHandler');

// Import security middleware
const { 
  authLimiter, 
  validateEmail, 
  validatePassword, 
  validateName, 
  handleValidationErrors 
} = require('../middleware/security');

const { logger } = require('../utils/logger');

const router = express.Router();

// Disable auth rate limiting for development
// router.use(authLimiter);

// Role-based middleware
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json(ApiResponse.error('Admin access required', 403));
  }
  next();
};

const requireUser = (req, res, next) => {
  if (!req.user.role || (req.user.role !== 'admin' && req.user.role !== 'user')) {
    return res.status(403).json({ error: 'User access required' });
  }
  next();
};

// Admin-only signup route with enhanced validation
router.post('/admin-signup', [
  validateName,
  validateEmail,
  validatePassword,
  handleValidationErrors
], async (req, res) => {
  logger.info('Admin signup attempt', { 
    email: req.body.email, 
    ip: req.ip 
  });
  
  const { name, email, password } = req.body;
  
  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      logger.security.loginAttempt(email, req.ip, false, 'email_already_exists');
      return res.status(400).json({ error: 'User with this email already exists' });
    }
    
    // Hash password with increased salt rounds for admin
    const hashed = await bcrypt.hash(password, 12);
    
    // Create admin user
    const user = await User.create({ 
      name, 
      email: email.toLowerCase(), 
      password: hashed,
      role: 'admin'
    });
    
    logger.info('Admin user created successfully', { 
      userId: user._id,
      name: user.name, 
      email: user.email, 
      role: user.role,
      ip: req.ip
    });
    
    res.status(201).json({ 
      message: 'Admin user created successfully', 
      user: { 
        id: user._id, 
        email: user.email, 
        name: user.name,
        role: user.role
      } 
    });
  } catch (err) {
    logger.errorWithContext(err, { 
      operation: 'admin_signup',
      email,
      ip: req.ip
    });
    
    if (err.code === 11000) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }
    res.status(500).json({ error: 'Server error during admin signup' });
  }
});

// Login route
router.post('/login', catchAsync(async (req, res) => {
  console.log('Login request received:', { email: req.body.email });
  
  const { email, password } = req.body;
  
  // Validation
  if (!email || !password) {
    throw new AppError('Email and password are required', 400);
  }
  
  try {
    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      console.log('User not found:', email);
      throw new AppError('User not found', 404);
    }
    
    // Check password
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      console.log('Invalid password for user:', email);
      throw new AppError('Invalid password', 401);
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role }, 
      process.env.JWT_SECRET,
      { expiresIn: '7d' } // Token expires in 7 days
    );
    
    console.log('Login successful for user:', { id: user._id, email: user.email, role: user.role });
    
    res.json(ApiResponse.success(
      {
        token,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      },
      'Login successful'
    ));
  } catch (err) {
    console.error('Login error:', err);
    throw new AppError('Server error during login', 500);
  }
}));

// Get user profile (protected route)
router.get('/profile', auth, catchAsync(async (req, res) => {
  const user = await User.findById(req.user.id).select('-password');
  if (!user) {
    throw new AppError('User not found', 404);
  }
  res.json(ApiResponse.success({ user }, 'Profile retrieved successfully'));
}));

// Get wallet addresses for authenticated user
router.get('/wallet', auth, catchAsync(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    throw new AppError('User not found', 404);
  }
  
  if (!user.wallets || user.wallets.length === 0) {
    throw new AppError('No wallets added', 400);
  }
  
  res.json(ApiResponse.success({ wallets: user.wallets }, 'Wallets retrieved successfully'));
}));

// Add wallet address (moved from wallet.js for consistency)
router.post('/add-wallet', auth, async (req, res) => {
  const { wallet } = req.body;
  
  if (!wallet) {
    return res.status(400).json({ error: 'Wallet address required' });
  }
  
  // Basic Ethereum address validation
  if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return res.status(400).json({ error: 'Invalid Ethereum wallet address' });
  }
  
  try {
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $addToSet: { wallets: wallet } }, // $addToSet prevents duplicates
      { new: true }
    );
    
    res.json({ 
      message: 'Wallet added successfully', 
      wallet,
      totalWallets: user.wallets.length 
    });
  } catch (err) {
    console.error('Add wallet error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin route to create user accounts
router.post('/create-user', auth, requireAdmin, async (req, res) => {
  console.log('=== CREATE USER REQUEST ===');
  console.log('Raw request body:', JSON.stringify(req.body, null, 2));
  console.log('Admin creating user:', req.user.email);
  
  const { name, email, password, role, wallets } = req.body;
  
  console.log('Extracted values:');
  console.log('- name:', name);
  console.log('- email:', email);
  console.log('- role:', role);
  console.log('- wallets type:', typeof wallets);
  console.log('- wallets value:', wallets);
  console.log('- wallets array?:', Array.isArray(wallets));
  console.log('- wallets length:', wallets ? wallets.length : 'N/A');
  
  // Validation
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }
  
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  // Validate role
  if (role && !['user', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Role must be either "user" or "admin"' });
  }

  // Validate wallet addresses if provided
  if (wallets && Array.isArray(wallets)) {
    for (const wallet of wallets) {
      // Skip empty wallet addresses
      if (!wallet || wallet.trim() === '') {
        continue;
      }
      // Validate non-empty wallet addresses
      if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
        return res.status(400).json({ error: `Invalid wallet address: ${wallet}` });
      }
    }
  }
  
  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }
    
    // Hash password
    const hashed = await bcrypt.hash(password, 10);
    
    // Create user with optional role and wallets
    const userData = { 
      name, 
      email: email.toLowerCase(), 
      password: hashed,
      role: role || 'user'
    };

    // Add wallet addresses if provided
    console.log('Processing wallets for user creation:');
    console.log('- wallets exists?', !!wallets);
    console.log('- wallets is array?', Array.isArray(wallets));
    console.log('- wallets length:', wallets ? wallets.length : 'N/A');
    console.log('- wallets content:', JSON.stringify(wallets));
    
    if (wallets && Array.isArray(wallets) && wallets.length > 0) {
      // Filter out empty wallet addresses
      const validWallets = wallets.filter(wallet => wallet && wallet.trim() !== '');
      console.log('- valid wallets after filtering:', JSON.stringify(validWallets));
      
      if (validWallets.length > 0) {
        userData.wallets = validWallets;
        console.log('- Setting userData.wallets to:', JSON.stringify(validWallets));
      }
    }
    
    console.log('Final userData before creation:', JSON.stringify(userData, null, 2));

    const user = await User.create(userData);
    
    console.log('User created successfully:');
    console.log('- ID:', user._id);
    console.log('- Email:', user.email);
    console.log('- Role:', user.role);
    console.log('- Wallets count:', user.wallets?.length || 0);
    console.log('- Actual wallets:', JSON.stringify(user.wallets));
    
    res.status(201).json({ 
      message: 'User account created successfully', 
      user: { 
        id: user._id, 
        email: user.email, 
        name: user.name,
        role: user.role,
        wallets: user.wallets || []
      } 
    });
  } catch (err) {
    console.error('Create user error:', err);
    if (err.code === 11000) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }
    res.status(500).json({ error: 'Server error during user creation' });
  }
});

// Admin route to get all users
router.get('/all-users', auth, requireAdmin, async (req, res) => {
  try {
    const users = await User.find({}).select('-password');
    res.json({ 
      message: 'All users retrieved successfully',
      users: users.map(user => ({
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        wallets: user.wallets,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }))
    });
  } catch (err) {
    console.error('Get all users error:', err);
    res.status(500).json({ error: 'Server error fetching users' });
  }
});

// Admin route to delete a user
router.delete('/delete-user/:userId', auth, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log(`=== DELETE USER REQUEST ===`);
    console.log(`Admin ${req.user.id} attempting to delete user: ${userId}`);
    console.log(`Admin role: ${req.user.role}`);
    
    // Validate userId format
    if (!userId || userId.length !== 24) {
      console.log(`Invalid userId format: ${userId}`);
      return res.status(400).json({ error: 'Invalid user ID format' });
    }
    
    // Prevent admin from deleting themselves
    if (userId === req.user.id.toString()) {
      console.log('Admin attempting to delete their own account');
      return res.status(400).json({ error: 'Cannot delete your own admin account' });
    }
    
    // Find the user to delete
    console.log(`Searching for user with ID: ${userId}`);
    const userToDelete = await User.findById(userId);
    if (!userToDelete) {
      console.log(`User not found with ID: ${userId}`);
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log(`Found user to delete: ${userToDelete.email} (role: ${userToDelete.role})`);
    
    // Additional protection: prevent deleting other admins (optional)
    if (userToDelete.role === 'admin') {
      console.log('Attempting to delete another admin account');
      return res.status(403).json({ error: 'Cannot delete other admin accounts' });
    }
    
    // Delete user and related data
    console.log(`Deleting user from database...`);
    const deletedUser = await User.findByIdAndDelete(userId);
    if (!deletedUser) {
      console.log('Failed to delete user - user may not exist');
      return res.status(404).json({ error: 'User not found or already deleted' });
    }
    console.log(`User deleted successfully from User collection`);
    
    // Also clean up related data (DailySnapshots, WalletData, etc.)
    console.log(`Cleaning up related data...`);
    try {
      const DailySnapshot = require('../models/DailySnapshot');
      const result1 = await DailySnapshot.deleteMany({ userId: userId });
      console.log(`Deleted ${result1.deletedCount} DailySnapshots for user: ${userId}`);
    } catch (dailySnapshotErr) {
      console.log('Error deleting DailySnapshots:', dailySnapshotErr.message);
      console.log('DailySnapshot error stack:', dailySnapshotErr.stack);
    }
    
    // Delete user's wallet data (if exists)
    try {
      const WalletData = require('../models/WalletData');
      const result2 = await WalletData.deleteMany({ userId: userId });
      console.log(`Deleted ${result2.deletedCount} WalletData records for user: ${userId}`);
    } catch (walletDataErr) {
      console.log('Error deleting WalletData:', walletDataErr.message);
      console.log('WalletData error stack:', walletDataErr.stack);
    }
    
    console.log(`=== USER DELETION COMPLETE ===`);
    
    res.json({
      message: 'User deleted successfully',
      deletedUser: {
        id: userToDelete._id,
        name: userToDelete.name,
        email: userToDelete.email,
        role: userToDelete.role
      }
    });
    
  } catch (err) {
    console.error('=== DELETE USER ERROR ===');
    console.error('Error type:', err.name);
    console.error('Error message:', err.message);
    console.error('Error stack:', err.stack);
    res.status(500).json({ 
      error: 'Server error during user deletion',
      details: err.message 
    });
  }
});

// Debug route to check users and reset password
router.get('/debug-users', async (req, res) => {
  try {
    const users = await User.find({}).select('name email role createdAt wallets');
    res.json({ 
      message: 'Debug: All users (no passwords shown)',
      users: users.map(user => ({
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        wallets: user.wallets || []
      }))
    });
  } catch (err) {
    res.status(500).json({ error: 'Error fetching users', details: err.message });
  }
});

// Emergency password reset for debugging
router.post('/reset-password-debug', async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    
    if (!email || !newPassword) {
      return res.status(400).json({ error: 'Email and new password required' });
    }
    
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await User.findByIdAndUpdate(user._id, { password: hashedPassword });
    
    res.json({ 
      message: 'Password reset successfully for debugging',
      email: user.email,
      newPassword: newPassword 
    });
  } catch (err) {
    res.status(500).json({ error: 'Error resetting password', details: err.message });
  }
});

// Test route for debugging
router.get('/test', (req, res) => {
  res.json({ 
    message: 'Auth routes are working!', 
    timestamp: new Date().toISOString(),
    endpoints: [
      'POST /api/auth/admin-signup (create admin account)',
      'POST /api/auth/login (all users)', 
      'GET /api/auth/profile (requires auth)',
      'GET /api/auth/wallet (requires auth)',
      'POST /api/auth/add-wallet (requires auth)',
      'POST /api/auth/create-user (admin only - create user accounts)',
      'GET /api/auth/all-users (admin only - see all users)',
      'DELETE /api/auth/delete-user/:userId (admin only - delete user accounts)',
      'GET /api/auth/debug-users (debug - show all users)',
      'POST /api/auth/reset-password-debug (debug - reset password)'
    ]
  });
});

module.exports = router;