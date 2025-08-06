// services/dataStandardization.js - FIXED VERSION
const DailySnapshot = require('../models/DailySnapshot');
const BenchmarkData = require('../models/BenchmarkData');
const axios = require('axios');

class DataStandardizationService {
  
  /**
   * Standardize raw portfolio data according to requirements
   */
  static standardizePortfolioData(rawPortfolioData, userId, walletAddress) {
    const { tokens, protocols, summary } = rawPortfolioData;
    
    // Standardize tokens
    const standardizedTokens = tokens.map(token => ({
      symbol: token.symbol,
      name: token.name,
      chain: token.chain,
      amount: token.amount || 0,
      price: token.price || 0,
      usdValue: token.usd_value || 0,
      decimals: token.decimals,
      logoUrl: token.logo_url
    }));
    
    // Standardize positions
    const standardizedPositions = [];
    
    protocols.forEach(protocol => {
      protocol.positions?.forEach(position => {
        // Determine position type
        let positionType = 'LP'; // Default
        if (position.position_name?.toLowerCase().includes('lending')) {
          positionType = 'Lending';
        } else if (position.position_name?.toLowerCase().includes('borrow')) {
          positionType = 'Borrowing';
        } else if (position.position_name?.toLowerCase().includes('farm')) {
          positionType = 'Yield Farm';
        }
        
        const supplyTokens = (position.tokens || []).map(token => ({
          symbol: token.symbol,
          amount: token.amount || 0,
          price: token.usd_value / (token.amount || 1), // Calculate price
          usdValue: token.usd_value || 0
        }));
        
        const rewardTokens = (position.rewards || []).map(token => ({
          symbol: token.symbol,
          amount: token.amount || 0,
          price: token.usd_value / (token.amount || 1),
          usdValue: token.usd_value || 0
        }));
        
        const totalUsdValue = 
          supplyTokens.reduce((sum, t) => sum + t.usdValue, 0) +
          rewardTokens.reduce((sum, t) => sum + t.usdValue, 0);
        
        standardizedPositions.push({
          protocolId: protocol.protocol_id,
          protocolName: protocol.name,
          chain: protocol.chain,
          positionType,
          supplyTokens,
          rewardTokens,
          totalUsdValue,
          dailyApy: null // Will be calculated later
        });
      });
    });
    
    return {
      userId,
      walletAddress,
      date: new Date(),
      totalNavUsd: summary.total_usd_value,
      tokensNavUsd: summary.token_usd_value,
      positionsNavUsd: summary.protocol_usd_value,
      tokens: standardizedTokens,
      positions: standardizedPositions
    };
  }
  
  /**
   * Calculate daily APY for positions
   */
  static async calculatePositionAPY(userId, walletAddress, currentPositions) {
    try {
      // Get yesterday's snapshot
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      
      const previousSnapshot = await DailySnapshot.findOne({
        userId,
        walletAddress,
        date: { $gte: yesterday, $lt: new Date(yesterday.getTime() + 24 * 60 * 60 * 1000) }
      });
      
      if (!previousSnapshot) {
        console.log('No previous snapshot found for APY calculation');
        return currentPositions;
      }
      
      // Calculate APY for each position
      const updatedPositions = currentPositions.map(currentPos => {
        const previousPos = previousSnapshot.positions.find(
          p => p.protocolId === currentPos.protocolId && p.chain === currentPos.chain
        );
        
        if (!previousPos) {
          return { ...currentPos, dailyApy: null };
        }
        
        // Calculate daily APY based on unclaimed rewards growth
        const currentRewardsValue = currentPos.rewardTokens.reduce((sum, t) => sum + t.usdValue, 0);
        const previousRewardsValue = previousPos.rewardTokens.reduce((sum, t) => sum + t.usdValue, 0);
        const averagePositionValue = (currentPos.totalUsdValue + previousPos.totalUsdValue) / 2;
        
        if (averagePositionValue > 0 && currentRewardsValue >= previousRewardsValue) {
          const dailyRewardGrowth = currentRewardsValue - previousRewardsValue;
          const dailyReturn = dailyRewardGrowth / averagePositionValue;
          const dailyApy = dailyReturn * 365 * 100; // Convert to percentage
          
          return { ...currentPos, dailyApy: dailyApy > 0 ? dailyApy : null };
        }
        
        return { ...currentPos, dailyApy: null };
      });
      
      return updatedPositions;
    } catch (error) {
      console.error('Error calculating position APY:', error);
      return currentPositions;
    }
  }
  
  /**
   * Calculate portfolio performance metrics
   */
  static async calculatePerformanceMetrics(userId, walletAddress, currentNavUsd) {
    try {
      // Get previous snapshots for calculations
      const snapshots = await DailySnapshot.find({
        userId,
        walletAddress
      }).sort({ date: -1 }).limit(365); // Get up to 1 year of data
      
      if (snapshots.length === 0) {
        return {
          dailyReturn: null,
          dailyApy: null,
          monthlyApy: null,
          volatility: null,
          maxDrawdown: null
        };
      }
      
      const previousSnapshot = snapshots[0]; // Most recent
      
      // Daily return calculation
      let dailyReturn = null;
      let dailyApy = null;
      if (previousSnapshot && previousSnapshot.totalNavUsd > 0) {
        dailyReturn = (currentNavUsd / previousSnapshot.totalNavUsd) - 1;
        dailyApy = dailyReturn * 365 * 100; // Annualized percentage
      }
      
      // Monthly APY calculation (if we have data from last month)
      let monthlyApy = null;
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      
      const monthlySnapshot = snapshots.find(s => s.date <= oneMonthAgo);
      if (monthlySnapshot && monthlySnapshot.totalNavUsd > 0) {
        const daysSinceMonth = (new Date() - monthlySnapshot.date) / (1000 * 60 * 60 * 24);
        const monthlyReturn = (currentNavUsd / monthlySnapshot.totalNavUsd) - 1;
        monthlyApy = (monthlyReturn * 365 / daysSinceMonth) * 100;
      }
      
      // Volatility calculation (annualized volatility of daily returns)
      let volatility = null;
      if (snapshots.length >= 5) {
        const dailyReturns = [];
        for (let i = 0; i < Math.min(30, snapshots.length - 1); i++) {
          const current = snapshots[i];
          const previous = snapshots[i + 1];
          if (previous && previous.totalNavUsd > 0) {
            const dailyReturn = (current.totalNavUsd / previous.totalNavUsd) - 1;
            dailyReturns.push(dailyReturn);
          }
        }
        
        if (dailyReturns.length >= 5) {
          const mean = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;
          const variance = dailyReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / dailyReturns.length;
          volatility = Math.sqrt(variance * 365) * 100; // Annualized percentage
        }
      }
      
      // Maximum drawdown calculation
      let maxDrawdown = null;
      if (snapshots.length >= 2) {
        let peak = snapshots[snapshots.length - 1].totalNavUsd;
        let maxDD = 0;
        
        for (let i = snapshots.length - 2; i >= 0; i--) {
          const currentValue = snapshots[i].totalNavUsd;
          if (currentValue > peak) {
            peak = currentValue;
          } else if (peak > 0) {
            const drawdown = (peak - currentValue) / peak;
            maxDD = Math.max(maxDD, drawdown);
          }
        }
        maxDrawdown = maxDD * 100; // Convert to percentage
      }
      
      return {
        dailyReturn: dailyReturn ? dailyReturn * 100 : null, // Convert to percentage
        dailyApy,
        monthlyApy,
        volatility,
        maxDrawdown
      };
      
    } catch (error) {
      console.error('Error calculating performance metrics:', error);
      return {
        dailyReturn: null,
        dailyApy: null,
        monthlyApy: null,
        volatility: null,
        maxDrawdown: null
      };
    }
  }
  
  /**
   * Fetch benchmark data (USDC lending rate on Aave) with caching
   */
  static benchmarkCache = { rate: 3.5, timestamp: 0 };
  static BENCHMARK_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  
  static async fetchBenchmarkData() {
    try {
      const now = Date.now();
      
      // Use cached rate if available and not expired
      if (this.benchmarkCache.timestamp && 
          (now - this.benchmarkCache.timestamp) < this.BENCHMARK_CACHE_DURATION) {
        return this.benchmarkCache.rate;
      }
      
      // For now, using a static rate. In production, fetch from Aave API
      const benchmarkRate = 3.5; // 3.5% APY
      
      // Update cache
      this.benchmarkCache = { rate: benchmarkRate, timestamp: now };
      
      // Save to database (upsert for today)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      await BenchmarkData.findOneAndUpdate(
        { date: today },
        {
          date: today,
          aaveUsdcRate: benchmarkRate,
          updatedAt: new Date()
        },
        { upsert: true }
      );
      
      return benchmarkRate;
    } catch (error) {
      console.error('Error fetching benchmark data:', error);
      return this.benchmarkCache.rate || 3.5; // Default fallback rate
    }
  }
  
  /**
   * Save standardized daily snapshot (FIXED to prevent duplicates)
   */
  static async saveDailySnapshot(standardizedData) {
    try {
      // Set date to midnight for consistency
      const snapshotDate = new Date();
      snapshotDate.setHours(0, 0, 0, 0);
      
      // Check if snapshot already exists for today
      const existingSnapshot = await DailySnapshot.findOne({
        userId: standardizedData.userId,
        walletAddress: standardizedData.walletAddress,
        date: snapshotDate
      });
      
      if (existingSnapshot) {
        console.log(`✅ Snapshot already exists for ${standardizedData.walletAddress} on ${snapshotDate.toISOString().split('T')[0]}, updating...`);
      }
      
      // Calculate performance metrics
      const performanceMetrics = await this.calculatePerformanceMetrics(
        standardizedData.userId,
        standardizedData.walletAddress,
        standardizedData.totalNavUsd
      );
      
      // Calculate position APYs
      const updatedPositions = await this.calculatePositionAPY(
        standardizedData.userId,
        standardizedData.walletAddress,
        standardizedData.positions
      );
      
      // Fetch benchmark data
      const benchmarkRate = await this.fetchBenchmarkData();
      
      // Prepare final snapshot data
      const snapshotData = {
        ...standardizedData,
        ...performanceMetrics,
        positions: updatedPositions,
        benchmarkRate,
        date: snapshotDate
      };
      
      // Upsert (update if exists, create if not)
      const snapshot = await DailySnapshot.findOneAndUpdate(
        {
          userId: snapshotData.userId,
          walletAddress: snapshotData.walletAddress,
          date: snapshotData.date
        },
        snapshotData,
        { upsert: true, new: true }
      );
      
      console.log(`✅ Saved daily snapshot for ${snapshotData.walletAddress} on ${snapshotData.date.toISOString().split('T')[0]}`);
      return snapshot;
      
    } catch (error) {
      console.error('Error saving daily snapshot:', error);
      throw error;
    }
  }
}

module.exports = DataStandardizationService;