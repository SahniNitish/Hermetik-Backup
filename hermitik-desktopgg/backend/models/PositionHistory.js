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

// Static methods for APY calculations with new 1-day assumption logic
PositionHistorySchema.statics.calculatePositionAPY = async function(userId, debankPositionId, targetDate = new Date()) {
  const results = {
    daily: null,
    weekly: null,
    monthly: null,
    sixMonth: null,
    allTime: null
  };

  try {
    // Get current position data (most recent before target date)
    const currentPosition = await this.findOne({
      userId,
      debankPositionId,
      date: { $lte: targetDate },
      isActive: true
    }).sort({ date: -1 });

    if (!currentPosition) {
      return results;
    }

    const currentValue = currentPosition.totalValue;
    const currentRewards = currentPosition.unclaimedRewardsValue || 0;

    // Check if position existed yesterday
    const yesterday = new Date(targetDate);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const yesterdayPosition = await this.findOne({
      userId,
      debankPositionId,
      date: { $gte: yesterday, $lt: targetDate },
      isActive: true
    }).sort({ date: -1 });

    // If no yesterday position, assume 1-day old position
    if (!yesterdayPosition) {
      // New position: APY = (unclaimed_rewards / position_value) * 365
      if (currentValue > 0) {
        const newPositionAPY = (currentRewards / currentValue) * 365 * 100;
        
        results.daily = {
          apy: newPositionAPY,
          periodReturn: (currentRewards / currentValue) * 100,
          days: 1,
          isNewPosition: true
        };
      }
      return results;
    }

    // Calculate APY for different time periods (existing logic)
    const periods = [
      { name: 'daily', days: 1, annualizationFactor: 365 },
      { name: 'weekly', days: 7, annualizationFactor: 365/7 },
      { name: 'monthly', days: 30, annualizationFactor: 365/30 },
      { name: 'sixMonth', days: 180, annualizationFactor: 365/180 }
    ];

    for (const period of periods) {
      const historicalDate = new Date(targetDate);
      historicalDate.setDate(historicalDate.getDate() - period.days);

      // Find historical position within the period
      const historicalPosition = await this.findOne({
        userId,
        debankPositionId,
        date: { $gte: historicalDate, $lt: targetDate },
        isActive: true
      }).sort({ date: 1 });

      if (historicalPosition) {
        const historicalValue = historicalPosition.totalValue;
        if (historicalValue > 0) {
          const actualDays = Math.ceil((targetDate - historicalPosition.date) / (1000 * 60 * 60 * 24));
          const periodReturn = (currentValue / historicalValue) - 1;
          const annualizedReturn = Math.pow(1 + periodReturn, period.annualizationFactor) - 1;
          
          results[period.name] = {
            apy: annualizedReturn * 100,
            periodReturn: periodReturn * 100,
            days: actualDays,
            isNewPosition: false
          };
        }
      }
    }

    // Calculate all-time APY from first available position
    const firstPosition = await this.findOne({
      userId,
      debankPositionId,
      isActive: true
    }).sort({ date: 1 });

    if (firstPosition && firstPosition.totalValue > 0) {
      const daysHeld = Math.max(1, (targetDate - firstPosition.date) / (1000 * 60 * 60 * 24));
      const totalReturn = (currentValue / firstPosition.totalValue) - 1;
      const annualizedReturn = Math.pow(1 + totalReturn, 365 / daysHeld) - 1;
      
      results.allTime = {
        apy: annualizedReturn * 100,
        periodReturn: totalReturn * 100,
        days: Math.ceil(daysHeld),
        firstRecorded: firstPosition.date
      };
    }

    return results;
  } catch (error) {
    console.error('Error calculating position APY:', error);
    return results;
  }
};

// Method to create position record with Debank position ID
PositionHistorySchema.statics.createPositionRecord = function(userId, walletAddress, protocolName, positionData) {
  // Calculate unclaimed rewards value
  const unclaimedRewardsValue = (positionData.rewards || [])
    .reduce((sum, reward) => sum + (reward.usd_value || 0), 0);

  // Calculate total position value
  const totalValue = (positionData.tokens || [])
    .reduce((sum, token) => sum + (token.usd_value || 0), 0) + unclaimedRewardsValue;

  return {
    userId,
    walletAddress,
    protocolName,
    positionName: positionData.position_name || 'Unknown Position',
    debankPositionId: positionData.position_id || `${protocolName}_${positionData.position_name}_${Date.now()}`,
    date: new Date(),
    totalValue,
    unclaimedRewardsValue,
    tokens: positionData.tokens || [],
    rewards: positionData.rewards || [],
    isActive: true,
    protocolData: {
      originalData: positionData
    }
  };
};

// Method to mark position as inactive
PositionHistorySchema.methods.markInactive = function() {
  this.isActive = false;
  return this.save();
};

// Pre-save middleware to ensure required fields
PositionHistorySchema.pre('save', function(next) {
  // Ensure debankPositionId exists
  if (!this.debankPositionId) {
    this.debankPositionId = `${this.protocolName}_${this.positionName}_${Date.now()}`.toLowerCase().replace(/\s+/g, '_');
  }

  // Ensure unclaimedRewardsValue is calculated
  if (this.unclaimedRewardsValue === undefined || this.unclaimedRewardsValue === null) {
    this.unclaimedRewardsValue = (this.rewards || [])
      .reduce((sum, reward) => sum + (reward.usd_value || 0), 0);
  }

  next();
});

module.exports = mongoose.model('PositionHistory', PositionHistorySchema);