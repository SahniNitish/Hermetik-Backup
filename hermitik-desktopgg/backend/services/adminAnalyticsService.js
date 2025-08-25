const User = require('../models/User');
const DailySnapshot = require('../models/DailySnapshot');
const APYCalculationService = require('./apyCalculationService');

class AdminAnalyticsService {
  /**
   * Get comprehensive admin dashboard data
   */
  static async getAdminDashboardData() {
    try {
      console.log('🔐 ADMIN: Fetching dashboard data for all users...');
      
      // Get all users
      const users = await User.find({}).select('id name email role wallets');
      console.log(`🔐 ADMIN: Found ${users.length} users`);
      
      // Get all snapshots from today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const snapshots = await DailySnapshot.find({
        date: { $gte: today, $lt: tomorrow }
      }).populate('userId', 'name email');
      
      console.log(`🔐 ADMIN: Found ${snapshots.length} snapshots for today`);
      
      // Aggregate data
      const dashboardData = {
        totalUsers: users.length,
        activeUsers: snapshots.length,
        totalPortfolioValue: 0,
        totalWallets: 0,
        walletCategories: {
          ethWallets: [],
          stableWallets: [],
          hybridWallets: []
        },
        userPerformance: [],
        portfolioMetrics: {
          totalAPY: 0,
          averageAPY: 0,
          totalUnclaimedRewards: 0
        }
      };
      
      // Cache for APY calculations to prevent duplicates
      const apyCache = new Map();
      
      // Process each snapshot
      for (const snapshot of snapshots) {
        const user = snapshot.userId;
        
        // Skip if we've already processed this user
        if (apyCache.has(user._id.toString())) {
          console.log(`🔄 Skipping duplicate processing for user: ${user.name}`);
          continue;
        }
        
        const walletData = await this.processUserSnapshot(snapshot, user, apyCache);
        
        if (walletData) {
          dashboardData.totalPortfolioValue += walletData.totalValue;
          dashboardData.totalWallets += walletData.walletCount;
          dashboardData.totalUnclaimedRewards += walletData.totalUnclaimedRewards;
          
          // Categorize wallets
          walletData.wallets.forEach(wallet => {
            const category = this.classifyWallet(wallet);
            dashboardData.walletCategories[category].push(wallet);
          });
          
          // Add user performance
          dashboardData.userPerformance.push({
            userId: user._id,
            userName: user.name,
            userEmail: user.email,
            totalValue: walletData.totalValue,
            walletCount: walletData.walletCount,
            averageAPY: walletData.averageAPY,
            unclaimedRewards: walletData.totalUnclaimedRewards,
            walletCategories: walletData.walletCategories
          });
        }
      }
      
      // Calculate portfolio-wide metrics
      if (dashboardData.userPerformance.length > 0) {
        const totalAPY = dashboardData.userPerformance.reduce((sum, user) => sum + user.averageAPY, 0);
        dashboardData.portfolioMetrics.averageAPY = totalAPY / dashboardData.userPerformance.length;
        dashboardData.portfolioMetrics.totalAPY = totalAPY;
      }
      
      console.log(`🔐 ADMIN: Dashboard data prepared - Total Value: $${dashboardData.totalPortfolioValue.toFixed(2)}`);
      
      return dashboardData;
      
    } catch (error) {
      console.error('❌ ADMIN: Error getting dashboard data:', error);
      throw error;
    }
  }
  
  /**
   * Process a single user's snapshot data
   */
  static async processUserSnapshot(snapshot, user, apyCache) {
    try {
      if (!snapshot.positions || snapshot.positions.length === 0) {
        return null;
      }
      
      let totalValue = 0;
      let totalUnclaimedRewards = 0;
      let walletCount = 0;
      const wallets = [];
      
      // Process each position
      for (const position of snapshot.positions) {
        const positionValue = APYCalculationService.calculatePositionValue(position);
        const unclaimedRewards = APYCalculationService.calculateUnclaimedRewards(position);
        
        totalValue += positionValue;
        totalUnclaimedRewards += unclaimedRewards;
        
        // Create wallet object
        const wallet = {
          userId: user._id,
          userName: user.name,
          userEmail: user.email,
          positionId: APYCalculationService.generatePositionId(position),
          protocolName: position.protocolName,
          chain: position.chain,
          totalValue: positionValue,
          unclaimedRewards: unclaimedRewards,
          supplyTokens: position.supplyTokens || [],
          rewardTokens: position.rewardTokens || [],
          category: this.classifyWallet({ totalValue: positionValue, unclaimedRewards, protocolName: position.protocolName })
        };
        
        wallets.push(wallet);
        walletCount++;
      }
      
      // Calculate average APY for this user
      const userAPYData = await APYCalculationService.calculateAllPositionAPYs(user._id, new Date(), 1);
      const apyValues = Object.values(userAPYData).filter(apy => apy && apy.apy !== null && apy.apy !== undefined);
      
      // Limit the number of APY values to prevent excessive calculations
      const maxAPYValues = 10; // Limit to top 10 positions by value
      const limitedAPYValues = apyValues
        .sort((a, b) => (b.currentValue || 0) - (a.currentValue || 0))
        .slice(0, maxAPYValues);
      
      const averageAPY = limitedAPYValues.length > 0 ? 
        limitedAPYValues.reduce((sum, apy) => sum + apy.apy, 0) / limitedAPYValues.length : 0;
      
      // Cache the APY data for this user
      apyCache.set(user._id.toString(), userAPYData);
      
      return {
        userId: user._id,
        userName: user.name,
        userEmail: user.email,
        totalValue,
        walletCount,
        averageAPY,
        totalUnclaimedRewards,
        wallets,
        walletCategories: {
          ethWallets: wallets.filter(w => w.category === 'ethWallets').length,
          stableWallets: wallets.filter(w => w.category === 'stableWallets').length,
          hybridWallets: wallets.filter(w => w.category === 'hybridWallets').length
        }
      };
      
    } catch (error) {
      console.error(`❌ ADMIN: Error processing snapshot for user ${user.name}:`, error);
      return null;
    }
  }
  
  /**
   * Classify wallet based on risk profile
   */
  static classifyWallet(wallet) {
    const { totalValue, unclaimedRewards, protocolName } = wallet;
    
    if (totalValue <= 0) return 'hybridWallets';
    
    // Calculate APY potential
    const apyPotential = totalValue > 0 ? (unclaimedRewards / totalValue) * 365 : 0;
    
    // Check if it's a DeFi protocol (high-risk indicators)
    const defiProtocols = ['uniswap', 'convex', 'curve', 'aave', 'compound', 'yearn', 'balancer', 'sushi'];
    const isDefiProtocol = defiProtocols.some(defi => protocolName?.toLowerCase().includes(defi));
    
    // ETH Wallet Criteria (High-risk, high-reward)
    if (isDefiProtocol && apyPotential > 0.2) {
      return 'ethWallets';
    }
    
    // Stable Wallet Criteria (Conservative)
    if (!isDefiProtocol && apyPotential < 0.1) {
      return 'stableWallets';
    }
    
    // Hybrid Wallet (Mixed strategy)
    return 'hybridWallets';
  }
  
  /**
   * Get categorized wallet data
   */
  static async getCategorizedWallets(category = 'all') {
    try {
      const dashboardData = await this.getAdminDashboardData();
      
      if (category === 'all') {
        return dashboardData.walletCategories;
      }
      
      return {
        [category]: dashboardData.walletCategories[category] || []
      };
      
    } catch (error) {
      console.error('❌ ADMIN: Error getting categorized wallets:', error);
      throw error;
    }
  }
  
  /**
   * Get user performance ranking
   */
  static async getUserPerformanceRanking() {
    try {
      const dashboardData = await this.getAdminDashboardData();
      
      // Sort users by total value (descending)
      const rankedUsers = dashboardData.userPerformance
        .sort((a, b) => b.totalValue - a.totalValue)
        .map((user, index) => ({
          ...user,
          rank: index + 1
        }));
      
      return rankedUsers;
      
    } catch (error) {
      console.error('❌ ADMIN: Error getting user performance ranking:', error);
      throw error;
    }
  }
}

module.exports = AdminAnalyticsService;
