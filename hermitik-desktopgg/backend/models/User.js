const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters long'],
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long']
  },
  role: {
    type: String,
    enum: ['admin', 'user'],
    default: 'user',
    required: true
  },
  wallets: {
    type: [String],
    default: [],
    validate: {
      validator: function(wallets) {
        return wallets.every(wallet => /^0x[a-fA-F0-9]{40}$/.test(wallet));
      },
      message: 'All wallet addresses must be valid Ethereum addresses'
    }
  }
}, {
  timestamps: true
});

// Create unique index for email for better performance
userSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.model('User', userSchema);
