/**
 * Historical Data Service
 * Handles retrieval and processing of historical portfolio data for reports
 */

const DailySnapshot = require('../models/DailySnapshot');
const PositionHistory = require('../models/PositionHistory');
const NAVSettings = require('../models/NAVSettings');
const User = require('../models/User');

class HistoricalDataService {
  
  /**
   * Get portfolio data for a specific date from historical snapshots
   * @param {string} userId - User ID
   * @param {Date} targetDate - Target date for the report
   * @param {string} walletAddress - Optional specific wallet
   * @returns {Object} Historical portfolio data
   */
  static async getPortfolioAtDate(userId, targetDate, walletAddress = null) {
    try {
      console.log(`📊 Getting historical portfolio data for user ${userId} at ${targetDate.toISOString().split('T')[0]}`);
      
      // Build query for daily snapshots
      const query = { 
        userId,
        date: {
          $gte: new Date(targetDate.setHours(0, 0, 0, 0)),
          $lte: new Date(targetDate.setHours(23, 59, 59, 999))
        }
      };
      
      if (walletAddress) {
        query.walletAddress = walletAddress;
      }
      
      // Get snapshots for the target date
      const snapshots = await DailySnapshot.find(query).sort({ date: -1 });
      
      if (snapshots.length === 0) {
        console.log(`⚠️ No snapshots found for ${targetDate.toISOString().split('T')[0]}, looking for nearest date`);
        
        // Find nearest snapshot (within 7 days)
        const nearestSnapshot = await DailySnapshot.findOne({
          userId,
          ...(walletAddress && { walletAddress }),
          date: { $lte: targetDate }
        }).sort({ date: -1 }).limit(1);
        
        if (nearestSnapshot) {
          console.log(`📅 Using nearest snapshot from ${nearestSnapshot.date.toISOString().split('T')[0]}`);
          return this.processSnapshotData([nearestSnapshot], targetDate);
        } else {
          throw new Error(`No historical data found for user ${userId} near ${targetDate.toISOString().split('T')[0]}`);
        }
      }
      
      return this.processSnapshotData(snapshots, targetDate);
      
    } catch (error) {
      console.error('❌ Error getting historical portfolio data:', error);
      throw error;
    }
  }
  
  /**
   * Process snapshot data into Excel report format
   */
  static processSnapshotData(snapshots, targetDate) {
    let totalTokenValue = 0;
    let totalPositionValue = 0;
    let totalRewardsValue = 0;
    let totalNavUsd = 0;
    
    const tokenData = [];
    const positionData = [];
    
    // Process each snapshot (usually one per wallet)
    snapshots.forEach(snapshot => {
      // Process tokens
      if (snapshot.tokens && snapshot.tokens.length > 0) {
        snapshot.tokens.forEach(token => {
          tokenData.push({
            wallet: snapshot.walletAddress,
            symbol: token.symbol,
            name: token.name || token.symbol,
            chain: token.chain,
            amount: token.amount,
            price: token.price,
            usd_value: token.usdValue,
            date: snapshot.date
          });
          totalTokenValue += token.usdValue || 0;
        });
      }
      
      // Process positions
      if (snapshot.positions && snapshot.positions.length > 0) {
        snapshot.positions.forEach(position => {
          positionData.push({
            wallet: snapshot.walletAddress,
            protocol: position.protocolName,
            chain: position.chain,
            position_type: position.positionType,
            total_value: position.totalUsdValue,
            supply_tokens: position.supplyTokens || [],
            reward_tokens: position.rewardTokens || [],
            calculated_apy: position.calculatedApy,
            date: snapshot.date
          });
          totalPositionValue += position.totalUsdValue || 0;
          
          // Add rewards value
          if (position.rewardTokens) {
            position.rewardTokens.forEach(reward => {
              totalRewardsValue += reward.usdValue || 0;
            });
          }
        });
      }
      
      totalNavUsd += snapshot.totalNavUsd || 0;
    });
    
    return {
      date: targetDate,
      summary: {
        totalTokenValue,
        totalPositionValue, 
        totalRewardsValue,
        totalNavUsd,
        totalPortfolioValue: totalTokenValue + totalPositionValue
      },
      tokens: tokenData,
      positions: positionData,
      wallets: [...new Set(snapshots.map(s => s.walletAddress))]
    };
  }
  
  /**
   * Get NAV data for a specific month from stored NAV settings
   * @param {string} userId - User ID
   * @param {number} year - Year
   * @param {number} month - Month (1-12)
   * @returns {Object} NAV data and calculations
   */
  static async getNAVDataForMonth(userId, year, month) {
    try {
      console.log(`📊 Getting NAV data for user ${userId} - ${year}/${month}`);
      
      // Get stored NAV settings
      const navSettings = await NAVSettings.findOne({
        userId,
        year,
        month
      });
      
      if (!navSettings) {
        throw new Error(`No NAV data found for ${year}/${month}. Admin must calculate NAV first.`);
      }
      
      // Get position history for the month for detailed breakdown
      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 0, 23, 59, 59);
      
      const positionHistory = await PositionHistory.find({
        userId,
        date: { $gte: monthStart, $lte: monthEnd }
      }).sort({ date: -1 });
      
      return {
        navSettings,
        positionHistory,
        calculationDate: navSettings.createdAt,
        month,
        year
      };
      
    } catch (error) {
      console.error('❌ Error getting NAV data:', error);
      throw error;
    }
  }
  
  /**
   * Get available historical dates for a user
   * @param {string} userId - User ID
   * @returns {Array} Available dates
   */
  static async getAvailableHistoricalDates(userId) {
    try {
      const snapshots = await DailySnapshot.find({ userId })
        .select('date')
        .sort({ date: -1 })
        .lean();
        
      return snapshots.map(s => s.date);
    } catch (error) {
      console.error('❌ Error getting available dates:', error);
      return [];
    }
  }
  
  /**
   * Validate if historical data exists for a date range
   * @param {string} userId - User ID  
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {boolean} Data availability
   */
  static async hasDataForPeriod(userId, startDate, endDate) {
    try {
      const count = await DailySnapshot.countDocuments({
        userId,
        date: { $gte: startDate, $lte: endDate }
      });
      
      return count > 0;
    } catch (error) {
      console.error('❌ Error checking data availability:', error);
      return false;
    }
  }
}

module.exports = HistoricalDataService;
