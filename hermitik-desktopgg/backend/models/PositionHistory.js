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

// Static methods for comprehensive APY calculations following mathematical best practices
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

    // Step 1: Data Validation
    if (!this._validatePositionData(currentValue, currentRewards)) {
      return this._createErrorResult(currentValue, currentRewards, 'Invalid position data');
    }

    // Step 2: Check for historical data
    const historicalPositions = await this._getHistoricalPositions(userId, debankPositionId, targetDate);
    
    // Step 3: Determine calculation method
    if (historicalPositions.length === 0) {
      // New position: Use simple APY based on rewards
      return this._calculateNewPositionAPY(currentValue, currentRewards);
    }

    // Step 4: Calculate APY for different time periods
    const periods = [
      { name: 'daily', days: 1 },
      { name: 'weekly', days: 7 },
      { name: 'monthly', days: 30 },
      { name: 'sixMonth', days: 180 }
    ];

    for (const period of periods) {
      const periodResult = await this._calculatePeriodAPY(
        userId, 
        debankPositionId, 
        targetDate, 
        period, 
        currentValue, 
        currentRewards
      );
      
      if (periodResult) {
        results[period.name] = periodResult;
      }
    }

    // Step 5: Calculate all-time APY
    results.allTime = await this._calculateAllTimeAPY(
      userId, 
      debankPositionId, 
      targetDate, 
      currentValue
    );

    return results;
  } catch (error) {
    console.error('Error calculating position APY:', error);
    return results;
  }
};

// Data validation helper
PositionHistorySchema.statics._validatePositionData = function(currentValue, currentRewards) {
  // Prevent division by zero and negative values
  if (currentValue <= 0) return false;
  if (currentRewards < 0) return false;
  if (!Number.isFinite(currentValue) || !Number.isFinite(currentRewards)) return false;
  return true;
};

// Get historical positions for all periods
PositionHistorySchema.statics._getHistoricalPositions = async function(userId, debankPositionId, targetDate) {
  return await this.find({
    userId,
    debankPositionId,
    date: { $lt: targetDate },
    isActive: true
  }).sort({ date: -1 });
};

// Calculate APY for new positions (simple method)
PositionHistorySchema.statics._calculateNewPositionAPY = function(currentValue, currentRewards) {
  /**
   * Simple APY Formula: APY = (unclaimed_rewards / position_value) × 365 × 100
   * This assumes the rewards were earned in 1 day
   */
  const dailyReturn = currentRewards / currentValue;
  const simpleAPY = dailyReturn * 365 * 100;
  
  // Determine confidence and warnings
  const { confidence, warnings } = this._assessAPYConfidence(simpleAPY, dailyReturn * 100, true);
  
  return {
    daily: {
      apy: Math.round(simpleAPY * 100) / 100, // Round to 2 decimal places
      periodReturn: Math.round(dailyReturn * 10000) / 100, // Round to 2 decimal places
      days: 1,
      isNewPosition: true,
      confidence,
      warnings,
      calculationMethod: 'simple_apy',
      rawDailyReturn: dailyReturn,
      positionValue: currentValue,
      rewardsValue: currentRewards
    },
    weekly: null,
    monthly: null,
    sixMonth: null,
    allTime: null
  };
};

// Calculate APY for a specific period
PositionHistorySchema.statics._calculatePeriodAPY = async function(userId, debankPositionId, targetDate, period, currentValue, currentRewards) {
  // Calculate target historical date
  const historicalDate = new Date(targetDate);
  historicalDate.setDate(historicalDate.getDate() - period.days);

  // Find closest historical position
  const historicalPosition = await this.findOne({
    userId,
    debankPositionId,
    date: { $gte: historicalDate, $lt: targetDate },
    isActive: true
  }).sort({ date: 1 });

  if (!historicalPosition || historicalPosition.totalValue <= 0) {
    return null;
  }

  const historicalValue = historicalPosition.totalValue;
  const actualDays = Math.max(1, Math.ceil((targetDate - historicalPosition.date) / (1000 * 60 * 60 * 24)));

  /**
   * Period-based APY Formula:
   * Period Return = (current_value / historical_value) - 1
   * APY = ((1 + period_return) ^ annualization_factor) - 1
   * Where annualization_factor = 365 / days_in_period
   */
  const periodReturn = (currentValue / historicalValue) - 1;
  const annualizationFactor = 365 / actualDays;
  
  // Prevent extreme calculations
  if (Math.abs(periodReturn) > 10) { // More than 1000% period return
    return this._createExtremeValueResult(periodReturn, actualDays, currentValue, currentRewards);
  }

  const annualizedReturn = Math.pow(1 + periodReturn, annualizationFactor) - 1;
  const apy = annualizedReturn * 100;

  // Assess confidence
  const { confidence, warnings } = this._assessAPYConfidence(apy, periodReturn * 100, false, actualDays);

  return {
    apy: Math.round(apy * 100) / 100,
    periodReturn: Math.round(periodReturn * 10000) / 100,
    days: actualDays,
    isNewPosition: false,
    confidence,
    warnings,
    calculationMethod: 'period_based_apy',
    rawDailyReturn: periodReturn / actualDays,
    positionValue: currentValue,
    rewardsValue: currentRewards,
    historicalValue: historicalValue,
    periodStart: historicalPosition.date
  };
};

// Calculate all-time APY
PositionHistorySchema.statics._calculateAllTimeAPY = async function(userId, debankPositionId, targetDate, currentValue) {
  const firstPosition = await this.findOne({
    userId,
    debankPositionId,
    isActive: true
  }).sort({ date: 1 });

  if (!firstPosition || firstPosition.totalValue <= 0) {
    return null;
  }

  const daysHeld = Math.max(1, (targetDate - firstPosition.date) / (1000 * 60 * 60 * 24));
  const totalReturn = (currentValue / firstPosition.totalValue) - 1;
  
  // Prevent extreme calculations for very short periods
  if (daysHeld < 1) {
    return null;
  }

  const annualizedReturn = Math.pow(1 + totalReturn, 365 / daysHeld) - 1;
  const apy = annualizedReturn * 100;

  // Assess confidence
  const { confidence, warnings } = this._assessAPYConfidence(apy, totalReturn * 100, false, Math.ceil(daysHeld));

  return {
    apy: Math.round(apy * 100) / 100,
    periodReturn: Math.round(totalReturn * 10000) / 100,
    days: Math.ceil(daysHeld),
    isNewPosition: false,
    confidence,
    warnings,
    calculationMethod: 'all_time_apy',
    positionValue: currentValue,
    firstRecorded: firstPosition.date,
    initialValue: firstPosition.totalValue
  };
};

// Assess APY confidence and generate warnings
PositionHistorySchema.statics._assessAPYConfidence = function(apy, periodReturn, isNewPosition, days = 1) {
  let confidence = 'high';
  let warnings = [];

  // Outlier detection - flag extreme APY values
  const MAX_REASONABLE_APY = 10000; // 10,000%
  const MIN_REASONABLE_APY = -99; // -99%

  if (apy > MAX_REASONABLE_APY) {
    confidence = 'low';
    warnings.push(`Extreme APY of ${apy.toFixed(2)}% detected - please verify data accuracy`);
  } else if (apy < MIN_REASONABLE_APY) {
    confidence = 'low';
    warnings.push(`Extreme negative APY of ${apy.toFixed(2)}% detected - position may be losing significant value`);
  }

  // Period-specific warnings
  if (isNewPosition) {
    if (Math.abs(periodReturn) > 5) {
      confidence = 'low';
      warnings.push(`Daily return of ${periodReturn.toFixed(2)}% seems unrealistically high for new position`);
    } else if (Math.abs(periodReturn) > 1) {
      confidence = 'medium';
      warnings.push(`Daily return of ${periodReturn.toFixed(2)}% is quite high - verify reward calculation`);
    }
  } else {
    // Historical data available
    if (days < 7 && Math.abs(apy) > 1000) {
      confidence = 'low';
      warnings.push(`Short period (${days} days) with high APY may not be representative`);
    } else if (days >= 30 && confidence === 'high') {
      confidence = 'high'; // More confidence in longer periods
    }
  }

  // Additional validation
  if (periodReturn < -50) {
    confidence = 'low';
    warnings.push(`Large period loss of ${periodReturn.toFixed(2)}% - position may be compromised`);
  }

  return { confidence, warnings };
};

// Create result for extreme values
PositionHistorySchema.statics._createExtremeValueResult = function(periodReturn, actualDays, currentValue, currentRewards) {
  return {
    apy: null,
    periodReturn: Math.round(periodReturn * 10000) / 100,
    days: actualDays,
    isNewPosition: false,
    confidence: 'low',
    warnings: [`Extreme period return of ${(periodReturn * 100).toFixed(2)}% - APY calculation skipped`],
    calculationMethod: 'extreme_value_detected',
    rawDailyReturn: periodReturn / actualDays,
    positionValue: currentValue,
    rewardsValue: currentRewards
  };
};

// Create error result for invalid data
PositionHistorySchema.statics._createErrorResult = function(currentValue, currentRewards, errorMessage) {
  return {
    daily: {
      apy: null,
      periodReturn: null,
      days: 0,
      isNewPosition: true,
      confidence: 'low',
      warnings: [errorMessage],
      calculationMethod: 'error',
      rawDailyReturn: null,
      positionValue: currentValue,
      rewardsValue: currentRewards
    },
    weekly: null,
    monthly: null,
    sixMonth: null,
    allTime: null
  };
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