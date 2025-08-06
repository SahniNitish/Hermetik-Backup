const mongoose = require('mongoose');

const walletDataSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  walletAddress: { 
    type: String, 
    required: true 
  },
  timestamp: { 
    type: Date, 
    default: Date.now 
  },
  
  tokens: [{
    symbol: String,
    name: String,
    chain: String,
    amount: Number,
    price: Number,
    usd_value: Number,
    logo_url: String,
    decimals: Number
  }],
  
  protocols: [{
    protocol_id: String,
    name: String,
    chain: String,
    net_usd_value: Number,
    asset_usd_value: Number,
    debt_usd_value: Number,
    positions: [{
      position_name: String,
      tokens: [{
        symbol: String,
        amount: Number,
        usd_value: Number
      }],
      rewards: [{
        symbol: String,
        amount: Number,
        usd_value: Number
      }],
      pool_id: String,
      description: String
    }]
  }],
  
  summary: {
    total_usd_value: Number,
    token_usd_value: Number,
    protocol_usd_value: Number,
    token_count: Number,
    protocol_count: Number
  }
}, {
  timestamps: true
});

// Index for efficient queries
walletDataSchema.index({ userId: 1, walletAddress: 1, timestamp: -1 });

module.exports = mongoose.model('WalletData', walletDataSchema);