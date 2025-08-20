/**
 * DailySnapshot Model - Standardized Schema
 * Stores daily portfolio snapshots for APY calculations and historical tracking
 */
const mongoose = require('mongoose');

// Token schema - consistent field naming
const TokenSchema = new mongoose.Schema({
  symbol: { type: String, required: true, trim: true, uppercase: true },
  name: { type: String, trim: true },
  chain: { type: String, required: true, lowercase: true },
  amount: { type: Number, required: true, min: 0 },
  price: { type: Number, required: true, min: 0 },
  usdValue: { type: Number, required: true, min: 0 },
  decimals: { type: Number, min: 0, max: 18 },
  logoUrl: { type: String, trim: true },
  isVerified: { type: Boolean, default: false }
}, { _id: false });

// Position schema - standardized for APY calculations
const PositionSchema = new mongoose.Schema({
  protocolId: { type: String, required: true, trim: true },
  protocolName: { type: String, required: true, trim: true },
  chain: { type: String, required: true, lowercase: true },
  
  // Supply tokens (staked/deposited tokens)
  supplyTokens: [TokenSchema],
  
  // Reward tokens (unclaimed rewards for APY calculation)
  rewardTokens: [TokenSchema],
  
  // Position metadata
  totalUsdValue: { type: Number, required: true, min: 0 },
  positionType: { 
    type: String, 
    enum: ['lending', 'liquidity', 'staking', 'farming', 'vault', 'other'],
    default: 'other'
  },
  healthFactor: { type: Number, min: 0 },
  
  // APY calculation results
  calculatedApy: { type: Number },
  apyConfidence: { 
    type: String, 
    enum: ['very_low', 'low', 'medium', 'high'],
    default: 'medium'
  },
  lastApyUpdate: { type: Date }
}, { _id: false });

const DailySnapshotSchema = new mongoose.Schema({
  // Core identifiers
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  walletAddress: { 
    type: String, 
    required: true,
    trim: true,
    lowercase: true,
    match: /^0x[a-fA-F0-9]{40}$/ // Ethereum address format
  },
  date: { 
    type: Date, 
    required: true,
    index: true
  },
  
  // NAV (Net Asset Value) metrics - consistent naming
  totalNavUsd: { 
    type: Number, 
    required: true, 
    min: 0,
    set: v => Math.round(v * 100) / 100 // Round to 2 decimals
  },
  tokensNavUsd: { 
    type: Number, 
    required: true, 
    min: 0,
    set: v => Math.round(v * 100) / 100
  },
  positionsNavUsd: { 
    type: Number, 
    required: true, 
    min: 0,
    set: v => Math.round(v * 100) / 100
  },
  
  // Performance metrics
  dailyReturn: { type: Number }, // (NAV_T / NAV_T-1) - 1
  dailyApy: { type: Number }, // Annualized daily return
  volatility: { type: Number, min: 0 }, // Price volatility
  sharpeRatio: { type: Number }, // Risk-adjusted return
  
  // Portfolio composition
  tokens: [TokenSchema],
  positions: [PositionSchema],
  
  // Chain distribution
  chainDistribution: {
    type: Map,
    of: Number,
    default: new Map()
  },
  
  // Protocol distribution
  protocolDistribution: {
    type: Map,
    of: Number,
    default: new Map()
  },
  
  // Metadata
  snapshotVersion: { type: String, default: '1.0' },
  dataSource: { type: String, default: 'debank' },
  processingTime: { type: Number }, // ms taken to process
  
  // Timestamps
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now }
});

// Pre-save middleware to update updatedAt
DailySnapshotSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Compound indexes for efficient queries
DailySnapshotSchema.index({ userId: 1, walletAddress: 1, date: 1 }, { unique: true });
DailySnapshotSchema.index({ userId: 1, date: -1 });
DailySnapshotSchema.index({ date: -1 });
DailySnapshotSchema.index({ totalNavUsd: -1 });

// Virtual for calculating portfolio allocation percentages
DailySnapshotSchema.virtual('tokenAllocationPercent').get(function() {
  return this.totalNavUsd > 0 ? (this.tokensNavUsd / this.totalNavUsd) * 100 : 0;
});

DailySnapshotSchema.virtual('positionAllocationPercent').get(function() {
  return this.totalNavUsd > 0 ? (this.positionsNavUsd / this.totalNavUsd) * 100 : 0;
});

// Instance methods
DailySnapshotSchema.methods.calculateDistributions = function() {
  // Calculate chain distribution
  const chainDist = new Map();
  this.tokens.forEach(token => {
    const current = chainDist.get(token.chain) || 0;
    chainDist.set(token.chain, current + token.usdValue);
  });
  
  // Calculate protocol distribution
  const protocolDist = new Map();
  this.positions.forEach(position => {
    const current = protocolDist.get(position.protocolName) || 0;
    protocolDist.set(position.protocolName, current + position.totalUsdValue);
  });
  
  this.chainDistribution = chainDist;
  this.protocolDistribution = protocolDist;
};

// Static methods for common queries
DailySnapshotSchema.statics.getLatestSnapshot = function(userId, walletAddress) {
  return this.findOne({ userId, walletAddress })
    .sort({ date: -1 })
    .exec();
};

DailySnapshotSchema.statics.getSnapshotsByDateRange = function(userId, startDate, endDate) {
  return this.find({
    userId,
    date: { $gte: startDate, $lte: endDate }
  })
  .sort({ date: 1 })
  .exec();
};

DailySnapshotSchema.statics.getUserPortfolioHistory = function(userId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.find({
    userId,
    date: { $gte: startDate }
  })
  .sort({ date: 1 })
  .exec();
};

module.exports = mongoose.model('DailySnapshot', DailySnapshotSchema);

