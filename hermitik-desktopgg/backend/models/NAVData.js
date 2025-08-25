const mongoose = require('mongoose');

const NAVDataSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Core NAV values - support both user-level and wallet-level net flows
  netFlows: {
    type: Number,
    default: 0
  },
  
  // Wallet-specific net flows
  walletNetFlows: {
    type: Map,
    of: Number,
    default: new Map()
  },
  
  priorPreFeeNav: {
    type: Number,
    default: 0
  },
  
  currentPreFeeNav: {
    type: Number,
    default: 0
  },
  
  performance: {
    type: Number,
    default: 0
  },
  
  // Monthly NAV tracking for volatility calculation
  monthlyNavHistory: [{
    date: {
      type: Date,
      required: true
    },
    nav: {
      type: Number,
      required: true
    },
    monthlyReturn: {
      type: Number,
      default: null // Will be calculated
    }
  }],
  
  // Calculated metrics
  volatilityMetrics: {
    monthlyReturns: [Number], // Array of monthly return percentages
    standardDeviation: {
      type: Number,
      default: 0
    },
    annualizedVolatility: {
      type: Number,
      default: 0
    },
    lastCalculated: {
      type: Date,
      default: Date.now
    }
  },
  
  // Metadata
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  
  version: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true
});

// Indexes for performance
NAVDataSchema.index({ userId: 1 }, { unique: true });
NAVDataSchema.index({ lastUpdated: -1 });
NAVDataSchema.index({ 'monthlyNavHistory.date': -1 });

// Methods for volatility calculation
NAVDataSchema.methods.calculateMonthlyReturns = function() {
  const history = this.monthlyNavHistory.sort((a, b) => new Date(a.date) - new Date(b.date));
  const returns = [];
  
  for (let i = 1; i < history.length; i++) {
    const currentNav = history[i].nav;
    const previousNav = history[i-1].nav;
    
    if (previousNav > 0) {
      const monthlyReturn = ((currentNav - previousNav) / previousNav) * 100;
      returns.push(monthlyReturn);
      
      // Update the monthly return in history
      history[i].monthlyReturn = monthlyReturn;
    }
  }
  
  return returns;
};

NAVDataSchema.methods.calculateStandardDeviation = function(returns) {
  if (returns.length < 2) return 0;
  
  const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
  const squaredDifferences = returns.map(ret => Math.pow(ret - mean, 2));
  const variance = squaredDifferences.reduce((sum, diff) => sum + diff, 0) / (returns.length - 1);
  
  return Math.sqrt(variance);
};

NAVDataSchema.methods.calculateAnnualizedVolatility = function() {
  const returns = this.calculateMonthlyReturns();
  
  if (returns.length < 2) {
    this.volatilityMetrics.annualizedVolatility = 0;
    return 0;
  }
  
  const standardDeviation = this.calculateStandardDeviation(returns);
  const annualizedVol = standardDeviation * Math.sqrt(12);
  
  // Update metrics
  this.volatilityMetrics.monthlyReturns = returns;
  this.volatilityMetrics.standardDeviation = standardDeviation;
  this.volatilityMetrics.annualizedVolatility = annualizedVol;
  this.volatilityMetrics.lastCalculated = new Date();
  
  return annualizedVol;
};

NAVDataSchema.methods.addMonthlyNav = function(date, nav) {
  // Check if entry for this month already exists
  const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
  const existingIndex = this.monthlyNavHistory.findIndex(entry => {
    const entryMonthKey = `${entry.date.getFullYear()}-${entry.date.getMonth()}`;
    return entryMonthKey === monthKey;
  });
  
  if (existingIndex >= 0) {
    // Update existing entry
    this.monthlyNavHistory[existingIndex].nav = nav;
    this.monthlyNavHistory[existingIndex].date = date;
  } else {
    // Add new entry
    this.monthlyNavHistory.push({ date, nav });
  }
  
  // Keep only last 24 months for performance
  this.monthlyNavHistory.sort((a, b) => new Date(b.date) - new Date(a.date));
  if (this.monthlyNavHistory.length > 24) {
    this.monthlyNavHistory = this.monthlyNavHistory.slice(0, 24);
  }
  
  // Recalculate volatility
  this.calculateAnnualizedVolatility();
};

NAVDataSchema.methods.updateNetFlows = function(netFlows) {
  this.netFlows = netFlows;
  this.lastUpdated = new Date();
  this.version += 1;
};

// Method to update wallet-specific net flows
NAVDataSchema.methods.updateWalletNetFlows = function(walletAddress, newNetFlows) {
  this.walletNetFlows.set(walletAddress, newNetFlows);
  this.lastUpdated = new Date();
  this.version += 1;
};

// Method to get wallet-specific net flows
NAVDataSchema.methods.getWalletNetFlows = function(walletAddress) {
  return this.walletNetFlows.get(walletAddress) || 0;
};

// Method to get total net flows (user-level + sum of wallet-specific)
NAVDataSchema.methods.getTotalNetFlows = function() {
  const walletTotal = Array.from(this.walletNetFlows.values()).reduce((sum, value) => sum + value, 0);
  return this.netFlows + walletTotal;
};

NAVDataSchema.methods.updateNavValues = function(priorNav, currentNav, performance) {
  this.priorPreFeeNav = priorNav !== undefined ? priorNav : this.priorPreFeeNav;
  this.currentPreFeeNav = currentNav !== undefined ? currentNav : this.currentPreFeeNav;
  this.performance = performance !== undefined ? performance : this.performance;
  this.lastUpdated = new Date();
  this.version += 1;
  
  // Add current NAV to monthly history if it's a new month
  if (currentNav !== undefined && currentNav > 0) {
    const now = new Date();
    this.addMonthlyNav(now, currentNav);
  }
};

// Static method to get or create NAV data for user
NAVDataSchema.statics.getOrCreateForUser = async function(userId) {
  let navData = await this.findOne({ userId });
  
  if (!navData) {
    navData = new this({
      userId,
      netFlows: 0,
      priorPreFeeNav: 0,
      currentPreFeeNav: 0,
      performance: 0,
      monthlyNavHistory: [],
      volatilityMetrics: {
        monthlyReturns: [],
        standardDeviation: 0,
        annualizedVolatility: 0,
        lastCalculated: new Date()
      }
    });
    await navData.save();
  }
  
  return navData;
};

module.exports = mongoose.model('NAVData', NAVDataSchema);
