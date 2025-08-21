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
   * @param {number} periodDays - Number of days to calculate APY over (defaults to 30)
   * @returns {Object} - Object with position APYs
   */
  static async calculateAllPositionAPYs(userId, targetDate = new Date(), periodDays = 30) {
    console.log(`📊 Calculating APYs for user: ${userId} on ${targetDate.toISOString().split('T')[0]} over ${periodDays} days`);
    
    try {
      // Get current snapshot (or target date snapshot)
      const currentSnapshot = await this.getTodaySnapshot(userId, targetDate);
      if (!currentSnapshot) {
        console.log('❌ No snapshot found for target date');
        return {};
      }

      // Get historical snapshots for the specified period
      const historicalSnapshots = await this.getHistoricalSnapshots(userId, targetDate, periodDays);
      
      console.log(`📈 Current snapshot: ${currentSnapshot.positions?.length || 0} positions`);
      console.log(`📉 Historical snapshots: ${historicalSnapshots.length} snapshots over ${periodDays} days`);

      const apyResults = {};

      // Process each position in current snapshot
      for (const position of (currentSnapshot.positions || [])) {
        const positionId = this.generatePositionId(position);
        
        console.log(`🧮 Calculating APY for position: ${positionId}`);
        
        const apyData = await this.calculatePositionAPYOverPeriod(
          position,
          historicalSnapshots,
          periodDays,
          positionId
        );
        
        if (apyData) {
          apyResults[positionId] = apyData;
          console.log(`✅ APY calculated for ${positionId}: ${apyData.apy?.toFixed(2) || 'N/A'}% over ${periodDays} days`);
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
      
      // Validate position data - check multiple possible field names
      // Handle both plain objects and Mongoose subdocuments
      const positionData = todayPosition._doc || todayPosition;
      
      // Calculate total value from supply tokens and reward tokens
      const supplyTokensValue = (positionData.supplyTokens || []).reduce((sum, token) => {
        const tokenValue = token.usdValue || (token.amount * token.price) || 0;
        return sum + tokenValue;
      }, 0);
      const rewardTokensValue = (positionData.rewardTokens || []).reduce((sum, token) => {
        const tokenValue = token.usdValue || (token.amount * token.price) || 0;
        return sum + tokenValue;
      }, 0);
      const currentValue = positionData.totalUsdValue || positionData.totalValue || positionData.value || positionData.assetUsdValue || (supplyTokensValue + rewardTokensValue);
      console.log(`🔍 Calculated currentValue: $${currentValue.toFixed(2)} (supply: $${supplyTokensValue.toFixed(2)}, rewards: $${rewardTokensValue.toFixed(2)})`);
      
      const unclaimedRewards = this.calculateUnclaimedRewards(todayPosition);
      
      if (currentValue <= 0) {
        console.log(`⚠️ Position ${positionId} has no value, skipping APY calculation`);
        console.log(`🔍 Position fields:`, Object.keys(positionData));
        console.log(`🔍 Supply tokens value: $${supplyTokensValue}, Reward tokens value: $${rewardTokensValue}`);
        console.log(`🔍 Supply tokens count: ${positionData.supplyTokens?.length || 0}, Reward tokens count: ${positionData.rewardTokens?.length || 0}`);
        if (positionData.supplyTokens && positionData.supplyTokens.length > 0) {
          console.log(`🔍 Sample supply token:`, positionData.supplyTokens[0]);
        }
        if (positionData.rewardTokens && positionData.rewardTokens.length > 0) {
          console.log(`🔍 Sample reward token:`, positionData.rewardTokens[0]);
        }
        console.log(`🔍 Value fields: totalUsdValue=${positionData.totalUsdValue}, totalValue=${positionData.totalValue}, value=${positionData.value}, assetUsdValue=${positionData.assetUsdValue}`);
        return null;
      }

      // Check if position existed yesterday
      const yesterdayPosition = this.findPositionInSnapshot(positionId, yesterdaySnapshot);
      
      if (!yesterdayPosition) {
        // NEW POSITION: Assume exactly 1 day old
        return this.calculateNewPositionAPY(todayPosition, unclaimedRewards, currentValue, positionId);
      } else {
        // EXISTING POSITION: Check if we should use unclaimed rewards or value change
        const yesterdayPositionData = yesterdayPosition._doc || yesterdayPosition;
        const yesterdaySupplyTokensValue = (yesterdayPositionData.supplyTokens || []).reduce((sum, token) => {
          const tokenValue = token.usdValue || (token.amount * token.price) || 0;
          return sum + tokenValue;
        }, 0);
        const yesterdayRewardTokensValue = (yesterdayPositionData.rewardTokens || []).reduce((sum, token) => {
          const tokenValue = token.usdValue || (token.amount * token.price) || 0;
          return sum + tokenValue;
        }, 0);
        const yesterdayValue = yesterdayPositionData.totalUsdValue || yesterdayPositionData.totalValue || yesterdayPositionData.value || yesterdayPositionData.assetUsdValue || (yesterdaySupplyTokensValue + yesterdayRewardTokensValue);
        const yesterdayRewards = this.calculateUnclaimedRewards(yesterdayPosition);
        
        // If there are unclaimed rewards and position value hasn't changed significantly, use rewards method
        if (unclaimedRewards > 0 && Math.abs(currentValue - yesterdayValue) < (currentValue * 0.01)) {
          console.log(`💰 Using unclaimed rewards method for ${positionId} (rewards: $${unclaimedRewards})`);
          return this.calculateRewardsBasedAPY(todayPosition, unclaimedRewards, currentValue, positionId);
        } else {
          // Use value change method
          return this.calculateExistingPositionAPY(
            todayPosition, 
            yesterdayPosition, 
            todayDate, 
            yesterdayDate, 
            currentValue,
            positionId
          );
        }
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
   * Calculate APY based on unclaimed rewards (for positions with stable values)
   * Formula: APY = (unclaimed_rewards / position_value) * 365
   */
  static calculateRewardsBasedAPY(position, unclaimedRewards, currentValue, positionId) {
    console.log(`💰 Calculating rewards-based APY for ${positionId}`);
    
    if (unclaimedRewards <= 0) {
      console.log(`⚠️ No unclaimed rewards for position ${positionId}`);
      return {
        apy: 0,
        periodReturn: 0,
        days: 1,
        isNewPosition: false,
        calculationMethod: 'rewards_based_apy',
        currentValue: currentValue,
        unclaimedRewards: unclaimedRewards,
        confidence: 'medium',
        notes: 'No unclaimed rewards available'
      };
    }

    // More conservative APY calculation
    // Assume rewards accumulated over a reasonable period (7-30 days) instead of 1 day
    const assumedDays = Math.min(30, Math.max(7, unclaimedRewards / (currentValue * 0.001))); // Dynamic based on reward size
    const dailyReturn = unclaimedRewards / (currentValue * assumedDays);
    const apy = dailyReturn * 365 * 100; // Convert to percentage

    // Cap APY at reasonable levels (max 200% for rewards-based calculation)
    const cappedAPY = Math.min(200, apy);

    console.log(`📈 Rewards-based APY: ${cappedAPY.toFixed(2)}% (rewards: $${unclaimedRewards.toFixed(2)}, value: $${currentValue.toFixed(2)}, assumed days: ${assumedDays.toFixed(1)})`);

    return {
      apy: Math.round(cappedAPY * 100) / 100, // Round to 2 decimal places
      periodReturn: Math.round(dailyReturn * 10000) / 100, // Daily return as percentage
      days: assumedDays,
      isNewPosition: false,
      calculationMethod: 'rewards_based_apy',
      currentValue: currentValue,
      unclaimedRewards: unclaimedRewards,
      confidence: this.assessConfidence(cappedAPY, false),
      notes: `Based on unclaimed rewards (assumed ${assumedDays.toFixed(1)} days accumulation)`
    };
  }

  /**
   * Calculate APY for existing positions based on value change
   */
  static calculateExistingPositionAPY(todayPosition, yesterdayPosition, todayDate, yesterdayDate, currentValue, positionId) {
    console.log(`📊 Existing position detected: ${positionId}`);
    
    const yesterdayPositionData = yesterdayPosition._doc || yesterdayPosition;
    const yesterdaySupplyTokensValue = (yesterdayPositionData.supplyTokens || []).reduce((sum, token) => {
      const tokenValue = token.usdValue || (token.amount * token.price) || 0;
      return sum + tokenValue;
    }, 0);
    const yesterdayRewardTokensValue = (yesterdayPositionData.rewardTokens || []).reduce((sum, token) => {
      const tokenValue = token.usdValue || (token.amount * token.price) || 0;
      return sum + tokenValue;
    }, 0);
    const yesterdayValue = yesterdayPositionData.totalUsdValue || yesterdayPositionData.totalValue || yesterdayPositionData.value || yesterdayPositionData.assetUsdValue || (yesterdaySupplyTokensValue + yesterdayRewardTokensValue);
    
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

    console.log(`📈 Existing position APY: ${apy.toFixed(2)}% over ${actualDays.toFixed(2)} days ($${yesterdayValue.toFixed(2)} → $${currentValue.toFixed(2)})`);
    console.log(`🔍 Value change: $${valueChange.toFixed(2)}, Period return: ${(periodReturn * 100).toFixed(2)}%`);

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

    // Get all snapshots for today
    const todaySnapshots = await DailySnapshot.find({
      userId,
      date: { $gte: startOfDay, $lte: endOfDay }
    }).sort({ date: -1 });

    if (todaySnapshots.length > 0) {
      console.log(`🔍 Found ${todaySnapshots.length} snapshots for today, checking for values...`);
      
      // Prioritize snapshots with actual position values
      for (const snapshot of todaySnapshots) {
        console.log(`🔍 Checking snapshot: ${snapshot.date} with ${snapshot.positions?.length || 0} positions`);
        
        const hasPositionsWithValue = snapshot.positions && snapshot.positions.some(pos => 
          pos.totalUsdValue > 0 || 
          (pos.supplyTokens && pos.supplyTokens.some(token => (token.usdValue || (token.amount * token.price)) > 0)) ||
          (pos.rewardTokens && pos.rewardTokens.some(token => (token.usdValue || (token.amount * token.price)) > 0))
        );
        
        console.log(`🔍 Snapshot ${snapshot.date} has positions with values: ${hasPositionsWithValue}`);
        
        if (hasPositionsWithValue) {
          console.log(`✅ Found snapshot with positions having values: ${snapshot.date}`);
          return snapshot;
        }
      }
      
      // If no snapshots with values, return the first one
      console.log(`⚠️ No snapshots with position values found, using first available: ${todaySnapshots[0]?.date}`);
      return todaySnapshots[0];
    }

    // If no snapshot for exact date, get the most recent one before target date
    const fallbackSnapshots = await DailySnapshot.find({
      userId,
      date: { $lte: targetDate }
    }).sort({ date: -1 }).limit(10);

    // Find the first snapshot with positions or positive value
    for (const fallbackSnapshot of fallbackSnapshots) {
      if ((fallbackSnapshot.positions && fallbackSnapshot.positions.length > 0) || 
          (fallbackSnapshot.totalNavUsd && fallbackSnapshot.totalNavUsd > 0)) {
        return fallbackSnapshot;
      }
    }

    // If no snapshot with positions found, return the most recent one
    return fallbackSnapshots[0] || null;
  }

  /**
   * Get historical snapshots for a specified period
   */
  static async getHistoricalSnapshots(userId, targetDate, periodDays) {
    const endDate = new Date(targetDate);
    const startDate = new Date(targetDate);
    startDate.setDate(startDate.getDate() - periodDays);
    
    console.log(`🔍 Fetching snapshots from ${startDate.toISOString()} to ${endDate.toISOString()}`);
    
    const snapshots = await DailySnapshot.find({
      userId,
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 }); // Sort by date ascending for chronological order
    
    console.log(`📊 Found ${snapshots.length} snapshots over ${periodDays} days`);
    
    return snapshots;
  }

  /**
   * Calculate APY for a position over a specified period
   */
  static async calculatePositionAPYOverPeriod(currentPosition, historicalSnapshots, periodDays, positionId) {
    try {
      // Calculate current value and unclaimed rewards
      const currentValue = this.calculatePositionValue(currentPosition);
      const unclaimedRewards = this.calculateUnclaimedRewards(currentPosition);
      
      if (currentValue <= 0) {
        console.log(`⚠️ Position ${positionId} has no value, skipping APY calculation`);
        return null;
      }
      
      console.log(`🔍 Position ${positionId}: Current value $${currentValue.toFixed(2)}, Unclaimed rewards $${unclaimedRewards.toFixed(2)}`);
      
      // RULE 1: Check if position existed yesterday (consecutive days rule)
      const yesterdaySnapshot = this.findYesterdaySnapshot(historicalSnapshots);
      const yesterdayPosition = yesterdaySnapshot ? this.findPositionInSnapshot(positionId, yesterdaySnapshot) : null;
      
      if (!yesterdayPosition) {
        console.log(`🔄 Position ${positionId} didn't exist yesterday - treating as NEW position`);
        
        // RULE 2: New position - calculate APY based on unclaimed rewards
        if (unclaimedRewards > 0) {
          console.log(`💰 Calculating NEW position APY for ${positionId} with $${unclaimedRewards.toFixed(2)} unclaimed rewards`);
          
          // APY = (unclaimed_rewards / position_value) * 365
          const baseValue = currentValue - unclaimedRewards; // Exclude rewards from base value
          const rewardsPercent = baseValue > 0 ? (unclaimedRewards / baseValue) * 100 : 0;
          const annualizedAPY = rewardsPercent * 365; // Assume 1 day old
          
          console.log(`📊 NEW Position APY calculation:`);
          console.log(`   Base value: $${baseValue.toFixed(2)}`);
          console.log(`   Unclaimed rewards: $${unclaimedRewards.toFixed(2)}`);
          console.log(`   Rewards %: ${rewardsPercent.toFixed(4)}%`);
          console.log(`   Annualized APY: ${annualizedAPY.toFixed(2)}%`);
          
          return {
            apy: Math.round(annualizedAPY * 100) / 100,
            periodReturn: Math.round(rewardsPercent * 100) / 100,
            days: 1, // Assume 1 day old
            isNewPosition: true,
            calculationMethod: 'new_position_rewards_based',
            currentValue: currentValue,
            baseValue: baseValue,
            unclaimedRewards: unclaimedRewards,
            confidence: 'medium',
            notes: `NEW position with $${unclaimedRewards.toFixed(2)} unclaimed rewards (assumed 1 day old)`,
            periodDays: periodDays
          };
        } else {
          console.log(`⚠️ NEW position ${positionId} has no unclaimed rewards`);
          return {
            apy: 0,
            periodReturn: 0,
            days: 1,
            isNewPosition: true,
            calculationMethod: 'new_position_no_rewards',
            currentValue: currentValue,
            unclaimedRewards: 0,
            confidence: 'low',
            notes: `NEW position - no unclaimed rewards (assumed 1 day old)`,
            periodDays: periodDays
          };
        }
      }
      
      // RULE 1: Position exists yesterday - calculate consecutive APY
      console.log(`✅ Position ${positionId} exists yesterday - calculating consecutive APY`);
      
      const yesterdayValue = this.calculatePositionValue(yesterdayPosition);
      const valueChange = currentValue - yesterdayValue;
      const valueChangePercent = yesterdayValue > 0 ? (valueChange / yesterdayValue) : 0;
      
      // Annualize the 1-day return
      const annualizedReturn = yesterdayValue > 0 ? 
        (Math.pow(1 + valueChangePercent, 365) - 1) * 100 : 0;
      
      console.log(`📈 Consecutive APY calculation:`);
      console.log(`   Yesterday value: $${yesterdayValue.toFixed(2)}`);
      console.log(`   Today value: $${currentValue.toFixed(2)}`);
      console.log(`   Value change: $${valueChange.toFixed(2)} (${valueChangePercent.toFixed(4)})`);
      console.log(`   Annualized APY: ${annualizedReturn.toFixed(2)}%`);
      
      return {
        apy: Math.round(annualizedReturn * 100) / 100,
        periodReturn: Math.round(valueChangePercent * 10000) / 100,
        days: 1, // Consecutive day calculation
        isNewPosition: false,
        calculationMethod: 'consecutive_day_value_change',
        currentValue: currentValue,
        previousValue: yesterdayValue,
        valueChange: valueChange,
        confidence: this.assessConfidence(annualizedReturn, false),
        notes: `Consecutive day value change`,
        periodDays: periodDays
      };
      
    } catch (error) {
      console.error('❌ Error calculating position APY over period:', error);
      return null;
    }
  }

  /**
   * Generate a unique position ID from position data
   */
  static generatePositionId(position) {
    // Create a consistent ID based on protocol and position characteristics
    const protocol = (position.protocolName || 'unknown').toLowerCase().replace(/\s+/g, '_');
    const id = position.protocolId || '';
    const chain = position.chain || '';
    const positionType = position.positionType || 'unknown';
    
    // Use multiple fields to create unique identifier
    // Include position type and first token symbol to make it more unique
    const firstTokenSymbol = position.supplyTokens?.[0]?.symbol || 'unknown';
    return `${protocol}_${chain}_${positionType}_${firstTokenSymbol}_${id}`.replace(/[^a-z0-9_]/g, '');
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
   * Calculate total value of a position from its tokens
   */
  static calculatePositionValue(position) {
    const positionData = position._doc || position;
    
    // Try direct value first
    const directValue = positionData.totalUsdValue || positionData.totalValue || positionData.value || positionData.assetUsdValue || 0;
    if (directValue > 0) return directValue;
    
    // Calculate from supply tokens
    const supplyTokensValue = (positionData.supplyTokens || []).reduce((sum, token) => {
      const tokenValue = token.usdValue || token.usd_value || (token.amount * token.price) || 0;
      return sum + tokenValue;
    }, 0);
    
    // Calculate from reward tokens
    const rewardTokensValue = (positionData.rewardTokens || []).reduce((sum, token) => {
      const tokenValue = token.usdValue || token.usd_value || (token.amount * token.price) || 0;
      return sum + tokenValue;
    }, 0);
    
    return supplyTokensValue + rewardTokensValue;
  }

  /**
   * Calculate total unclaimed rewards value for a position
   */
  static calculateUnclaimedRewards(position) {
    if (!position.rewardTokens || !Array.isArray(position.rewardTokens)) {
      return 0;
    }

    return position.rewardTokens.reduce((total, reward) => {
      // Try multiple ways to get the reward value
      const rewardValue = reward.usdValue || reward.usd_value || (reward.amount * reward.price) || 0;
      return total + rewardValue;
    }, 0);
  }

  /**
   * Find yesterday's snapshot from historical snapshots
   */
  static findYesterdaySnapshot(historicalSnapshots) {
    if (!historicalSnapshots || historicalSnapshots.length === 0) {
      return null;
    }
    
    // Get yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStart = new Date(yesterday);
    yesterdayStart.setHours(0, 0, 0, 0);
    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(23, 59, 59, 999);
    
    // Find snapshots from yesterday
    const yesterdaySnapshots = historicalSnapshots.filter(snapshot => {
      const snapshotDate = new Date(snapshot.date);
      return snapshotDate >= yesterdayStart && snapshotDate <= yesterdayEnd;
    });
    
    // Return the most recent snapshot from yesterday
    if (yesterdaySnapshots.length > 0) {
      return yesterdaySnapshots.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    }
    
    return null;
  }

  /**
   * Calculate APY based on unclaimed rewards
   */
  static calculateRewardsBasedAPY(position, unclaimedRewards, periodDays) {
    try {
      const positionData = position._doc || position;
      
      // Calculate the base value (supply tokens only, excluding rewards)
      const supplyTokensValue = (positionData.supplyTokens || []).reduce((sum, token) => {
        const tokenValue = token.usdValue || (token.amount * token.price) || 0;
        return sum + tokenValue;
      }, 0);
      
      if (supplyTokensValue <= 0) {
        console.log(`⚠️ No supply tokens value for rewards-based APY calculation`);
        return null;
      }
      
      // Calculate rewards as a percentage of the base value
      const rewardsPercent = (unclaimedRewards / supplyTokensValue) * 100;
      
      // Annualize the rewards percentage
      const annualizedRewardsAPY = (rewardsPercent / periodDays) * 365;
      
      console.log(`💰 Rewards APY calculation:`);
      console.log(`   Supply value: $${supplyTokensValue.toFixed(2)}`);
      console.log(`   Unclaimed rewards: $${unclaimedRewards.toFixed(2)}`);
      console.log(`   Rewards %: ${rewardsPercent.toFixed(4)}%`);
      console.log(`   Annualized APY: ${annualizedRewardsAPY.toFixed(2)}%`);
      
      return {
        apy: Math.round(annualizedRewardsAPY * 100) / 100,
        periodReturn: Math.round(rewardsPercent * 100) / 100,
        days: periodDays,
        isNewPosition: false,
        calculationMethod: 'rewards_based',
        currentValue: supplyTokensValue + unclaimedRewards,
        baseValue: supplyTokensValue,
        unclaimedRewards: unclaimedRewards,
        confidence: this.assessConfidence(annualizedRewardsAPY, false),
        notes: `Based on $${unclaimedRewards.toFixed(2)} unclaimed rewards`
      };
      
    } catch (error) {
      console.error('❌ Error calculating rewards-based APY:', error);
      return null;
    }
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