const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const NAVData = require('../models/NAVData');
const ApiResponse = require('../utils/responseFormatter');
const { AppError, catchAsync } = require('../middleware/errorHandler');

// Import performance middleware
const { walletDataCache, invalidateCache } = require('../middleware/performance');
const { validateEmail, handleValidationErrors } = require('../middleware/security');
const { logger } = require('../utils/logger');

// Get NAV data for authenticated user or admin viewing specific user
router.get('/', auth, catchAsync(async (req, res) => {
  let userId = req.user.id;
  
  // Admin can view other users' NAV data
  if (req.user.role === 'admin' && req.query.userId) {
    userId = req.query.userId;
    logger.info('Admin fetching NAV data for user', { adminId: req.user.id, targetUserId: userId });
  } else {
    logger.info('Fetching NAV data', { userId: req.user.id });
  }
  
  console.log('🔥 NAV ROUTE: Fetching NAV data for userId:', userId);
  console.log('🔥 NAV ROUTE: Query params:', req.query);
  console.log('🔥 NAV ROUTE: User role:', req.user.role);
  
  const navData = await NAVData.getOrCreateForUser(userId);
  
  // Calculate fresh volatility if needed
  const volatility = navData.calculateAnnualizedVolatility();
  await navData.save();
  
  const responseData = {
    navData: {
      netFlows: navData.netFlows,
      walletNetFlows: Object.fromEntries(navData.walletNetFlows),
      totalNetFlows: navData.getTotalNetFlows(),
      priorPreFeeNav: navData.priorPreFeeNav,
      currentPreFeeNav: navData.currentPreFeeNav,
      performance: navData.performance,
      version: navData.version
    },
    volatilityMetrics: {
      annualizedVolatility: navData.volatilityMetrics.annualizedVolatility,
      standardDeviation: navData.volatilityMetrics.standardDeviation,
      monthlyReturns: navData.volatilityMetrics.monthlyReturns,
      monthsOfData: navData.monthlyNavHistory.length,
      lastCalculated: navData.volatilityMetrics.lastCalculated
    },
    monthlyHistory: navData.monthlyNavHistory.map(entry => ({
      date: entry.date,
      nav: entry.nav,
      monthlyReturn: entry.monthlyReturn
    })).sort((a, b) => new Date(b.date) - new Date(a.date))
  };
  
  console.log('🔥 NAV ROUTE: Sending NAV data:', responseData);
  
  res.json(ApiResponse.success(responseData, 'NAV data retrieved successfully'));
}));

// Update net flows (user-level)
router.post('/netflows', auth, catchAsync(async (req, res) => {
  const { netFlows, userId: targetUserId } = req.body;
  
  let userId = req.user.id;
  
  // Admin can update other users' NAV data
  if (req.user.role === 'admin' && targetUserId) {
    userId = targetUserId;
    logger.info('Admin updating net flows for user', { adminId: req.user.id, targetUserId: userId, newNetFlows: netFlows });
  } else {
    logger.info('Updating net flows', { userId: req.user.id, newNetFlows: netFlows });
  }
  
  if (typeof netFlows !== 'number') {
    throw new AppError('Net flows must be a number', 400);
  }
  
  const navData = await NAVData.getOrCreateForUser(userId);
  const oldNetFlows = navData.netFlows;
  
  navData.updateNetFlows(netFlows);
  await navData.save();
  
  // Invalidate cache for this user
  invalidateCache.user(userId);
  
  logger.business.walletAdded(userId, 'net_flows_updated', {
    oldValue: oldNetFlows,
    newValue: netFlows
  });
  
  res.json(ApiResponse.success({
    netFlows: navData.netFlows,
    previousNetFlows: oldNetFlows,
    version: navData.version,
    lastUpdated: navData.lastUpdated
  }, 'Net flows updated successfully'));
}));

// Update wallet-specific net flows
router.post('/wallet-netflows', auth, catchAsync(async (req, res) => {
  const { walletAddress, netFlows, userId: targetUserId } = req.body;
  
  let userId = req.user.id;
  
  // Admin can update other users' NAV data
  if (req.user.role === 'admin' && targetUserId) {
    userId = targetUserId;
    logger.info('Admin updating wallet net flows for user', { adminId: req.user.id, targetUserId: userId, walletAddress, newNetFlows: netFlows });
  } else {
    logger.info('Updating wallet net flows', { userId: req.user.id, walletAddress, newNetFlows: netFlows });
  }
  
  if (!walletAddress || typeof netFlows !== 'number') {
    throw new AppError('Wallet address and net flows are required', 400);
  }
  
  const navData = await NAVData.getOrCreateForUser(userId);
  const oldNetFlows = navData.getWalletNetFlows(walletAddress);
  
  navData.updateWalletNetFlows(walletAddress, netFlows);
  await navData.save();
  
  // Invalidate cache for this user
  invalidateCache.user(userId);
  
  logger.business.walletAdded(userId, 'wallet_net_flows_updated', {
    walletAddress,
    oldValue: oldNetFlows,
    newValue: netFlows
  });
  
  res.json(ApiResponse.success({
    walletAddress,
    netFlows: navData.getWalletNetFlows(walletAddress),
    previousNetFlows: oldNetFlows,
    totalNetFlows: navData.getTotalNetFlows(),
    version: navData.version,
    lastUpdated: navData.lastUpdated
  }, 'Wallet net flows updated successfully'));
}));

// Update NAV values (prior NAV, current NAV, performance)
router.post('/values', auth, catchAsync(async (req, res) => {
  const { priorPreFeeNav, currentPreFeeNav, performance } = req.body;
  
  logger.info('Updating NAV values', { 
    userId: req.user.id, 
    priorNav: priorPreFeeNav,
    currentNav: currentPreFeeNav,
    performance
  });
  
  // Validate inputs
  if (priorPreFeeNav !== undefined && typeof priorPreFeeNav !== 'number') {
    throw new AppError('Prior pre-fee NAV must be a number', 400);
  }
  if (currentPreFeeNav !== undefined && typeof currentPreFeeNav !== 'number') {
    throw new AppError('Current pre-fee NAV must be a number', 400);
  }
  if (performance !== undefined && typeof performance !== 'number') {
    throw new AppError('Performance must be a number', 400);
  }
  
  const navData = await NAVData.getOrCreateForUser(req.user.id);
  
  navData.updateNavValues(priorPreFeeNav, currentPreFeeNav, performance);
  await navData.save();
  
  // Invalidate cache for this user
  invalidateCache.user(req.user.id);
  
  logger.info('NAV values updated', {
    userId: req.user.id,
    navData: {
      priorPreFeeNav: navData.priorPreFeeNav,
      currentPreFeeNav: navData.currentPreFeeNav,
      performance: navData.performance
    },
    volatilityCalculated: navData.volatilityMetrics.annualizedVolatility
  });
  
  res.json(ApiResponse.success({
    navData: {
      netFlows: navData.netFlows,
      priorPreFeeNav: navData.priorPreFeeNav,
      currentPreFeeNav: navData.currentPreFeeNav,
      performance: navData.performance,
      version: navData.version
    },
    volatilityMetrics: {
      annualizedVolatility: navData.volatilityMetrics.annualizedVolatility,
      standardDeviation: navData.volatilityMetrics.standardDeviation,
      monthsOfData: navData.monthlyNavHistory.length
    },
    lastUpdated: navData.lastUpdated
  }, 'NAV values updated successfully'));
}));

// Add monthly NAV entry manually
router.post('/monthly', auth, catchAsync(async (req, res) => {
  const { date, nav } = req.body;
  
  if (!date || typeof nav !== 'number') {
    throw new AppError('Date and NAV value are required', 400);
  }
  
  const navDate = new Date(date);
  if (isNaN(navDate.getTime())) {
    throw new AppError('Invalid date format', 400);
  }
  
  logger.info('Adding monthly NAV entry', { 
    userId: req.user.id, 
    date: navDate,
    nav
  });
  
  const navData = await NAVData.getOrCreateForUser(req.user.id);
  
  navData.addMonthlyNav(navDate, nav);
  await navData.save();
  
  res.json(ApiResponse.success({
    monthlyHistory: navData.monthlyNavHistory.map(entry => ({
      date: entry.date,
      nav: entry.nav,
      monthlyReturn: entry.monthlyReturn
    })).sort((a, b) => new Date(b.date) - new Date(a.date)),
    volatilityMetrics: {
      annualizedVolatility: navData.volatilityMetrics.annualizedVolatility,
      standardDeviation: navData.volatilityMetrics.standardDeviation,
      monthlyReturns: navData.volatilityMetrics.monthlyReturns
    }
  }, 'Monthly NAV entry added successfully'));
}));

// Get volatility calculation details
router.get('/volatility', auth, catchAsync(async (req, res) => {
  const navData = await NAVData.getOrCreateForUser(req.user.id);
  
  // Recalculate to ensure fresh data
  const annualizedVol = navData.calculateAnnualizedVolatility();
  await navData.save();
  
  res.json(ApiResponse.success({
    annualizedVolatility: annualizedVol,
    standardDeviation: navData.volatilityMetrics.standardDeviation,
    monthlyReturns: navData.volatilityMetrics.monthlyReturns,
    monthsOfData: navData.monthlyNavHistory.length,
    calculation: {
      formula: 'Standard Deviation of Monthly Returns × √12',
      monthlyStdDev: navData.volatilityMetrics.standardDeviation,
      sqrtTwelve: Math.sqrt(12),
      result: annualizedVol
    },
    monthlyHistory: navData.monthlyNavHistory.map(entry => ({
      date: entry.date,
      nav: entry.nav,
      monthlyReturn: entry.monthlyReturn
    })).sort((a, b) => new Date(b.date) - new Date(a.date)),
    lastCalculated: navData.volatilityMetrics.lastCalculated
  }, 'Volatility calculation retrieved successfully'));
}));

// Reset NAV data (for testing/admin purposes)
router.delete('/reset', auth, catchAsync(async (req, res) => {
  logger.warn('NAV data reset requested', { userId: req.user.id });
  
  await NAVData.findOneAndDelete({ userId: req.user.id });
  
  // Invalidate cache for this user
  invalidateCache.user(req.user.id);
  
  res.json(ApiResponse.success({}, 'NAV data reset successfully'));
}));

module.exports = router;
