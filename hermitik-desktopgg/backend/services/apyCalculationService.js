const DailySnapshot = require('../models/DailySnapshot');

/**
 * Clean APY Calculation Service
 * 
 * Requirements:
 * - Use existing snapshot data structure/schema
 * - Compare today's snapshot with yesterday's snapshot
 * - For positions that exist in both: calculate APY based on actual time difference
 * - For NEW positions (didn't exist yesterday): assume exactly 1 day old
 * - APY formula for 1-day-old positions: APY = (unclaimed_rewards / position_value) * 365
 */
class APYCalculationService {

  /**
   * Calculate APY for all positions for a user
   * @param {string} userId - User ID
   * @param {Date} targetDate - Date to calculate APY for (defaults to today)
   * @returns {Object} - Object with position APYs
   */
  static async calculateAllPositionAPYs(userId, targetDate = new Date()) {
    console.log(`📊 Calculating APYs for user: ${userId} on ${targetDate.toISOString().split('T')[0]}`);
    
    try {
      // Get today's snapshot (or target date snapshot)
      const todaySnapshot = await this.getTodaySnapshot(userId, targetDate);
      if (!todaySnapshot) {
        console.log('❌ No snapshot found for target date');
        return {};
      }

      // Get yesterday's snapshot
      const yesterdaySnapshot = await this.getYesterdaySnapshot(userId, targetDate);
      
      console.log(`📈 Today's snapshot: ${todaySnapshot.positions?.length || 0} positions`);
      console.log(`📉 Yesterday's snapshot: ${yesterdaySnapshot?.positions?.length || 0} positions`);

      const apyResults = {};

      // Process each position in today's snapshot
      for (const position of (todaySnapshot.positions || [])) {
        const positionId = this.generatePositionId(position);
        
        console.log(`🧮 Calculating APY for position: ${positionId}`);
        
        const apyData = await this.calculatePositionAPY(
          position,
          yesterdaySnapshot,
          todaySnapshot.date,
          yesterdaySnapshot?.date
        );
        
        if (apyData) {
          apyResults[positionId] = apyData;
          console.log(`✅ APY calculated for ${positionId}: ${apyData.apy?.toFixed(2) || 'N/A'}%`);
        }
      }

      console.log(`📊 Total positions with APY data: ${Object.keys(apyResults).length}`);
      return apyResults;

    } catch (error) {
      console.error('❌ Error calculating APYs:', error);
      return {};
    }
  }

  /**
   * Calculate APY for a single position
   * @param {Object} todayPosition - Position data from today's snapshot
   * @param {Object} yesterdaySnapshot - Yesterday's complete snapshot
   * @param {Date} todayDate - Today's date
   * @param {Date} yesterdayDate - Yesterday's date
   * @returns {Object} - APY calculation result
   */
  static async calculatePositionAPY(todayPosition, yesterdaySnapshot, todayDate, yesterdayDate) {
    try {
      const positionId = this.generatePositionId(todayPosition);
      
      // Validate position data
      const currentValue = todayPosition.totalUsdValue || 0;
      const unclaimedRewards = this.calculateUnclaimedRewards(todayPosition);
      
      if (currentValue <= 0) {
        console.log(`⚠️ Position ${positionId} has no value, skipping APY calculation`);
        return null;
      }

      // Check if position existed yesterday
      const yesterdayPosition = this.findPositionInSnapshot(positionId, yesterdaySnapshot);
      
      if (!yesterdayPosition) {
        // NEW POSITION: Assume exactly 1 day old
        return this.calculateNewPositionAPY(todayPosition, unclaimedRewards, currentValue, positionId);
      } else {
        // EXISTING POSITION: Calculate based on actual time difference
        return this.calculateExistingPositionAPY(
          todayPosition, 
          yesterdayPosition, 
          todayDate, 
          yesterdayDate, 
          currentValue,
          positionId
        );
      }

    } catch (error) {
      console.error('❌ Error calculating position APY:', error);
      return null;
    }
  }

  /**
   * Calculate APY for new positions (1-day assumption)
   * Formula: APY = (unclaimed_rewards / position_value) * 365
   */
  static calculateNewPositionAPY(position, unclaimedRewards, currentValue, positionId) {
    console.log(`🆕 New position detected: ${positionId} (assuming 1 day old)`);
    
    if (unclaimedRewards <= 0) {
      console.log(`⚠️ No unclaimed rewards for new position ${positionId}`);
      return {
        apy: 0,
        periodReturn: 0,
        days: 1,
        isNewPosition: true,
        calculationMethod: 'new_position_1_day_assumption',
        currentValue: currentValue,
        unclaimedRewards: unclaimedRewards,
        confidence: 'low', // Low confidence for new positions
        notes: 'Assumed 1 day old - actual age unknown'
      };
    }

    // APY = (unclaimed_rewards / position_value) * 365
    const dailyReturn = unclaimedRewards / currentValue;
    const apy = dailyReturn * 365 * 100; // Convert to percentage

    console.log(`📈 New position APY: ${apy.toFixed(2)}% (rewards: $${unclaimedRewards.toFixed(2)}, value: $${currentValue.toFixed(2)})`);

    return {
      apy: Math.round(apy * 100) / 100, // Round to 2 decimal places
      periodReturn: Math.round(dailyReturn * 10000) / 100, // Daily return as percentage
      days: 1,
      isNewPosition: true,
      calculationMethod: 'new_position_1_day_assumption',
      currentValue: currentValue,
      unclaimedRewards: unclaimedRewards,
      confidence: this.assessConfidence(apy, true),
      notes: 'Assumed 1 day old based on unclaimed rewards'
    };
  }

  /**
   * Calculate APY for existing positions based on value change
   */
  static calculateExistingPositionAPY(todayPosition, yesterdayPosition, todayDate, yesterdayDate, currentValue, positionId) {
    console.log(`📊 Existing position detected: ${positionId}`);
    
    const yesterdayValue = yesterdayPosition.totalUsdValue || 0;
    
    if (yesterdayValue <= 0) {
      console.log(`⚠️ Yesterday's value is zero for ${positionId}, treating as new position`);
      const unclaimedRewards = this.calculateUnclaimedRewards(todayPosition);
      return this.calculateNewPositionAPY(todayPosition, unclaimedRewards, currentValue, positionId);
    }

    // Calculate actual time difference
    const timeDiffMs = todayDate - yesterdayDate;
    const actualDays = Math.max(0.1, timeDiffMs / (1000 * 60 * 60 * 24)); // Minimum 0.1 days

    // Calculate value change
    const valueChange = currentValue - yesterdayValue;
    const periodReturn = valueChange / yesterdayValue;
    
    // Annualize the return: APY = ((1 + period_return) ^ (365/days)) - 1
    const annualizationFactor = 365 / actualDays;
    const annualizedReturn = Math.pow(1 + periodReturn, annualizationFactor) - 1;
    const apy = annualizedReturn * 100;

    console.log(`📈 Existing position APY: ${apy.toFixed(2)}% over ${actualDays.toFixed(2)} days (${yesterdayValue.toFixed(2)} → ${currentValue.toFixed(2)})`);

    return {
      apy: Math.round(apy * 100) / 100,
      periodReturn: Math.round(periodReturn * 10000) / 100,
      days: Math.round(actualDays * 100) / 100,
      isNewPosition: false,
      calculationMethod: 'existing_position_value_change',
      currentValue: currentValue,
      yesterdayValue: yesterdayValue,
      valueChange: valueChange,
      confidence: this.assessConfidence(apy, false),
      notes: `Based on ${actualDays.toFixed(1)} day value change`
    };
  }

  /**
   * Get today's snapshot (or target date snapshot)
   */
  static async getTodaySnapshot(userId, targetDate) {
    // Find snapshot for the target date (within the same day)
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const snapshot = await DailySnapshot.findOne({
      userId,
      date: { $gte: startOfDay, $lte: endOfDay }
    }).sort({ date: -1 });

    if (!snapshot) {
      // If no snapshot for exact date, get the most recent one before target date
      return await DailySnapshot.findOne({
        userId,
        date: { $lte: targetDate }
      }).sort({ date: -1 });
    }

    return snapshot;
  }

  /**
   * Get yesterday's snapshot
   */
  static async getYesterdaySnapshot(userId, targetDate) {
    const yesterday = new Date(targetDate);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const startOfYesterday = new Date(yesterday);
    startOfYesterday.setHours(0, 0, 0, 0);
    
    const endOfYesterday = new Date(yesterday);
    endOfYesterday.setHours(23, 59, 59, 999);

    const snapshot = await DailySnapshot.findOne({
      userId,
      date: { $gte: startOfYesterday, $lte: endOfYesterday }
    }).sort({ date: -1 });

    if (!snapshot) {
      // If no snapshot for exact yesterday, get the most recent one before yesterday
      return await DailySnapshot.findOne({
        userId,
        date: { $lt: startOfYesterday }
      }).sort({ date: -1 });
    }

    return snapshot;
  }

  /**
   * Generate a unique position ID from position data
   */
  static generatePositionId(position) {
    // Create a consistent ID based on protocol and position characteristics
    const protocol = (position.protocolName || 'unknown').toLowerCase().replace(/\s+/g, '_');
    const id = position.protocolId || '';
    const chain = position.chain || '';
    
    // Use multiple fields to create unique identifier
    return `${protocol}_${chain}_${id}`.replace(/[^a-z0-9_]/g, '');
  }

  /**
   * Find a position in a snapshot by position ID
   */
  static findPositionInSnapshot(positionId, snapshot) {
    if (!snapshot || !snapshot.positions) {
      return null;
    }

    return snapshot.positions.find(pos => {
      const snapPositionId = this.generatePositionId(pos);
      return snapPositionId === positionId;
    });
  }

  /**
   * Calculate total unclaimed rewards value for a position
   */
  static calculateUnclaimedRewards(position) {
    if (!position.rewardTokens || !Array.isArray(position.rewardTokens)) {
      return 0;
    }

    return position.rewardTokens.reduce((total, reward) => {
      return total + (reward.usdValue || 0);
    }, 0);
  }

  /**
   * Assess confidence level for APY calculation
   */
  static assessConfidence(apy, isNewPosition) {
    if (isNewPosition) {
      // New positions have lower confidence due to 1-day assumption
      if (Math.abs(apy) > 1000) return 'very_low'; // Extreme APY
      if (Math.abs(apy) > 100) return 'low';
      return 'medium';
    } else {
      // Existing positions with historical data
      if (Math.abs(apy) > 10000) return 'very_low'; // Extreme APY
      if (Math.abs(apy) > 1000) return 'low';
      if (Math.abs(apy) > 100) return 'medium';
      return 'high';
    }
  }

  /**
   * Format APY data for display
   */
  static formatAPYForDisplay(apyData) {
    if (!apyData) return null;

    return {
      ...apyData,
      formattedAPY: `${apyData.apy >= 0 ? '+' : ''}${apyData.apy.toFixed(2)}%`,
      formattedValue: `$${apyData.currentValue.toLocaleString(undefined, { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      })}`,
      confidenceLevel: apyData.confidence,
      isReliable: ['high', 'medium'].includes(apyData.confidence)
    };
  }
}

module.exports = APYCalculationService;