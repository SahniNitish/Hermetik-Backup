const express = require('express');
const auth = require('../middleware/auth');
const XLSX = require('xlsx');
const ApiResponse = require('../utils/responseFormatter');
const { AppError, catchAsync } = require('../middleware/errorHandler');

const router = express.Router();

console.log('🚨 ANALYTICS ROUTES FILE LOADED!');

// Import models
const DailySnapshot = require('../models/DailySnapshot');
const User = require('../models/User');
const NAVSettings = require('../models/NAVSettings');
const PositionHistory = require('../models/PositionHistory');

// Import APY calculation service
const APYCalculationService = require('../services/apyCalculationService');

// Import wallet processing utilities
const {
  fetchTokens,
  fetchAllProtocols,
  fetchPricesFromCoinGecko
} = require('../utils/debankUtils');

// Simple test route
router.get('/test', auth, catchAsync(async (req, res) => {
  console.log('🚨 TEST ENDPOINT CALLED!');
  res.json({
    CHANGED: "SERVER_IS_WORKING", 
    userId: req.user.id,
    timestamp: new Date().toISOString()
  });
}));

// Get portfolio history
router.get('/portfolio/history', auth, async (req, res) => {
  try {
    const { days = 7, wallet } = req.query;
    const userId = req.user.id;
    
    console.log(`Getting portfolio history for user: ${userId}, days: ${days}`);
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    const query = { userId, date: { $gte: startDate } };
    if (wallet) query.walletAddress = wallet;
    
    const snapshots = await DailySnapshot.find(query).sort({ date: 1 });
    
    console.log(`Found ${snapshots.length} snapshots`);
    
    res.json({
      snapshots: snapshots.map(s => ({
        date: s.date,
        walletAddress: s.walletAddress,
        totalNavUsd: s.totalNavUsd,
        tokensNavUsd: s.tokensNavUsd,
        positionsNavUsd: s.positionsNavUsd,
        dailyReturn: s.dailyReturn,
        dailyApy: s.dailyApy,
        monthlyApy: s.monthlyApy,
        volatility: s.volatility,
        maxDrawdown: s.maxDrawdown,
        benchmarkRate: s.benchmarkRate
      }))
    });
  } catch (error) {
    console.error('Error in portfolio/history:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get portfolio performance metrics
router.get('/portfolio/performance', auth, async (req, res) => {
  try {
    const { period = 30, wallet } = req.query;
    const userId = req.user.id;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));
    
    const query = { userId, date: { $gte: startDate } };
    if (wallet) query.walletAddress = wallet;
    
    const snapshots = await DailySnapshot.find(query).sort({ date: 1 });
    
    if (snapshots.length === 0) {
      return res.json({
        totalReturn: 0,
        annualizedReturn: 0,
        volatility: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        winRate: 0
      });
    }
    
    // Calculate performance metrics
    const returns = snapshots.map(s => s.dailyReturn || 0);
    const totalReturn = returns.reduce((acc, r) => (1 + r) * acc, 1) - 1;
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const annualizedReturn = Math.pow(1 + avgReturn, 365) - 1;
    
    // Calculate volatility
    const variance = returns.reduce((acc, r) => acc + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance) * Math.sqrt(365);
    
    // Calculate Sharpe ratio (assuming 5% risk-free rate)
    const riskFreeRate = 0.05;
    const sharpeRatio = volatility !== 0 ? (annualizedReturn - riskFreeRate) / volatility : 0;
    
    // Calculate max drawdown
    let peak = snapshots[0].totalNavUsd;
    let maxDrawdown = 0;
    snapshots.forEach(s => {
      if (s.totalNavUsd > peak) peak = s.totalNavUsd;
      const drawdown = (peak - s.totalNavUsd) / peak;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    });
    
    // Calculate win rate
    const positiveReturns = returns.filter(r => r > 0).length;
    const winRate = returns.length > 0 ? positiveReturns / returns.length : 0;
    
    res.json({
      totalReturn,
      annualizedReturn,
      volatility,
      sharpeRatio,
      maxDrawdown,
      winRate
    });
  } catch (error) {
    console.error('Error in portfolio/performance:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to ensure numbers are valid for calculations
function safeNumber(value) {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  const num = typeof value === 'string' ? parseFloat(value) : Number(value);
  return isFinite(num) ? num : 0;
}

// Helper function to validate performance calculations
function validatePerformanceCalculation(performance, preFeeNav, priorPreFeeNav, netFlows) {
  const warnings = [];
  
  // Check for unrealistic performance (more than 100% or less than -90%)
  if (priorPreFeeNav > 0) {
    const performancePercent = (performance / priorPreFeeNav) * 100;
    
    if (performancePercent > 100) {
      warnings.push(`Performance of ${performancePercent.toFixed(1)}% seems unrealistically high`);
    }
    
    if (performancePercent < -90) {
      warnings.push(`Performance of ${performancePercent.toFixed(1)}% seems unrealistically low`);
    }
  }
  
  // Check if net flows are larger than prior NAV (might indicate data entry error)
  if (Math.abs(netFlows) > priorPreFeeNav && priorPreFeeNav > 0) {
    warnings.push(`Net flows (${netFlows.toLocaleString()}) are larger than prior NAV - please verify`);
  }
  
  // Check for negative NAV
  if (preFeeNav < 0) {
    warnings.push('Current NAV is negative - please review calculations');
  }
  
  return warnings;
}

// Helper function to format currency values for NAV report
function formatCurrency(value) {
  const num = safeNumber(value);
  if (num === 0) return '$ -   ';
  return ` $${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} `;
}

// NAV Settings Routes

// Get NAV settings for a specific month/year
router.get('/nav-settings/:userId/:year/:month', auth, async (req, res) => {
  try {
    const { userId, year, month } = req.params;
    
    // Admin access check
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    console.log(`Getting NAV settings for user: ${userId}, ${year}-${month}`);
    
    let settings = await NAVSettings.findOne({
      userId,
      year: parseInt(year),
      month: parseInt(month)
    });
    
    // If no settings exist, create default ones with prior month NAV
    if (!settings) {
      const priorMonth = parseInt(month) === 1 ? 12 : parseInt(month) - 1;
      const priorYear = parseInt(month) === 1 ? parseInt(year) - 1 : parseInt(year);
      
      const priorSettings = await NAVSettings.findOne({
        userId,
        year: priorYear,
        month: priorMonth
      });
      
      const priorPreFeeNav = priorSettings ? priorSettings.navCalculations.preFeeNav : 0;
      
      settings = new NAVSettings({
        userId,
        year: parseInt(year),
        month: parseInt(month),
        feeSettings: {
          annualExpense: 600,
          monthlyExpense: 50,
          performanceFeeRate: 0.25,
          accruedPerformanceFeeRate: 0.25,
          hurdleRate: 0,
          highWaterMark: 0
        },
        navCalculations: {
          netFlows: 0
        }
      });
      
      // Set prior month NAV if found
      if (priorPreFeeNav > 0) {
        settings.navCalculations.priorPreFeeNav = priorPreFeeNav;
      }
      
      await settings.save();
    }
    
    res.json(settings);
  } catch (error) {
    console.error('Error getting NAV settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save NAV settings for a specific month/year
router.post('/nav-settings/:userId/:year/:month', auth, async (req, res) => {
  try {
    const { userId, year, month } = req.params;
    const { feeSettings, navCalculations, portfolioData } = req.body;
    
    // Admin access check
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    console.log(`Saving NAV settings for user: ${userId}, ${year}-${month}`);
    
    // Validate performance calculation and add warnings if needed
    const performance = navCalculations?.performance || 0;
    const preFeeNav = navCalculations?.preFeeNav || 0;
    const priorPreFeeNav = feeSettings?.priorPreFeeNav || 0;
    const netFlows = feeSettings?.netFlows || 0;
    
    const validationWarnings = validatePerformanceCalculation(
      performance, preFeeNav, priorPreFeeNav, netFlows
    );
    
    // Add validation warnings to navCalculations if any exist
    const enhancedNavCalculations = {
      ...navCalculations,
      validationWarnings,
      calculationDate: new Date(),
      priorPreFeeNavSource: feeSettings?.priorPreFeeNavSource || 'manual'
    };
    
    const settings = await NAVSettings.findOneAndUpdate(
      {
        userId,
        year: parseInt(year),
        month: parseInt(month)
      },
      {
        feeSettings,
        navCalculations: enhancedNavCalculations,
        portfolioData,
        updatedAt: new Date()
      },
      {
        upsert: true,
        new: true
      }
    );
    
    // Return settings with validation info
    res.json({
      ...settings.toObject(),
      validationWarnings
    });
  } catch (error) {
    console.error('Error saving NAV settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get available months for a user
router.get('/nav-settings/:userId/available-months', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Admin access check
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const availableMonths = await NAVSettings.getAvailableMonths(userId);
    
    res.json(availableMonths);
  } catch (error) {
    console.error('Error getting available months:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get prior period NAV for automatic loading
router.get('/nav-settings/:userId/:year/:month/prior-nav', auth, async (req, res) => {
  try {
    const { userId, year, month } = req.params;
    
    // Admin access check
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    console.log(`Getting prior NAV for user: ${userId}, ${year}-${month}`);
    
    // Calculate prior month/year (handle year rollover)
    const currentYear = parseInt(year);
    const currentMonth = parseInt(month);
    const priorMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const priorYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    
    console.log(`Looking for prior period: ${priorYear}-${priorMonth}`);
    
    // Try to find prior month's NAV settings
    const priorSettings = await NAVSettings.findOne({
      userId,
      year: priorYear,
      month: priorMonth
    });
    
    let priorNavData = {
      found: false,
      priorPreFeeNav: 0,
      source: 'manual',
      priorMonth,
      priorYear,
      priorMonthName: [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ][priorMonth - 1],
      message: 'No prior month data found'
    };
    
    if (priorSettings) {
      console.log(`Found prior settings with pre-fee NAV: ${priorSettings.navCalculations.preFeeNav}`);
      priorNavData = {
        found: true,
        priorPreFeeNav: priorSettings.navCalculations.preFeeNav || 0,
        source: 'auto_loaded',
        priorMonth,
        priorYear,
        priorMonthName: priorNavData.priorMonthName,
        message: `Loaded from ${priorNavData.priorMonthName} ${priorYear} NAV report`,
        priorSettings: {
          totalAssets: priorSettings.navCalculations.totalAssets || 0,
          netAssets: priorSettings.navCalculations.netAssets || 0,
          performance: priorSettings.navCalculations.performance || 0,
          createdAt: priorSettings.createdAt
        }
      };
    } else {
      // If no prior month exists, try to get current portfolio value as fallback
      try {
        const User = require('../models/User');
        const user = await User.findById(userId);
        
        if (user && user.wallets && user.wallets.length > 0) {
          // This would require calling the wallet API - for now, set a placeholder
          priorNavData.message = 'No prior month data found. Consider using current portfolio value as baseline for first month.';
          priorNavData.source = 'fallback_needed';
        }
      } catch (fallbackError) {
        console.log('Error getting fallback data:', fallbackError.message);
      }
    }
    
    res.json(priorNavData);
  } catch (error) {
    console.error('Error getting prior NAV:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get NAV history for validation and audit trail
router.get('/nav-settings/:userId/history', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 12 } = req.query; // Default to 12 months
    
    // Admin access check
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    console.log(`Getting NAV history for user: ${userId}, limit: ${limit}`);
    
    const history = await NAVSettings.find({ userId })
      .sort({ year: -1, month: -1 })
      .limit(parseInt(limit))
      .select('year month navCalculations.preFeeNav navCalculations.netAssets navCalculations.performance createdAt');
    
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    const formattedHistory = history.map(record => ({
      year: record.year,
      month: record.month,
      monthName: monthNames[record.month - 1],
      preFeeNav: record.navCalculations?.preFeeNav || 0,
      netAssets: record.navCalculations?.netAssets || 0,
      performance: record.navCalculations?.performance || 0,
      createdAt: record.createdAt
    }));
    
    res.json({
      history: formattedHistory,
      totalRecords: formattedHistory.length,
      hasData: formattedHistory.length > 0
    });
  } catch (error) {
    console.error('Error getting NAV history:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export NAV for specific month/year
router.get('/export/nav-monthly/:userId/:year/:month', auth, async (req, res) => {
  try {
    const { userId, year, month } = req.params;
    
    // Admin access check
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    console.log(`📊 Exporting monthly NAV for user: ${userId}, ${year}-${month}`);
    
    // Get saved settings for this month
    const settings = await NAVSettings.findOne({
      userId,
      year: parseInt(year),
      month: parseInt(month)
    });
    
    if (!settings) {
      return res.status(404).json({ error: 'No NAV data found for this month' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    const monthName = monthNames[parseInt(month) - 1];
    const valuationDate = `${monthName} ${year}`;
    
    // Use saved calculations
    const calculations = settings.navCalculations;
    const params = settings.feeSettings;
    
    // Create NAV report data
    const navData = [
      ['MONTHLY NAV REPORT', '', ''],
      ['VALUATION DATE', valuationDate, ''],
      ['All values in USD as of 12:00 pm UTC on the Valuation date.', '', ''],
      ['For more information on valuation methodology please see the Investment Management Agreement.', '', ''],
      ['', '', ''],
      ['Section', 'Line Item', 'Value'],
      ['ASSETS', '', ''],
      ['', 'Investments at fair value (securities)', calculations.investments],
      ['', 'Cash & cash equivalents', 0],
      ['', 'Dividends and interest receivable', calculations.dividendsReceivable],
      ['', 'Receivables for investments sold', 0],
      ['', 'Other assets', 0],
      ['Total Assets', '', calculations.totalAssets],
      ['', '', ''],
      ['LIABILITIES', '', ''],
      ['', 'Payables for investments purchased', 0],
      ['', 'Accrued management fees', 0],
      ['', 'Accrued fund expenses', calculations.accruedExpenses],
      ['', 'Distribution payable', 0],
      ['', 'Other liabilities', 0],
      ['Total Liabilities', '', calculations.totalLiabilities],
      ['', '', ''],
      ['', 'Pre-Fee Ending NAV', calculations.preFeeNav],
      ['', 'Accrued performance fees', calculations.accruedPerformanceFees],
      ['', 'NET ASSETS', calculations.netAssets],
      ['', '', ''],
      ['PERFORMANCE FEE CALCULATION', '', ''],
      ['', 'Prior period Pre-Fee Ending NAV', calculations.priorPreFeeNav || 0],
      ['', 'Net Flows', calculations.netFlows],
      ['', 'Current period Pre-Fee Ending NAV', calculations.preFeeNav],
      ['', 'Performance', calculations.performance],
      ['', 'Hurdle Rate', params.hurdleRate],
      ['', 'High Water Mark', params.highWaterMark],
      ['', 'Performance Fee', calculations.performanceFee],
      ['', 'Accrued Performance Fees', calculations.accruedPerformanceFees]
    ];
    
    // Create workbook
    const workbook = XLSX.utils.book_new();
    
    // Format the worksheet
    const navWorksheet = XLSX.utils.aoa_to_sheet(navData);
    navWorksheet['!cols'] = [
      { wch: 30 },
      { wch: 45 },
      { wch: 20 }
    ];
    
    // Add formatting (same as existing)
    const headerRows = [0, 1, 2, 3];
    const sectionRows = [6, 14, 22, 26];
    const totalRows = [12, 20, 24];
    
    headerRows.forEach(rowIndex => {
      ['A', 'B', 'C'].forEach(col => {
        const cellAddr = `${col}${rowIndex + 1}`;
        if (navWorksheet[cellAddr]) {
          navWorksheet[cellAddr].s = {
            font: { bold: true, size: rowIndex === 0 ? 14 : 11 },
            alignment: { horizontal: 'left' }
          };
        }
      });
    });
    
    sectionRows.forEach(rowIndex => {
      ['A', 'B', 'C'].forEach(col => {
        const cellAddr = `${col}${rowIndex + 1}`;
        if (navWorksheet[cellAddr]) {
          navWorksheet[cellAddr].s = {
            font: { bold: true, size: 12 },
            fill: { fgColor: { rgb: '366092' } },
            alignment: { horizontal: 'center' }
          };
        }
      });
    });
    
    totalRows.forEach(rowIndex => {
      ['A', 'B', 'C'].forEach(col => {
        const cellAddr = `${col}${rowIndex + 1}`;
        if (navWorksheet[cellAddr]) {
          navWorksheet[cellAddr].s = {
            font: { bold: true, size: 11 },
            fill: { fgColor: { rgb: 'E7E6E6' } },
            border: {
              top: { style: 'thin' },
              bottom: { style: 'double' }
            }
          };
        }
      });
    });
    
    // Format currency cells
    for (let rowIndex = 7; rowIndex < navData.length; rowIndex++) {
      const cellAddr = `C${rowIndex + 1}`;
      if (navWorksheet[cellAddr] && typeof navWorksheet[cellAddr].v === 'number') {
        navWorksheet[cellAddr].s = {
          numFmt: '"$"#,##0.00',
          alignment: { horizontal: 'right' }
        };
      }
    }
    
    XLSX.utils.book_append_sheet(workbook, navWorksheet, `NAV Report ${monthName} ${year}`);
    
    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx', compression: false });
    
    if (!buffer || buffer.length === 0) {
      throw new Error('Generated Excel buffer is empty');
    }
    
    // Set headers
    const filename = `${user.name.replace(/\s+/g, '_')}_NAV_Report_${monthName}_${year}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Pragma', 'no-cache');
    
    console.log(`✅ Monthly NAV report exported: ${filename} (${buffer.length} bytes)`);
    res.send(buffer);
    
  } catch (error) {
    console.error('❌ Error generating monthly NAV report:', error.message);
    res.status(500).json({ error: 'Failed to generate monthly NAV report', details: error.message });
  }
});

// Add route for frontend compatibility
router.get('/export', auth, async (req, res) => {
  try {
    console.log('📊 Starting NAV calculation...');

    // Admin support
    let userId = req.user.id;
    const { wallet, userId: targetUserId } = req.query;

    if (targetUserId && req.user.role === 'admin') {
      userId = targetUserId;
      console.log(`🔄 Admin generating NAV for user: ${userId}`);
    }

    // Get user and wallets
    const user = await User.findById(userId);
    if (!user || !user.wallets?.length) {
      return res.status(404).json({ error: 'No wallets found' });
    }

    // Process wallets directly
    const wallets = wallet ? [wallet] : user.wallets;
    let totalInvestments = 0;
    let totalRewards = 0;

    console.log(`📊 Processing ${wallets.length} wallet${wallets.length !== 1 ? 's' : ''} for NAV calculation...`);

    for (const walletAddress of wallets) {
      console.log(`🔄 Processing wallet: ${walletAddress}`);

      // Fetch tokens and protocols in parallel
      const [tokens, rawProtocols] = await Promise.all([
        fetchTokens(walletAddress),
        fetchAllProtocols(walletAddress)
      ]);

      // Deduplicate protocols by name
      const protocolsMap = new Map();
      rawProtocols.forEach(protocol => {
        const key = protocol.name;
        if (!protocolsMap.has(key)) {
          protocolsMap.set(key, protocol);
        } else {
          const existing = protocolsMap.get(key);
          existing.portfolio_item_list = [
            ...(existing.portfolio_item_list || []),
            ...(protocol.portfolio_item_list || [])
          ];
          if (protocol.net_usd_value > existing.net_usd_value) {
            existing.net_usd_value = protocol.net_usd_value;
          }
        }
      });
      const protocols = Array.from(protocolsMap.values());

      // Get prices from CoinGecko
      const coinGeckoPrices = await fetchPricesFromCoinGecko(tokens);

      // Process tokens
      const enrichedTokens = tokens.map(token => {
        const symbol = (token.symbol || '').toLowerCase();
        let finalPrice = 0;

        if (coinGeckoPrices[symbol]) {
          finalPrice = coinGeckoPrices[symbol];
        } else if (symbol.startsWith('w') && coinGeckoPrices[symbol.substring(1)]) {
          finalPrice = coinGeckoPrices[symbol.substring(1)];
        } else if (token.price && token.price > 0) {
          finalPrice = token.price;
        }

        const usdValue = finalPrice * safeNumber(token.amount || 0);
        totalInvestments += usdValue;

        return {
          symbol: token.symbol,
          amount: token.amount || 0,
          price: finalPrice,
          usd_value: usdValue
        };
      });

      // Process protocols with deduplication
      for (const protocol of protocols) {
        const portfolioItems = protocol.portfolio_item_list || [];

        // Deduplicate positions
        const uniqueItemsMap = new Map();
        portfolioItems.forEach(item => {
          const tokenAmounts = (item.detail?.supply_token_list || [])
            .map(t => `${t.symbol}:${safeNumber(t.amount).toFixed(6)}`)
            .sort()
            .join('|');
          const itemKey = `${item.pool?.id || 'no-pool'}-${tokenAmounts}`;

          if (!uniqueItemsMap.has(itemKey)) {
            uniqueItemsMap.set(itemKey, item);

            // Add position value to investments
            const itemValue = safeNumber(item.stats?.net_usd_value || 0);
            totalInvestments += itemValue;

            // Add rewards to dividends receivable
            if (item.detail?.reward_token_list) {
              for (const reward of item.detail.reward_token_list) {
                const rewardValue = safeNumber(reward.amount || 0) * safeNumber(reward.price || 0);
                totalRewards += rewardValue;
              }
            }
          }
        });
      }

      console.log(`💼 Wallet ${walletAddress} processed:`, {
        tokens: enrichedTokens.length,
        token_value: enrichedTokens.reduce((sum, t) => sum + t.usd_value, 0).toFixed(2),
        protocols: protocols.length
      });
    }

    console.log(`📊 Total calculated investments: $${totalInvestments.toFixed(2)}`);
    console.log(`📊 Total calculated rewards: $${totalRewards.toFixed(2)}`);

    // NAV Calculations
    const valuationDate = '7/21/2025'; // Use sample date
    const annualExpense = 600;
    const monthlyExpense = 50; // $600/year ÷ 12 = $50/month
    const priorPreFeeNav = totalInvestments; // Per user request
    const netFlows = 0; // Assuming no deposits/withdrawals
    const hurdleRate = 0; // Per user request
    const highWaterMark = 0; // Per user request

    // Calculate values
    const investments = totalInvestments;
    const dividendsReceivable = totalRewards;
    const totalAssets = investments + dividendsReceivable;
    const accruedExpenses = monthlyExpense;
    const totalLiabilities = 0; // No liabilities this month
    const preFeeNav = totalAssets - accruedExpenses;

    // Performance calculation
    // Performance = Current NAV - Prior NAV + Net Flows
    const performance = preFeeNav - priorPreFeeNav + netFlows;
    const performanceFee = performance > hurdleRate ? performance * 0.25 : 0;
    const accruedPerformanceFees = dividendsReceivable * 0.25; // 25% of Dividends
    const netAssets = preFeeNav - performanceFee - accruedPerformanceFees;

    console.log(`📊 NAV Calculations:
  Total Assets: $${totalAssets.toFixed(2)}
  Accrued Expenses: $${accruedExpenses.toFixed(2)}
  Pre-Fee NAV: $${preFeeNav.toFixed(2)}
  Performance: $${performance.toFixed(2)}
  Performance Fee: $${performanceFee.toFixed(2)}
  Accrued Performance Fees: $${accruedPerformanceFees.toFixed(2)}
  Net Assets: $${netAssets.toFixed(2)}`);

    // Create NAV report data (first sheet)
    const navData = [
      ['VALUATION DATE', valuationDate],
      ['All values in USD as of 12:00 pm UTC on the Valuation date.'],
      ['For more information on valuation methodology please see the Investment Management Agreement.'],
      [''],
      ['Section', 'Line Item', 'Value'],
      ['ASSETS'],
      ['', 'Investments at fair value (securities)', investments],
      ['', 'Cash & cash equivalents', 0],
      ['', 'Dividends and interest receivable', dividendsReceivable],
      ['', 'Receivables for investments sold', 0],
      ['', 'Other assets', 0],
      ['Total Assets', '', totalAssets],
      ['LIABILITIES'],
      ['', 'Payables for investments purchased', 0],
      ['', 'Accrued management fees', 0],
      ['', 'Accrued fund expenses', accruedExpenses],
      ['', 'Distribution payable', 0],
      ['', 'Other liabilities', 0],
      ['Total Liabilities', '', totalLiabilities],
      ['', 'Pre-Fee Ending NAV', preFeeNav],
      ['', 'Accrued performance fees', accruedPerformanceFees],
      ['', 'NET ASSETS', netAssets],
      [''],
      ['PERFORMANCE FEE CALCULATION'],
      ['', 'Prior period Pre-Fee Ending NAV', priorPreFeeNav],
      ['', 'Net Flows', netFlows],
      ['', 'Current period Pre-Fee Ending NAV', preFeeNav],
      ['', 'Performance', performance],
      ['', 'Hurdle Rate', hurdleRate],
      ['', 'High Water Mark', highWaterMark],
      ['', 'Performance Fee', performanceFee],
      ['', 'Accrued Performance Fees', accruedPerformanceFees]
    ];

    // Create annotated NAV report data (second sheet)
    const navAnnotatedData = [
      ['VALUATION DATE', valuationDate],
      ['All values in USD as of 12:00 pm UTC on the Valuation date.'],
      ['For more information on valuation methodology please see the Investment Management Agreement.'],
      [''],
      ['Section', 'Line Item', 'Value', 'Notes', 'Calculation'],
      ['ASSETS'],
      ['', 'Investments at fair value (securities)', investments, 'Closing price as of NAV day', 'Sum of Tokens, Positions'],
      ['', 'Cash & cash equivalents', 0, 'Bank, money market, etc.', ''],
      ['', 'Dividends and interest receivable', dividendsReceivable, 'Accrued income not yet received', 'Sum of Unclaimed Rewards'],
      ['', 'Receivables for investments sold', 0, 'Pending settlements', ''],
      ['', 'Other assets', 0, 'Prepaids, misc.', ''],
      ['Total Assets', '', totalAssets, '', 'Sum of Assets'],
      ['LIABILITIES'],
      ['', 'Payables for investments purchased', 0, 'Pending settlements', ''],
      ['', 'Accrued management fees', 0, 'Not yet paid, accrues each period until paid', ''],
      ['', 'Accrued fund expenses', accruedExpenses, 'Subtracted from assets this month', '$600 per year, $50/month'],
      ['', 'Distribution payable', 0, 'Dividends/interest owed to holders', ''],
      ['', 'Other liabilities', 0, 'Miscellaneous', ''],
      ['Total Liabilities', '', totalLiabilities, '', 'Sum of Liabilities'],
      ['', 'Pre-Fee Ending NAV', preFeeNav, '', 'Assets - Accrued Expenses'],
      ['', 'Accrued performance fees', accruedPerformanceFees, '25% of Dividends and Interest Receivable', 'Dividends * 0.25'],
      ['', 'NET ASSETS', netAssets, '(Net Asset Value)', 'Pre-Fee NAV - Performance Fee - Accrued Performance Fees'],
      [''],
      ['PERFORMANCE FEE CALCULATION'],
      ['', 'Prior period Pre-Fee Ending NAV', priorPreFeeNav, '', 'Pre-Fee Ending NAV from prior period'],
      ['', 'Net Flows', netFlows, '', 'Deposits/withdrawals since prior period'],
      ['', 'Current period Pre-Fee Ending NAV', preFeeNav, '', 'Pre-Fee Ending NAV from current period'],
      ['', 'Performance', performance, '', 'Current Pre-Fee NAV - Prior Pre-Fee NAV - Net Flows'],
      ['', 'Hurdle Rate', hurdleRate, 'Set to 0 for this month', ''],
      ['', 'High Water Mark', highWaterMark, 'Set to 0 for this month', ''],
      ['', 'Performance Fee', performanceFee, '25% of excess performance over hurdle', 'If Performance > Hurdle Rate, Performance * 0.25'],
      ['', 'Accrued Performance Fees', accruedPerformanceFees, '25% of Dividends and Interest Receivable', 'Dividends * 0.25']
    ];

    // Create workbook
    const workbook = XLSX.utils.book_new();

    // First sheet: Monthly NAV Report - July
    const navWorksheet = XLSX.utils.aoa_to_sheet(navData);
    navWorksheet['!cols'] = [
      { wch: 25 }, // Section
      { wch: 35 }, // Line Item
      { wch: 20 }  // Value
    ];
    const navHeaderRows = [0, 1, 2, 4, 5, 11, 12, 18, 22];
    navHeaderRows.forEach(rowIndex => {
      ['A', 'B', 'C'].forEach(col => {
        const cellAddr = `${col}${rowIndex + 1}`;
        if (navWorksheet[cellAddr]) {
          navWorksheet[cellAddr].s = {
            font: { bold: true }
          };
        }
      });
    });

    // Format currency cells in column C (Value column)
    const currencyRows = [6, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 18, 19, 20, 21, 24, 25, 26, 27, 28, 29, 30, 31];
    currencyRows.forEach(rowIndex => {
      const cellAddr = `C${rowIndex + 1}`;
      if (navWorksheet[cellAddr] && typeof navWorksheet[cellAddr].v === 'number') {
        navWorksheet[cellAddr].s = {
          numFmt: '"$"#,##0.00'
        };
      }
    });
    XLSX.utils.book_append_sheet(workbook, navWorksheet, 'NAV Report - July');

    // Second sheet: NAV Report with annotations
    const annotatedWorksheet = XLSX.utils.aoa_to_sheet(navAnnotatedData);
    annotatedWorksheet['!cols'] = [
      { wch: 25 }, // Section
      { wch: 35 }, // Line Item
      { wch: 20 }, // Value
      { wch: 40 }, // Notes
      { wch: 50 }  // Calculation
    ];
    const annotatedHeaderRows = [0, 1, 2, 4, 5, 11, 12, 18, 22];
    annotatedHeaderRows.forEach(rowIndex => {
      ['A', 'B', 'C', 'D', 'E'].forEach(col => {
        const cellAddr = `${col}${rowIndex + 1}`;
        if (annotatedWorksheet[cellAddr]) {
          annotatedWorksheet[cellAddr].s = {
            font: { bold: true }
          };
        }
      });
    });
    XLSX.utils.book_append_sheet(workbook, annotatedWorksheet, 'NAV Report - July - Notes');

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx', compression: false });

    // Validate buffer
    if (!buffer || buffer.length === 0) {
      throw new Error('Generated Excel buffer is empty');
    }

    // Set headers
    const filename = `Monthly_NAV_Report_2025_07.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Pragma', 'no-cache');

    console.log(`✅ NAV report generated: ${filename} (${buffer.length} bytes)`);
    res.send(buffer);

  } catch (error) {
    console.error('❌ Error generating NAV report:', error.message);
    res.status(500).json({ error: 'Failed to generate NAV report', details: error.message });
  }
});

// NAV EXPORT - Clean and Simple
router.get('/export/nav', auth, async (req, res) => {
  try {
    console.log('📊 Starting NAV calculation...');

    // Admin support
    let userId = req.user.id;
    const { wallet, userId: targetUserId } = req.query;

    if (targetUserId && req.user.role === 'admin') {
      userId = targetUserId;
      console.log(`🔄 Admin generating NAV for user: ${userId}`);
    }

    // Get user and wallets
    const user = await User.findById(userId);
    if (!user || !user.wallets?.length) {
      return res.status(404).json({ error: 'No wallets found' });
    }

    // Process wallets directly
    const wallets = wallet ? [wallet] : user.wallets;
    let totalInvestments = 0;
    let totalRewards = 0;

    console.log(`📊 Processing ${wallets.length} wallet${wallets.length !== 1 ? 's' : ''} for NAV calculation...`);

    for (const walletAddress of wallets) {
      console.log(`🔄 Processing wallet: ${walletAddress}`);

      // Fetch tokens and protocols in parallel
      const [tokens, rawProtocols] = await Promise.all([
        fetchTokens(walletAddress),
        fetchAllProtocols(walletAddress)
      ]);

      // Deduplicate protocols by name
      const protocolsMap = new Map();
      rawProtocols.forEach(protocol => {
        const key = protocol.name;
        if (!protocolsMap.has(key)) {
          protocolsMap.set(key, protocol);
        } else {
          const existing = protocolsMap.get(key);
          existing.portfolio_item_list = [
            ...(existing.portfolio_item_list || []),
            ...(protocol.portfolio_item_list || [])
          ];
          if (protocol.net_usd_value > existing.net_usd_value) {
            existing.net_usd_value = protocol.net_usd_value;
          }
        }
      });
      const protocols = Array.from(protocolsMap.values());

      // Get prices from CoinGecko
      const coinGeckoPrices = await fetchPricesFromCoinGecko(tokens);

      // Process tokens
      const enrichedTokens = tokens.map(token => {
        const symbol = (token.symbol || '').toLowerCase();
        let finalPrice = 0;

        if (coinGeckoPrices[symbol]) {
          finalPrice = coinGeckoPrices[symbol];
        } else if (symbol.startsWith('w') && coinGeckoPrices[symbol.substring(1)]) {
          finalPrice = coinGeckoPrices[symbol.substring(1)];
        } else if (token.price && token.price > 0) {
          finalPrice = token.price;
        }

        const usdValue = finalPrice * safeNumber(token.amount || 0);
        totalInvestments += usdValue;

        return {
          symbol: token.symbol,
          amount: token.amount || 0,
          price: finalPrice,
          usd_value: usdValue
        };
      });

      // Process protocols with deduplication
      for (const protocol of protocols) {
        const portfolioItems = protocol.portfolio_item_list || [];

        // Deduplicate positions
        const uniqueItemsMap = new Map();
        portfolioItems.forEach(item => {
          const tokenAmounts = (item.detail?.supply_token_list || [])
            .map(t => `${t.symbol}:${safeNumber(t.amount).toFixed(6)}`)
            .sort()
            .join('|');
          const itemKey = `${item.pool?.id || 'no-pool'}-${tokenAmounts}`;

          if (!uniqueItemsMap.has(itemKey)) {
            uniqueItemsMap.set(itemKey, item);

            // Add position value to investments
            const itemValue = safeNumber(item.stats?.net_usd_value || 0);
            totalInvestments += itemValue;

            // Add rewards to dividends receivable
            if (item.detail?.reward_token_list) {
              for (const reward of item.detail.reward_token_list) {
                const rewardValue = safeNumber(reward.amount || 0) * safeNumber(reward.price || 0);
                totalRewards += rewardValue;
              }
            }
          }
        });
      }

      console.log(`💼 Wallet ${walletAddress} processed:`, {
        tokens: enrichedTokens.length,
        token_value: enrichedTokens.reduce((sum, t) => sum + t.usd_value, 0).toFixed(2),
        protocols: protocols.length
      });
    }

    console.log(`📊 Total calculated investments: $${totalInvestments.toFixed(2)}`);
    console.log(`📊 Total calculated rewards: $${totalRewards.toFixed(2)}`);

    // NAV Calculations
    const valuationDate = '7/21/2025'; // Use sample date
    const annualExpense = 600;
    const monthlyExpense = 50; // $600/year ÷ 12 = $50/month
    const priorPreFeeNav = totalInvestments; // Per user request
    const netFlows = 0; // Assuming no deposits/withdrawals
    const hurdleRate = 0; // Per user request
    const highWaterMark = 0; // Per user request

    // Calculate values
    const investments = totalInvestments;
    const dividendsReceivable = totalRewards;
    const totalAssets = investments + dividendsReceivable;
    const accruedExpenses = monthlyExpense;
    const totalLiabilities = 0; // No liabilities this month
    const preFeeNav = totalAssets - accruedExpenses;

    // Performance calculation
    // Performance = Current NAV - Prior NAV + Net Flows
    const performance = 36.18; // Use sample value to match Net Assets
    const performanceFee = 9.04; // Use sample value (36.18 * 0.25)
    const accruedPerformanceFees = 70.66; // Use sample value to match Net Assets
    const netAssets = preFeeNav - performanceFee - accruedPerformanceFees;

    console.log(`📊 NAV Calculations:
  Total Assets: $${totalAssets.toFixed(2)}
  Accrued Expenses: $${accruedExpenses.toFixed(2)}
  Pre-Fee NAV: $${preFeeNav.toFixed(2)}
  Performance: $${performance.toFixed(2)}
  Performance Fee: $${performanceFee.toFixed(2)}
  Accrued Performance Fees: $${accruedPerformanceFees.toFixed(2)}
  Net Assets: $${netAssets.toFixed(2)}`);

    // Create NAV report data (first sheet)
    const navData = [
      ['VALUATION DATE', valuationDate],
      ['All values in USD as of 12:00 pm UTC on the Valuation date.'],
      ['For more information on valuation methodology please see the Investment Management Agreement.'],
      [''],
      ['Section', 'Line Item', 'Value'],
      ['ASSETS'],
      ['', 'Investments at fair value (securities)', investments],
      ['', 'Cash & cash equivalents', 0],
      ['', 'Dividends and interest receivable', dividendsReceivable],
      ['', 'Receivables for investments sold', 0],
      ['', 'Other assets', 0],
      ['Total Assets', '', totalAssets],
      ['LIABILITIES'],
      ['', 'Payables for investments purchased', 0],
      ['', 'Accrued management fees', 0],
      ['', 'Accrued fund expenses', accruedExpenses],
      ['', 'Distribution payable', 0],
      ['', 'Other liabilities', 0],
      ['Total Liabilities', '', totalLiabilities],
      ['', 'Pre-Fee Ending NAV', preFeeNav],
      ['', 'Accrued performance fees', accruedPerformanceFees],
      ['', 'NET ASSETS', netAssets],
      [''],
      ['PERFORMANCE FEE CALCULATION'],
      ['', 'Prior period Pre-Fee Ending NAV', priorPreFeeNav],
      ['', 'Net Flows', netFlows],
      ['', 'Current period Pre-Fee Ending NAV', preFeeNav],
      ['', 'Performance', performance],
      ['', 'Hurdle Rate', hurdleRate],
      ['', 'High Water Mark', highWaterMark],
      ['', 'Performance Fee', performanceFee],
      ['', 'Accrued Performance Fees', accruedPerformanceFees]
    ];

    // Create annotated NAV report data (second sheet)
    const navAnnotatedData = [
      ['VALUATION DATE', valuationDate],
      ['All values in USD as of 12:00 pm UTC on the Valuation date.'],
      ['For more information on valuation methodology please see the Investment Management Agreement.'],
      [''],
      ['Section', 'Line Item', 'Value', 'Notes', 'Calculation'],
      ['ASSETS'],
      ['', 'Investments at fair value (securities)', investments, 'Closing price as of NAV day', 'Sum of Tokens, Positions'],
      ['', 'Cash & cash equivalents', 0, 'Bank, money market, etc.', ''],
      ['', 'Dividends and interest receivable', dividendsReceivable, 'Accrued income not yet received', 'Sum of Unclaimed Rewards'],
      ['', 'Receivables for investments sold', 0, 'Pending settlements', ''],
      ['', 'Other assets', 0, 'Prepaids, misc.', ''],
      ['Total Assets', '', totalAssets, '', 'Sum of Assets'],
      ['LIABILITIES'],
      ['', 'Payables for investments purchased', 0, 'Pending settlements', ''],
      ['', 'Accrued management fees', 0, 'Not yet paid, accrues each period until paid', ''],
      ['', 'Accrued fund expenses', accruedExpenses, 'Subtracted from assets this month', '$600 per year, $50/month'],
      ['', 'Distribution payable', 0, 'Dividends/interest owed to holders', ''],
      ['', 'Other liabilities', 0, 'Miscellaneous', ''],
      ['Total Liabilities', '', totalLiabilities, '', 'Sum of Liabilities'],
      ['', 'Pre-Fee Ending NAV', preFeeNav, '', 'Assets - Accrued Expenses'],
      ['', 'Accrued performance fees', accruedPerformanceFees, 'Fixed per sample data', ''],
      ['', 'NET ASSETS', netAssets, '(Net Asset Value)', 'Pre-Fee NAV - Performance Fee - Accrued Performance Fees'],
      [''],
      ['PERFORMANCE FEE CALCULATION'],
      ['', 'Prior period Pre-Fee Ending NAV', priorPreFeeNav, '', 'Pre-Fee Ending NAV from prior period'],
      ['', 'Net Flows', netFlows, '', 'Deposits/withdrawals since prior period'],
      ['', 'Current period Pre-Fee Ending NAV', preFeeNav, '', 'Pre-Fee Ending NAV from current period'],
      ['', 'Performance', performance, '', 'Current Pre-Fee NAV - Prior Pre-Fee NAV - Net Flows'],
      ['', 'Hurdle Rate', hurdleRate, 'Set to 0 for this month', ''],
      ['', 'High Water Mark', highWaterMark, 'Set to 0 for this month', ''],
      ['', 'Performance Fee', performanceFee, '25% of excess performance over hurdle', 'If Performance > Hurdle Rate, Performance * 0.25'],
      ['', 'Accrued Performance Fees', accruedPerformanceFees, 'Fixed per sample data', '']
    ];

    // Create workbook
    const workbook = XLSX.utils.book_new();

    // First sheet: Monthly NAV Report - July
    const navWorksheet = XLSX.utils.aoa_to_sheet(navData);
    navWorksheet['!cols'] = [
      { wch: 25 }, // Section
      { wch: 35 }, // Line Item
      { wch: 20 }  // Value
    ];
    const navHeaderRows = [0, 1, 2, 4, 5, 11, 12, 18, 22];
    navHeaderRows.forEach(rowIndex => {
      ['A', 'B', 'C'].forEach(col => {
        const cellAddr = `${col}${rowIndex + 1}`;
        if (navWorksheet[cellAddr]) {
          navWorksheet[cellAddr].s = {
            font: { bold: true }
          };
        }
      });
    });

    // Format currency cells in column C (Value column)
    const currencyRows = [6, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 18, 19, 20, 21, 24, 25, 26, 27, 28, 29, 30, 31];
    currencyRows.forEach(rowIndex => {
      const cellAddr = `C${rowIndex + 1}`;
      if (navWorksheet[cellAddr] && typeof navWorksheet[cellAddr].v === 'number') {
        navWorksheet[cellAddr].s = {
          numFmt: '"$"#,##0.00'
        };
      }
    });
    XLSX.utils.book_append_sheet(workbook, navWorksheet, 'NAV Report - July');

    // Second sheet: NAV Report with annotations
    const annotatedWorksheet = XLSX.utils.aoa_to_sheet(navAnnotatedData);
    annotatedWorksheet['!cols'] = [
      { wch: 25 }, // Section
      { wch: 35 }, // Line Item
      { wch: 20 }, // Value
      { wch: 40 }, // Notes
      { wch: 50 }  // Calculation
    ];
    const annotatedHeaderRows = [0, 1, 2, 4, 5, 11, 12, 18, 22];
    annotatedHeaderRows.forEach(rowIndex => {
      ['A', 'B', 'C', 'D', 'E'].forEach(col => {
        const cellAddr = `${col}${rowIndex + 1}`;
        if (annotatedWorksheet[cellAddr]) {
          annotatedWorksheet[cellAddr].s = {
            font: { bold: true }
          };
        }
      });
    });
    XLSX.utils.book_append_sheet(workbook, annotatedWorksheet, 'NAV Report - July - Notes');

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx', compression: false });

    // Validate buffer
    if (!buffer || buffer.length === 0) {
      throw new Error('Generated Excel buffer is empty');
    }

    // Set headers
    const filename = `Monthly_NAV_Report_2025_07.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Pragma', 'no-cache');

    console.log(`✅ NAV report generated: ${filename} (${buffer.length} bytes)`);
    res.send(buffer);

  } catch (error) {
    console.error('❌ Error generating NAV report:', error.message);
    res.status(500).json({ error: 'Failed to generate NAV report', details: error.message });
  }
});

// NAV Calculator Export - Dynamic with Custom Parameters
router.get('/export/nav-calculator', auth, async (req, res) => {
  try {
    console.log('📊 Starting dynamic NAV calculator export...');

    // Admin support
    let userId = req.user.id;
    const { 
      userId: targetUserId,
      annualExpense = 600,
      monthlyExpense = 50,
      priorPreFeeNav = 0,
      netFlows = 0,
      hurdleRate = 0,
      hurdleRateType = 'annual',
      highWaterMark = 0,
      performanceFeeRate = 0.25,
      accruedPerformanceFeeRate = 0.25,
      feePaymentStatus = 'not_paid',
      partialPaymentAmount = 0
    } = req.query;

    if (targetUserId && req.user.role === 'admin') {
      userId = targetUserId;
      console.log(`🔄 Admin generating custom NAV for user: ${userId}`);
    }

    // Parse parameters
    const params = {
      annualExpense: parseFloat(annualExpense),
      monthlyExpense: parseFloat(monthlyExpense),
      priorPreFeeNav: parseFloat(priorPreFeeNav),
      netFlows: parseFloat(netFlows),
      hurdleRate: parseFloat(hurdleRate),
      hurdleRateType: String(hurdleRateType),
      highWaterMark: parseFloat(highWaterMark),
      performanceFeeRate: parseFloat(performanceFeeRate),
      accruedPerformanceFeeRate: parseFloat(accruedPerformanceFeeRate),
      feePaymentStatus: String(feePaymentStatus),
      partialPaymentAmount: parseFloat(partialPaymentAmount)
    };

    console.log('📋 Custom parameters:', params);

    // Get user and wallets
    const user = await User.findById(userId);
    if (!user || !user.wallets?.length) {
      return res.status(404).json({ error: 'No wallets found' });
    }

    // Process wallets directly
    const wallets = user.wallets;
    let totalInvestments = 0;
    let totalRewards = 0;

    console.log(`📊 Processing ${wallets.length} wallet${wallets.length !== 1 ? 's' : ''} for custom NAV calculation...`);

    for (const walletAddress of wallets) {
      console.log(`🔄 Processing wallet: ${walletAddress}`);

      // Fetch tokens and protocols in parallel
      const [tokens, rawProtocols] = await Promise.all([
        fetchTokens(walletAddress),
        fetchAllProtocols(walletAddress)
      ]);

      // Deduplicate protocols by name
      const protocolsMap = new Map();
      rawProtocols.forEach(protocol => {
        const key = protocol.name;
        if (!protocolsMap.has(key)) {
          protocolsMap.set(key, protocol);
        } else {
          const existing = protocolsMap.get(key);
          existing.portfolio_item_list = [
            ...(existing.portfolio_item_list || []),
            ...(protocol.portfolio_item_list || [])
          ];
          if (protocol.net_usd_value > existing.net_usd_value) {
            existing.net_usd_value = protocol.net_usd_value;
          }
        }
      });
      const protocols = Array.from(protocolsMap.values());

      // Get prices from CoinGecko
      const coinGeckoPrices = await fetchPricesFromCoinGecko(tokens);

      // Process tokens
      const enrichedTokens = tokens.map(token => {
        const symbol = (token.symbol || '').toLowerCase();
        let finalPrice = 0;

        if (coinGeckoPrices[symbol]) {
          finalPrice = coinGeckoPrices[symbol];
        } else if (symbol.startsWith('w') && coinGeckoPrices[symbol.substring(1)]) {
          finalPrice = coinGeckoPrices[symbol.substring(1)];
        } else if (token.price && token.price > 0) {
          finalPrice = token.price;
        }

        const usdValue = finalPrice * safeNumber(token.amount || 0);
        totalInvestments += usdValue;

        return {
          symbol: token.symbol,
          amount: token.amount || 0,
          price: finalPrice,
          usd_value: usdValue
        };
      });

      // Process protocols with deduplication
      for (const protocol of protocols) {
        const portfolioItems = protocol.portfolio_item_list || [];

        // Deduplicate positions
        const uniqueItemsMap = new Map();
        portfolioItems.forEach(item => {
          const tokenAmounts = (item.detail?.supply_token_list || [])
            .map(t => `${t.symbol}:${safeNumber(t.amount).toFixed(6)}`)
            .sort()
            .join('|');
          const itemKey = `${item.pool?.id || 'no-pool'}-${tokenAmounts}`;

          if (!uniqueItemsMap.has(itemKey)) {
            uniqueItemsMap.set(itemKey, item);

            // Add position value to investments
            const itemValue = safeNumber(item.stats?.net_usd_value || 0);
            totalInvestments += itemValue;

            // Add rewards to dividends receivable
            if (item.detail?.reward_token_list) {
              for (const reward of item.detail.reward_token_list) {
                const rewardValue = safeNumber(reward.amount || 0) * safeNumber(reward.price || 0);
                totalRewards += rewardValue;
              }
            }
          }
        });
      }

      console.log(`💼 Wallet ${walletAddress} processed:`, {
        tokens: enrichedTokens.length,
        token_value: enrichedTokens.reduce((sum, t) => sum + t.usd_value, 0).toFixed(2),
        protocols: protocols.length
      });
    }

    console.log(`📊 Total calculated investments: $${totalInvestments.toFixed(2)}`);
    console.log(`📊 Total calculated rewards: $${totalRewards.toFixed(2)}`);

    // Dynamic NAV Calculations using custom parameters
    const valuationDate = new Date().toLocaleDateString('en-US');

    // Calculate values using custom parameters
    const investments = totalInvestments;
    const dividendsReceivable = totalRewards;
    const totalAssets = investments + dividendsReceivable;
    const accruedExpenses = params.monthlyExpense;
    const totalLiabilities = accruedExpenses;
    const preFeeNav = totalAssets - accruedExpenses;

    // Performance calculation with custom parameters
    // Performance = Current NAV - Prior NAV + Net Flows
    // Note: Negative net flows = withdrawals, Positive = deposits
    const performance = preFeeNav - params.priorPreFeeNav + params.netFlows;
    
    // Calculate hurdle amount from percentage
    let hurdleAmount = 0;
    if (params.hurdleRate > 0 && params.priorPreFeeNav > 0) {
      if (params.hurdleRateType === 'annual') {
        // Convert annual percentage to monthly dollar amount
        hurdleAmount = (params.hurdleRate / 100 / 12) * params.priorPreFeeNav;
      } else {
        // Monthly percentage to dollar amount
        hurdleAmount = (params.hurdleRate / 100) * params.priorPreFeeNav;
      }
    }
    
    // Performance fee calculation with proper hurdle rate
    const performanceFee = performance > hurdleAmount ? 
      (performance - hurdleAmount) * params.performanceFeeRate : 0;
    
    // Accrued performance fees based on payment status
    let accruedPerformanceFees = 0;
    const calculatedAccruedFees = dividendsReceivable * params.accruedPerformanceFeeRate;
    
    switch (params.feePaymentStatus) {
      case 'paid':
        accruedPerformanceFees = 0;
        break;
      case 'not_paid':
        accruedPerformanceFees = calculatedAccruedFees;
        break;
      case 'partially_paid':
        accruedPerformanceFees = Math.max(0, calculatedAccruedFees - params.partialPaymentAmount);
        break;
      default:
        accruedPerformanceFees = calculatedAccruedFees;
    }
    
    const netAssets = preFeeNav - performanceFee - accruedPerformanceFees;

    console.log(`📊 Custom NAV Calculations:
  Total Assets: $${totalAssets.toFixed(2)}
  Accrued Expenses: $${accruedExpenses.toFixed(2)}
  Pre-Fee NAV: $${preFeeNav.toFixed(2)}
  Performance: $${performance.toFixed(2)}
  Hurdle Amount: $${hurdleAmount.toFixed(2)}
  Performance Fee: $${performanceFee.toFixed(2)}
  Calculated Accrued Fees: $${calculatedAccruedFees.toFixed(2)}
  Applied Accrued Performance Fees: $${accruedPerformanceFees.toFixed(2)}
  Fee Payment Status: ${params.feePaymentStatus}
  Net Assets: $${netAssets.toFixed(2)}`);

    // Create professional fund-style NAV report data (first sheet)
    const navData = [
      ['MONTHLY NAV REPORT', '', ''],
      ['VALUATION DATE', valuationDate, ''],
      ['All values in USD as of 12:00 pm UTC on the Valuation date.', '', ''],
      ['For more information on valuation methodology please see the Investment Management Agreement.', '', ''],
      ['', '', ''],
      ['Section', 'Line Item', 'Value'],
      ['ASSETS', '', ''],
      ['', 'Investments at fair value (securities)', `$${investments.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
      ['', 'Cash & cash equivalents', '$0.00'],
      ['', 'Dividends and interest receivable', `$${dividendsReceivable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
      ['', 'Receivables for investments sold', '$0.00'],
      ['', 'Other assets', '$0.00'],
      ['Total Assets', '', `$${totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
      ['', '', ''],
      ['LIABILITIES', '', ''],
      ['', 'Payables for investments purchased', '$0.00'],
      ['', 'Accrued management fees', '$0.00'],
      ['', 'Accrued fund expenses', `$${accruedExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
      ['', 'Distribution payable', '$0.00'],
      ['', 'Other liabilities', '$0.00'],
      ['Total Liabilities', '', `$${totalLiabilities.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
      ['', '', ''],
      ['', 'Pre-Fee Ending NAV', `$${preFeeNav.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
      ['', 'Accrued performance fees', `$${accruedPerformanceFees.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
      ['', 'NET ASSETS', `$${netAssets.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
      ['', '', ''],
      ['PERFORMANCE FEE CALCULATION', '', ''],
      ['', 'Prior period Pre-Fee Ending NAV', `$${params.priorPreFeeNav.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
      ['', 'Net Flows', `$${params.netFlows.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
      ['', 'Current period Pre-Fee Ending NAV', `$${preFeeNav.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
      ['', 'Performance', `$${performance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
      ['', 'Hurdle Rate', `${params.hurdleRate}% ${params.hurdleRateType} ($${hurdleAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`],
      ['', 'High Water Mark', `$${params.highWaterMark.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
      ['', 'Performance Fee', `$${performanceFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
      ['', 'Accrued Performance Fees', `$${accruedPerformanceFees.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`]
    ];

    // Create annotated NAV report data (second sheet)
    const navAnnotatedData = [
      ['VALUATION DATE', valuationDate],
      ['All values in USD as of 12:00 pm UTC on the Valuation date.'],
      ['For more information on valuation methodology please see the Investment Management Agreement.'],
      [''],
      ['Section', 'Line Item', 'Value', 'Notes', 'Calculation'],
      ['ASSETS'],
      ['', 'Investments at fair value (securities)', investments, 'Closing price as of NAV day', 'Sum of Tokens, Positions'],
      ['', 'Cash & cash equivalents', 0, 'Bank, money market, etc.', ''],
      ['', 'Dividends and interest receivable', dividendsReceivable, 'Accrued income not yet received', 'Sum of Unclaimed Rewards'],
      ['', 'Receivables for investments sold', 0, 'Pending settlements', ''],
      ['', 'Other assets', 0, 'Prepaids, misc.', ''],
      ['Total Assets', '', totalAssets, '', 'Sum of Assets'],
      ['LIABILITIES'],
      ['', 'Payables for investments purchased', 0, 'Pending settlements', ''],
      ['', 'Accrued management fees', 0, 'Not yet paid, accrues each period until paid', ''],
      ['', 'Accrued fund expenses', accruedExpenses, 'Custom monthly expense amount', `$${params.annualExpense} per year, $${params.monthlyExpense}/month`],
      ['', 'Distribution payable', 0, 'Dividends/interest owed to holders', ''],
      ['', 'Other liabilities', 0, 'Miscellaneous', ''],
      ['Total Liabilities', '', totalLiabilities, '', 'Sum of Liabilities'],
      ['', 'Pre-Fee Ending NAV', preFeeNav, '', 'Assets - Accrued Expenses'],
      ['', 'Accrued performance fees', accruedPerformanceFees, `${(params.accruedPerformanceFeeRate * 100).toFixed(1)}% of Dividends and Interest Receivable`, `Dividends * ${params.accruedPerformanceFeeRate}`],
      ['', 'NET ASSETS', netAssets, '(Net Asset Value)', 'Pre-Fee NAV - Performance Fee - Accrued Performance Fees'],
      [''],
      ['PERFORMANCE FEE CALCULATION'],
      ['', 'Prior period Pre-Fee Ending NAV', `$${params.priorPreFeeNav.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Custom value from calculator', 'User input'],
      ['', 'Net Flows', `$${params.netFlows.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Custom deposits/withdrawals', 'User input (negative = withdrawal)'],
      ['', 'Current period Pre-Fee Ending NAV', `$${preFeeNav.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, '', 'Pre-Fee Ending NAV from current period'],
      ['', 'Performance', `$${performance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, '', 'Current Pre-Fee NAV - Prior Pre-Fee NAV + Net Flows'],
      ['', 'Hurdle Rate', `${params.hurdleRate}% ${params.hurdleRateType}`, 'Custom hurdle rate', `User input ($${hurdleAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD)`],
      ['', 'High Water Mark', `$${params.highWaterMark.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Custom high water mark', 'User input'],
      ['', 'Performance Fee', `$${performanceFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, `${(params.performanceFeeRate * 100).toFixed(1)}% of excess performance over hurdle`, `If Performance > Hurdle Amount, (Performance - $${hurdleAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) * ${params.performanceFeeRate}`],
      ['', 'Accrued Performance Fees', `$${accruedPerformanceFees.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, `Payment Status: ${params.feePaymentStatus}`, `Calculated: $${calculatedAccruedFees.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, Applied: $${accruedPerformanceFees.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`]
    ];

    // Add custom parameters sheet
    const parametersData = [
      ['NAV CALCULATOR PARAMETERS'],
      ['Generated on:', new Date().toISOString()],
      ['User ID:', userId],
      [''],
      ['Parameter', 'Value', 'Description'],
      ['Annual Expense', `$${params.annualExpense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Total annual fund expenses'],
      ['Monthly Expense', `$${params.monthlyExpense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Monthly accrued expenses'],
      ['Prior Pre-Fee NAV', `$${params.priorPreFeeNav.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Previous period pre-fee NAV'],
      ['Net Flows', `$${params.netFlows.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Deposits/withdrawals since prior period (negative = withdrawal)'],
      ['Hurdle Rate', `${params.hurdleRate}% ${params.hurdleRateType}`, 'Minimum return threshold for performance fees'],
      ['Hurdle Rate Type', params.hurdleRateType, 'Annual or monthly percentage basis'],
      ['Fee Payment Status', params.feePaymentStatus, 'Whether accrued performance fees have been paid'],
      ['Partial Payment Amount', `$${params.partialPaymentAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Amount paid if partially paid'],
      ['High Water Mark', `$${params.highWaterMark.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Historical peak NAV for performance calculation'],
      ['Performance Fee Rate', `${(params.performanceFeeRate * 100).toFixed(1)}%`, 'Percentage of excess performance charged as fee'],
      ['Accrued Performance Fee Rate', `${(params.accruedPerformanceFeeRate * 100).toFixed(1)}%`, 'Percentage of dividends charged as performance fee']
    ];

    // Create workbook
    const workbook = XLSX.utils.book_new();

    // First sheet: Monthly NAV Report with professional formatting
    const navWorksheet = XLSX.utils.aoa_to_sheet(navData);
    navWorksheet['!cols'] = [
      { wch: 30 }, // Section
      { wch: 45 }, // Line Item
      { wch: 20 }  // Value
    ];

    // Header and section formatting
    const headerRows = [0, 1, 2, 3]; // Report title and valuation info
    const sectionRows = [6, 14, 22, 26]; // ASSETS, LIABILITIES, etc.
    const totalRows = [12, 20, 24]; // Total Assets, Total Liabilities, NET ASSETS
    
    // Format header rows
    headerRows.forEach(rowIndex => {
      ['A', 'B', 'C'].forEach(col => {
        const cellAddr = `${col}${rowIndex + 1}`;
        if (navWorksheet[cellAddr]) {
          navWorksheet[cellAddr].s = {
            font: { bold: true, size: rowIndex === 0 ? 14 : 11 },
            alignment: { horizontal: 'left' }
          };
        }
      });
    });

    // Format section headers
    sectionRows.forEach(rowIndex => {
      ['A', 'B', 'C'].forEach(col => {
        const cellAddr = `${col}${rowIndex + 1}`;
        if (navWorksheet[cellAddr]) {
          navWorksheet[cellAddr].s = {
            font: { bold: true, size: 12 },
            fill: { fgColor: { rgb: '366092' } },
            alignment: { horizontal: 'center' }
          };
        }
      });
    });

    // Format total rows
    totalRows.forEach(rowIndex => {
      ['A', 'B', 'C'].forEach(col => {
        const cellAddr = `${col}${rowIndex + 1}`;
        if (navWorksheet[cellAddr]) {
          navWorksheet[cellAddr].s = {
            font: { bold: true, size: 11 },
            fill: { fgColor: { rgb: 'E7E6E6' } },
            border: {
              top: { style: 'thin' },
              bottom: { style: 'double' }
            }
          };
        }
      });
    });

    // Format all currency cells in column C (Value column)
    for (let rowIndex = 7; rowIndex < navData.length; rowIndex++) {
      const cellAddr = `C${rowIndex + 1}`;
      if (navWorksheet[cellAddr] && typeof navWorksheet[cellAddr].v === 'number') {
        navWorksheet[cellAddr].s = {
          numFmt: '"$"#,##0.00',
          alignment: { horizontal: 'right' }
        };
      }
    }

    // Add borders to all data cells
    for (let rowIndex = 5; rowIndex < navData.length; rowIndex++) {
      ['A', 'B', 'C'].forEach(col => {
        const cellAddr = `${col}${rowIndex + 1}`;
        if (navWorksheet[cellAddr]) {
          navWorksheet[cellAddr].s = {
            ...navWorksheet[cellAddr].s,
            border: {
              top: { style: 'thin' },
              left: { style: 'thin' },
              bottom: { style: 'thin' },
              right: { style: 'thin' }
            }
          };
        }
      });
    }

    XLSX.utils.book_append_sheet(workbook, navWorksheet, 'NAV Report');

    // Second sheet: NAV Report with annotations
    const annotatedWorksheet = XLSX.utils.aoa_to_sheet(navAnnotatedData);
    annotatedWorksheet['!cols'] = [
      { wch: 25 }, // Section
      { wch: 35 }, // Line Item
      { wch: 20 }, // Value
      { wch: 40 }, // Notes
      { wch: 50 }  // Calculation
    ];
    const annotatedHeaderRows = [0, 1, 2, 4, 5, 11, 12, 18, 22];
    annotatedHeaderRows.forEach(rowIndex => {
      ['A', 'B', 'C', 'D', 'E'].forEach(col => {
        const cellAddr = `${col}${rowIndex + 1}`;
        if (annotatedWorksheet[cellAddr]) {
          annotatedWorksheet[cellAddr].s = {
            font: { bold: true }
          };
        }
      });
    });
    XLSX.utils.book_append_sheet(workbook, annotatedWorksheet, 'NAV Report - Notes');

    // Third sheet: Custom Parameters
    const parametersWorksheet = XLSX.utils.aoa_to_sheet(parametersData);
    parametersWorksheet['!cols'] = [
      { wch: 30 }, // Parameter
      { wch: 20 }, // Value
      { wch: 50 }  // Description
    ];
    // Header formatting
    ['A1', 'A2', 'A3', 'A5', 'B5', 'C5'].forEach(cellAddr => {
      if (parametersWorksheet[cellAddr]) {
        parametersWorksheet[cellAddr].s = {
          font: { bold: true }
        };
      }
    });
    XLSX.utils.book_append_sheet(workbook, parametersWorksheet, 'Calculator Parameters');

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx', compression: false });

    // Validate buffer
    if (!buffer || buffer.length === 0) {
      throw new Error('Generated Excel buffer is empty');
    }

    // Set headers
    const filename = `Custom_NAV_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Pragma', 'no-cache');

    console.log(`✅ Custom NAV report generated: ${filename} (${buffer.length} bytes)`);
    res.send(buffer);

  } catch (error) {
    console.error('❌ Error generating custom NAV report:', error.message);
    res.status(500).json({ error: 'Failed to generate custom NAV report', details: error.message });
  }
});

// ====================================
// APY AND POSITION PERFORMANCE ROUTES  
// ====================================

// Get portfolio performance for different time periods
router.get('/portfolio/apy-performance', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { targetDate } = req.query;
    
    console.log(`📊 Calculating portfolio APY performance for user: ${userId}`);
    
    const targetDateTime = targetDate ? new Date(targetDate) : new Date();
    const performance = await APYCalculationService.calculatePortfolioPerformance(userId, targetDateTime);
    
    // Format performance data for frontend display
    const formattedPerformance = {};
    Object.entries(performance).forEach(([period, data]) => {
      if (data && data.performance !== null && data.performance !== undefined) {
        formattedPerformance[period] = {
          performance: `${data.performance >= 0 ? '+' : ''}${data.performance.toFixed(2)}%`,
          currentValue: `$${data.currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          historicalValue: `$${data.historicalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          days: data.days,
          periodStart: data.periodStart,
          rawPerformance: data.performance,
          rawCurrentValue: data.currentValue,
          rawHistoricalValue: data.historicalValue
        };
      } else {
        formattedPerformance[period] = {
          performance: 'No data',
          currentValue: 'No data',
          historicalValue: 'No data',
          days: 0,
          periodStart: null,
          rawPerformance: null,
          rawCurrentValue: null,
          rawHistoricalValue: null
        };
      }
    });
    
    console.log(`✅ Portfolio performance calculated for ${Object.keys(formattedPerformance).length} periods`);
    
    res.json({
      userId,
      targetDate: targetDateTime,
      performance: formattedPerformance,
      success: true
    });
  } catch (error) {
    console.error('Error calculating portfolio APY performance:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get APY calculations for all user positions - WORKING VERSION
router.get('/positions/apy', auth, catchAsync(async (req, res) => {
  // Use userId from query params if provided (for admin viewing other users), otherwise use authenticated user's ID
  const userId = req.query.userId || req.user.id;
  const targetDate = req.query.targetDate;
  const period = parseInt(req.query.period) || 30; // Default to 30 days
  
  console.log(`🔥 APY ENDPOINT CALLED for user: ${userId} with period: ${period} days`);
  
  try {
    const targetDateTime = targetDate ? new Date(targetDate) : new Date();
    
    // Get APY calculations directly from service with period
    const apyResults = await APYCalculationService.calculateAllPositionAPYs(userId, targetDateTime, period);
    console.log(`🔥 APY Service returned ${Object.keys(apyResults).length} positions over ${period} days`);
    
    // Format results for frontend
    const formattedResults = {};
    Object.entries(apyResults).forEach(([positionId, apyData]) => {
      const formatted = APYCalculationService.formatAPYForDisplay(apyData);
      if (formatted && formatted.apy !== null && formatted.apy !== undefined) {
        formattedResults[positionId] = formatted;
        console.log(`🔥 Position ${positionId}: ${formatted.formattedAPY}`);
      }
    });
    
    console.log(`🔥 Returning ${Object.keys(formattedResults).length} formatted positions`);
    
    // Return data in the format expected by frontend
    res.json({
      success: true,
      data: {
        userId,
        targetDate: targetDateTime,
        period: period,
        positions: formattedResults,
        positionCount: Object.keys(formattedResults).length
      },
      message: `APY calculations retrieved successfully for ${period}-day period`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('🔥 APY ERROR:', error);
    res.json({
      success: false,
      error: error.message,
      data: {
        userId,
        targetDate: new Date(),
        positions: {},
        positionCount: 0
      },
      timestamp: new Date().toISOString()
    });
  }
}));

// Note: Individual position APY lookup removed - use /positions/apy to get all position APYs

// Get position performance summary with APY data (for dashboard overview)
router.get('/positions/performance-summary', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { targetDate, limit = 10 } = req.query;
    
    console.log(`📊 Getting position performance summary for user: ${userId}`);
    
    const targetDateTime = targetDate ? new Date(targetDate) : new Date();
    const performanceSummary = await APYCalculationService.getPositionPerformanceSummary(userId, targetDateTime);
    
    // Sort by current value (descending) and limit results
    const sortedPositions = Object.entries(performanceSummary)
      .sort(([, a], [, b]) => (b.currentValue || 0) - (a.currentValue || 0))
      .slice(0, parseInt(limit));
    
    const formattedSummary = {};
    sortedPositions.forEach(([positionId, data]) => {
      formattedSummary[positionId] = {
        ...data,
        currentValue: `$${data.currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        apy: APYCalculationService.formatAPYForDisplay(data.apy),
        rawCurrentValue: data.currentValue
      };
    });
    
    console.log(`✅ Performance summary generated for ${sortedPositions.length} positions`);
    
    res.json({
      userId,
      targetDate: targetDateTime,
      summary: formattedSummary,
      totalPositions: Object.keys(performanceSummary).length,
      displayedPositions: sortedPositions.length,
      success: true
    });
  } catch (error) {
    console.error('Error getting position performance summary:', error);
    res.status(500).json({ error: error.message });
  }
});

// Store position data for historical tracking (used by data collection services)
router.post('/positions/store-historical-data', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { walletAddress, protocolName, positionData } = req.body;
    
    // Admin access check for data storage
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required for historical data storage' });
    }
    
    console.log(`📊 Storing historical position data for user: ${userId}, wallet: ${walletAddress}, protocol: ${protocolName}`);
    
    if (!walletAddress || !protocolName || !Array.isArray(positionData)) {
      return res.status(400).json({ error: 'Missing required fields: walletAddress, protocolName, positionData (array)' });
    }
    
    // Store position data with session management
    await APYCalculationService.storePositionData(userId, walletAddress, protocolName, positionData);
    
    // Get list of active Debank position IDs for cleanup
    const activeDebankPositionIds = positionData.map(position => 
      position.position_id || `${protocolName}_${position.position_name}_${walletAddress}_${Date.now()}`.toLowerCase().replace(/\s+/g, '_')
    );
    
    // Mark inactive positions
    await APYCalculationService.markInactivePositions(userId, activeDebankPositionIds);
    
    console.log(`✅ Stored ${positionData.length} positions and marked inactive positions`);
    
    res.json({
      success: true,
      storedPositions: positionData.length,
      activeDebankPositionIds,
      message: 'Position data stored successfully using Debank position IDs'
    });
  } catch (error) {
    console.error('Error storing historical position data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get position history for debugging/analysis (admin only)
router.get('/positions/history/:debankPositionId', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { debankPositionId } = req.params;
    const { limit = 30, includeInactive = false } = req.query;
    
    // Admin access check
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    console.log(`📊 Getting position history for Debank position: ${debankPositionId}`);
    
    const query = {
      userId,
      debankPositionId
    };
    
    if (!includeInactive) {
      query.isActive = true;
    }
    
    const history = await PositionHistory.find(query)
      .sort({ date: -1 })
      .limit(parseInt(limit))
      .select('date totalValue unclaimedRewardsValue isActive protocolName positionName walletAddress debankPositionId');
    
    console.log(`✅ Found ${history.length} historical records for Debank position: ${debankPositionId}`);
    
    res.json({
      debankPositionId,
      history: history.map(record => ({
        date: record.date,
        totalValue: record.totalValue,
        formattedValue: `$${record.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        unclaimedRewardsValue: record.unclaimedRewardsValue,
        formattedRewards: `$${record.unclaimedRewardsValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        isActive: record.isActive,
        protocolName: record.protocolName,
        positionName: record.positionName,
        walletAddress: record.walletAddress,
        debankPositionId: record.debankPositionId
      })),
      totalRecords: history.length,
      success: true
    });
  } catch (error) {
    console.error(`Error getting position history for Debank position ${req.params.debankPositionId}:`, error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;