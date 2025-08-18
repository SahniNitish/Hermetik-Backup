const mongoose = require('mongoose');

const PositionHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  walletAddress: {
    type: String,
    required: true,
    index: true
  },
  protocolName: {
    type: String,
    required: true,
    index: true
  },
  positionName: {
    type: String,
    required: true,
    index: true
  },
  // Unique Debank position ID - never reused
  debankPositionId: {
    type: String,
    required: true,
    index: true,
    unique: false // Allow same position ID across different dates
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  // Position financial data
  totalValue: {
    type: Number,
    required: true,
    min: 0
  },
  // Total unclaimed rewards value for APY calculation
  unclaimedRewardsValue: {
    type: Number,
    default: 0,
    min: 0
  },
  tokens: [{
    symbol: {
      type: String,
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    usd_value: {
      type: Number,
      required: true
    }
  }],
  rewards: [{
    symbol: {
      type: String,
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    usd_value: {
      type: Number,
      required: true
    }
  }],
  // Metadata for position tracking
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  // Additional protocol-specific data from Debank
  protocolData: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true,
  // Compound index for efficient queries
  index: [
    { userId: 1, debankPositionId: 1, date: -1 },
    { userId: 1, walletAddress: 1, date: -1 },
    { userId: 1, protocolName: 1, date: -1 }
  ]
});

// Method to create position record with Debank position ID
PositionHistorySchema.statics.createPositionRecord = function(userId, walletAddress, protocolName, positionData) {
  // Calculate unclaimed rewards value
  const unclaimedRewardsValue = (positionData.rewards || []).reduce((sum, reward) => {
    return sum + (reward.usd_value || 0);
  }, 0);

  return new this({
    userId,
    walletAddress,
    protocolName,
    positionName: positionData.positionName || 'Unknown Position',
    debankPositionId: positionData.debankPositionId,
    date: new Date(),
    totalValue: positionData.totalValue || 0,
    unclaimedRewardsValue,
    tokens: positionData.tokens || [],
    rewards: positionData.rewards || [],
    isActive: true,
    protocolData: positionData
  });
};

module.exports = mongoose.model('PositionHistory', PositionHistorySchema);