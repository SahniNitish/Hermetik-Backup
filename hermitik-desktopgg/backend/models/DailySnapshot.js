// models/DailySnapshot.js
const mongoose = require('mongoose');

const DailySnapshotSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  walletAddress: { type: String, required: true },
  date: { type: Date, required: true },
  
  // NAV and Performance Metrics
  totalNavUsd: { type: Number, required: true },
  tokensNavUsd: { type: Number, required: true },
  positionsNavUsd: { type: Number, required: true },
  
  // Calculated metrics
  // dailyReturn: { type: Number }, // (NAV_T / NAV_T-1) - 1
  dailyApy: { type: Number }, // Daily return * 365
  // monthlyApy: { type: Number },
  // volatility: { type: Number }, // Annualized volatility
  // maxDrawdown: { type: Number },
  
  // Raw data
  tokens: [{
    symbol: String,
    name: String,
    chain: String,
    amount: Number,
    price: Number,
    usdValue: Number,
    decimals: Number,
    logoUrl: String
  }],
  
  positions: [{
    protocolId: String,
    protocolName: String,
    chain: String,
    
    supplyTokens: [{
      symbol: String,
      amount: Number,
      price: Number,
      usdValue: Number
    }],
    
    // Unclaimed rewards
    rewardTokens: [{
      symbol: String,
      amount: Number,
      price: Number,
      usdValue: Number
    }],
    
    totalUsdValue: Number,
    dailyApy: Number // Position-specific APY
  }],
  
  createdAt: { type: Date, default: Date.now }
});

// Compound index for efficient queries
DailySnapshotSchema.index({ userId: 1, walletAddress: 1, date: 1 }, { unique: true });
DailySnapshotSchema.index({ userId: 1, date: -1 });

module.exports = mongoose.model('DailySnapshot', DailySnapshotSchema);

