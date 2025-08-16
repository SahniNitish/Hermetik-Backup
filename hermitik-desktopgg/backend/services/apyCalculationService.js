const PositionHistory = require('../models/PositionHistory');
const DailySnapshot = require('../models/DailySnapshot');

class APYCalculationService {
  /**
   * Calculate portfolio performance for different time periods
   * Uses DailySnapshot data for portfolio-level calculations
   */
  static async calculatePortfolioPerformance(userId, targetDate = new Date()) {
    const results = {
      daily: null,
      weekly: null,
      monthly: null,
      sixMonth: null,
      allTime: null
    };

    try {
      // Get current portfolio snapshot
      const currentSnapshot = await DailySnapshot.findOne({
        userId,
        date: { $lte: targetDate }
      }).sort({ date: -1 });

      if (!currentSnapshot) {
        return results;
      }

      const currentValue = currentSnapshot.totalNav || 0;

      // Calculate performance for different time periods
      const periods = [
        { name: 'daily', days: 1 },
        { name: 'weekly', days: 7 },
        { name: 'monthly', days: 30 },
        { name: 'sixMonth', days: 180 }
      ];

      for (const period of periods) {
        const historicalDate = new Date(targetDate);
        historicalDate.setDate(historicalDate.getDate() - period.days);

        const historicalSnapshot = await DailySnapshot.findOne({
          userId,
          date: { $gte: historicalDate, $lt: targetDate }
        }).sort({ date: 1 });

        if (historicalSnapshot && historicalSnapshot.totalNav > 0) {
          const historicalValue = historicalSnapshot.totalNav;
          const periodReturn = ((currentValue / historicalValue) - 1) * 100;
          
          results[period.name] = {
            performance: periodReturn,
            currentValue,
            historicalValue,
            days: period.days,
            periodStart: historicalSnapshot.date
          };
        }
      }

      // Calculate all-time performance from first available snapshot
      const firstSnapshot = await DailySnapshot.findOne({ userId }).sort({ date: 1 });
      
      if (firstSnapshot && firstSnapshot.totalNav > 0) {
        const daysHeld = Math.max(1, (targetDate - firstSnapshot.date) / (1000 * 60 * 60 * 24));
        const totalReturn = ((currentValue / firstSnapshot.totalNav) - 1) * 100;
        
        results.allTime = {
          performance: totalReturn,
          currentValue,
          historicalValue: firstSnapshot.totalNav,
          days: Math.ceil(daysHeld),
          periodStart: firstSnapshot.date
        };
      }

      return results;
    } catch (error) {
      console.error('Error calculating portfolio performance:', error);
      return results;
    }
  }

  /**
   * Calculate APY for a specific position with 1-day assumption for new positions
   */
  static async calculatePositionAPY(userId, debankPositionId, targetDate = new Date()) {
    return await PositionHistory.calculatePositionAPY(userId, debankPositionId, targetDate);
  }

  /**
   * Calculate APY for all positions of a user
   */
  static async calculateAllPositionAPYs(userId, targetDate = new Date()) {
    try {
      // Get all active positions for the user using Debank position IDs
      const activePositions = await PositionHistory.distinct('debankPositionId', {
        userId,
        date: { $lte: targetDate },
        isActive: true
      });

      const apyResults = {};

      // Calculate APY for each position
      for (const debankPositionId of activePositions) {
        apyResults[debankPositionId] = await this.calculatePositionAPY(userId, debankPositionId, targetDate);
      }

      return apyResults;
    } catch (error) {
      console.error('Error calculating all position APYs:', error);
      return {};
    }
  }

  /**
   * Store position data for historical tracking using Debank position IDs
   */
  static async storePositionData(userId, walletAddress, protocolName, positionData) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Normalize to start of day

      for (const position of positionData) {
        // Use Debank position ID if available, otherwise generate one
        const debankPositionId = position.position_id || 
          `${protocolName}_${position.position_name}_${walletAddress}_${Date.now()}`.toLowerCase().replace(/\s+/g, '_');
        
        // Calculate unclaimed rewards value
        const unclaimedRewardsValue = (position.rewards || [])
          .reduce((sum, reward) => sum + (reward.usd_value || 0), 0);

        // Calculate total position value
        const totalValue = this.calculatePositionValue(position);

        // Store today's position data using new schema
        const positionHistory = new PositionHistory({
          userId,
          walletAddress,
          protocolName,
          positionName: position.position_name || 'Unknown Position',
          debankPositionId,
          date: today,
          totalValue,
          unclaimedRewardsValue,
          tokens: position.tokens || [],
          rewards: position.rewards || [],
          isActive: true,
          protocolData: {
            originalData: position
          }
        });

        await positionHistory.save();
      }
    } catch (error) {
      console.error('Error storing position data:', error);
      throw error;
    }
  }

  /**
   * Mark positions as inactive if they no longer exist
   */
  static async markInactivePositions(userId, activeDebankPositionIds) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Find positions that were active yesterday but not today
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      await PositionHistory.updateMany({
        userId,
        date: { $gte: yesterday },
        debankPositionId: { $nin: activeDebankPositionIds },
        isActive: true
      }, {
        isActive: false
      });
    } catch (error) {
      console.error('Error marking inactive positions:', error);
    }
  }

  /**
   * Calculate total USD value of a position
   */
  static calculatePositionValue(position) {
    let totalValue = 0;

    // Add token values
    if (position.tokens) {
      totalValue += position.tokens.reduce((sum, token) => sum + (token.usd_value || 0), 0);
    }

    // Add reward values
    if (position.rewards) {
      totalValue += position.rewards.reduce((sum, reward) => sum + (reward.usd_value || 0), 0);
    }

    return totalValue;
  }

  /**
   * Get position performance summary with APY data
   */
  static async getPositionPerformanceSummary(userId, targetDate = new Date()) {
    try {
      const apyData = await this.calculateAllPositionAPYs(userId, targetDate);
      const positionSummaries = {};

      // Get latest position data for each active position
      for (const debankPositionId of Object.keys(apyData)) {
        const latestPosition = await PositionHistory.findOne({
          userId,
          debankPositionId,
          date: { $lte: targetDate },
          isActive: true
        }).sort({ date: -1 });

        if (latestPosition) {
          positionSummaries[debankPositionId] = {
            protocolName: latestPosition.protocolName,
            positionName: latestPosition.positionName,
            walletAddress: latestPosition.walletAddress,
            currentValue: latestPosition.totalValue,
            unclaimedRewardsValue: latestPosition.unclaimedRewardsValue,
            apy: apyData[debankPositionId],
            lastUpdated: latestPosition.date,
            debankPositionId: latestPosition.debankPositionId
          };
        }
      }

      return positionSummaries;
    } catch (error) {
      console.error('Error getting position performance summary:', error);
      return {};
    }
  }

  /**
   * Utility method to format APY data for frontend display
   */
  static formatAPYForDisplay(apyData) {
    const formatted = {};

    Object.entries(apyData).forEach(([period, data]) => {
      if (data && data.apy !== null && data.apy !== undefined) {
        formatted[period] = {
          apy: `${data.apy >= 0 ? '+' : ''}${data.apy.toFixed(2)}%`,
          periodReturn: `${data.periodReturn >= 0 ? '+' : ''}${data.periodReturn.toFixed(2)}%`,
          days: data.days,
          isPositive: data.apy >= 0,
          rawAPY: data.apy,
          rawPeriodReturn: data.periodReturn,
          isNewPosition: data.isNewPosition || false
        };
      } else {
        formatted[period] = {
          apy: 'No data',
          periodReturn: 'No data',
          days: 0,
          isPositive: null,
          rawAPY: null,
          rawPeriodReturn: null,
          isNewPosition: false
        };
      }
    });

    return formatted;
  }
}

module.exports = APYCalculationService;