const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const WalletData = require('../models/WalletData');
const DailySnapshot = require('../models/DailySnapshot');
const ApiResponse = require('../utils/responseFormatter');
const { AppError, catchAsync } = require('../middleware/errorHandler');
const {
  fetchTokens,
  fetchAllProtocols,
  fetchPricesFromCoinGecko
} = require('../utils/debankUtils');
const { Console } = require('console');
const { processWalletData } = require('../services/walletProcessor');


const router = express.Router();
const DEBANK_BASE = 'https://pro-openapi.debank.com/v1';
const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const CHAINS = ['eth', 'bsc', 'arb', 'matic', 'base', 'op'];

// Auth middleware
async function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json(ApiResponse.error('No token provided', 401));
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id);
    if (!user) return res.status(401).json(ApiResponse.error('User not found', 401));
    req.user = { ...user.toObject(), role: payload.role }; // Include role from token
    next();
  } catch {
    res.status(403).json(ApiResponse.error('Invalid token', 403));
  }
}

// Role-based middleware for wallet routes
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json(ApiResponse.error('Admin access required', 403));
  }
  next();
};

const requireUser = (req, res, next) => {
  if (!req.user.role || (req.user.role !== 'admin' && req.user.role !== 'user')) {
    return res.status(403).json(ApiResponse.error('User access required', 403));
  }
  next();
};

// Enhanced portfolio summary calculation
function calculatePortfolioSummary(tokens, protocols) {
  const tokenValue = tokens.reduce((sum, token) => sum + (token.usd_value || 0), 0);
  const protocolValue = protocols.reduce((sum, protocol) => sum + (protocol.net_usd_value || 0), 0);
  
  return {
    total_usd_value: tokenValue + protocolValue,
    token_usd_value: tokenValue,
    protocol_usd_value: protocolValue,
    token_count: tokens.length,
    protocol_count: protocols.length
  };
}

// Function to deduplicate protocols
function deduplicateProtocols(protocols) {
  const seen = new Set();
  return protocols.filter(p => {
    const key = `${p.id}_${p.chain_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Function to deduplicate protocols by ID
function deduplicateProtocolsById(protocols) {
  const seen = new Set();
  return protocols.filter(p => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
}

// Function to create DailySnapshot from wallet data
async function createDailySnapshot(userId, walletAddress, walletResult) {
  const operationId = `snapshot-${walletAddress}-${Date.now()}`;
  try {
    console.log(`📸 [${operationId}] Creating daily snapshot for wallet ${walletAddress}`);
    console.log(`📸 [${operationId}] User ID: ${userId}`);
    console.log(`📸 [${operationId}] Wallet result keys:`, Object.keys(walletResult));
    
    // Check if we already have a snapshot for today
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);
    
    console.log(`📸 SNAPSHOT FUNCTION - Checking for existing snapshots between ${startOfDay} and ${endOfDay}`);
    
    const existingSnapshot = await DailySnapshot.findOne({
      userId,
      walletAddress,
      date: { $gte: startOfDay, $lte: endOfDay }
    });
    
    if (existingSnapshot) {
      console.log(`📸 Snapshot already exists for today for wallet ${walletAddress}, updating...`);
      // Update existing snapshot
      existingSnapshot.totalNavUsd = walletResult.summary.total_usd_value;
      existingSnapshot.tokensNavUsd = walletResult.summary.token_usd_value;
      existingSnapshot.positionsNavUsd = walletResult.summary.protocol_usd_value;
      existingSnapshot.tokens = walletResult.tokens.map(token => ({
        symbol: token.symbol,
        name: token.name,
        chain: token.chain,
        amount: token.amount,
        price: token.price,
        usdValue: token.usd_value,
        logoUrl: token.logo_url
      }));
      existingSnapshot.positions = createPositionsFromProtocols(walletResult.protocols);
      await existingSnapshot.save();
      console.log(`📸 Updated snapshot for wallet ${walletAddress}`);
      return existingSnapshot;
    }
    
    // Create new snapshot
    const snapshot = new DailySnapshot({
      userId,
      walletAddress,
      date: today,
      totalNavUsd: Math.max(0, parseFloat(walletResult.summary?.total_usd_value) || 0),
      tokensNavUsd: Math.max(0, parseFloat(walletResult.summary?.token_usd_value) || 0),
      positionsNavUsd: Math.max(0, parseFloat(walletResult.summary?.protocol_usd_value) || 0),
      tokens: (walletResult.tokens || []).map(token => ({
        symbol: token.symbol || 'UNKNOWN',
        name: token.name || '',
        chain: token.chain || 'unknown',
        amount: Math.max(0, parseFloat(token.amount) || 0),
        price: Math.max(0, parseFloat(token.price) || 0),
        usdValue: Math.max(0, parseFloat(token.usd_value) || 0),
        decimals: parseInt(token.decimals) || 18,
        logoUrl: token.logo_url || '',
        isVerified: Boolean(token.is_verified)
      })),
      positions: createPositionsFromProtocols(walletResult.protocols || [])
    });
    
    await snapshot.save();
    console.log(`📸 Created new snapshot for wallet ${walletAddress}`);
    return snapshot;
  } catch (error) {
    console.error(`❌ [${operationId}] Error creating snapshot for wallet ${walletAddress}:`, {
      message: error.message,
      stack: error.stack,
      userId,
      walletAddress
    });
    throw new AppError(`Failed to create snapshot for wallet ${walletAddress}: ${error.message}`, 500);
  }
}

// Helper function to convert protocol data to position format expected by APY service
function createPositionsFromProtocols(protocols) {
  const positions = [];
  
  if (!Array.isArray(protocols)) {
    console.log('⚠️ createPositionsFromProtocols: protocols is not an array:', typeof protocols);
    return positions;
  }
  
  protocols.forEach(protocol => {
    if (!protocol || !Array.isArray(protocol.positions)) {
      console.log('⚠️ createPositionsFromProtocols: protocol has no positions array:', protocol);
      return;
    }
    
    protocol.positions.forEach(position => {
      positions.push({
        protocolId: protocol.protocol_id,
        protocolName: protocol.name,
        chain: protocol.chain,
        supplyTokens: (position.tokens || []).map(token => ({
          symbol: token.symbol || 'UNKNOWN',
          name: token.name || '',
          chain: token.chain || 'unknown',
          amount: Math.max(0, parseFloat(token.amount) || 0),
          price: Math.max(0, parseFloat(token.price) || 0),
          usdValue: Math.max(0, parseFloat(token.usd_value) || 0),
          decimals: parseInt(token.decimals) || 18,
          logoUrl: token.logo_url || '',
          isVerified: Boolean(token.is_verified)
        })),
        rewardTokens: (position.rewards || []).map(reward => ({
          symbol: reward.symbol || 'UNKNOWN',
          name: reward.name || '',
          chain: reward.chain || 'unknown',
          amount: Math.max(0, parseFloat(reward.amount) || 0),
          price: Math.max(0, parseFloat(reward.price) || 0),
          usdValue: Math.max(0, parseFloat(reward.usd_value) || 0),
          decimals: parseInt(reward.decimals) || 18,
          logoUrl: reward.logo_url || '',
          isVerified: Boolean(reward.is_verified)
        })),
        totalUsdValue: (position.tokens || []).reduce((sum, token) => sum + Math.max(0, parseFloat(token.usd_value) || 0), 0) +
                       (position.rewards || []).reduce((sum, reward) => sum + Math.max(0, parseFloat(reward.usd_value) || 0), 0)
      });
    });
  });
  
  console.log(`📸 Created ${positions.length} positions from ${protocols.length} protocols`);
  return positions;
}

// Main enhanced wallet route
// Admin can see all wallets, Users can only see their own
router.get('/wallets', auth, requireUser, async (req, res) => {
  let wallets = [];
  let targetUserId = req.user._id;
  
  // If admin, they can optionally view all users' wallets or specific user
  if (req.user.role === 'admin') {
    const { userId } = req.query; // Optional query param for admin to view specific user
    
    if (userId) {
      // Admin viewing specific user's wallets
      const targetUser = await User.findById(userId);
      if (!targetUser) return res.status(404).json({ error: 'User not found' });
      wallets = targetUser.wallets || [];
      targetUserId = targetUser._id;
      console.log(`Admin viewing wallets for user: ${targetUser.email}`);
    } else {
      // Admin viewing their own wallets
      const user = await User.findById(req.user._id);
      wallets = user.wallets || [];
    }
  } else {
    // Regular user can only see their own wallets
    const user = await User.findById(req.user._id);
    wallets = user.wallets || [];
  }
  
  if (!wallets.length) return res.status(400).json(ApiResponse.error('No wallets added', 400));

  console.log(`🚀 Processing ${wallets.length} wallets...`);

  try {
    // First, try to get stored wallet data as fallback
    const storedWallets = await WalletData.find({ 
      userId: targetUserId,
      address: { $in: wallets }
    });
    
    console.log(`📦 Found ${storedWallets.length} stored wallets for fallback`);

    const results = await Promise.all(wallets.map(async (wallet) => {
      console.log(`\n🔄 Processing wallet: ${wallet}`);
      
      // Check if we have stored data for this wallet
      const storedWallet = storedWallets.find(sw => sw.address === wallet);
      
      try {
        // Fetch tokens and protocols in parallel
        const [tokens, rawProtocols] = await Promise.all([
          fetchTokens(wallet),
          fetchAllProtocols(wallet)
        ]);
      
        // Deduplicate protocols by name to avoid processing same protocol multiple times
        const protocolsMap = new Map();
      rawProtocols.forEach(protocol => {
        const key = protocol.name;
        if (!protocolsMap.has(key)) {
          protocolsMap.set(key, protocol);
        } else {
          // Merge portfolio items if duplicate protocol found
          const existing = protocolsMap.get(key);
          existing.portfolio_item_list = [
            ...(existing.portfolio_item_list || []),
            ...(protocol.portfolio_item_list || [])
          ];
          // Use the highest net_usd_value
          if (protocol.net_usd_value > existing.net_usd_value) {
            existing.net_usd_value = protocol.net_usd_value;
          }
        }
      });
      
      const protocols = Array.from(protocolsMap.values());
      console.log(`🔄 Deduplicated protocols: ${rawProtocols.length} -> ${protocols.length} for wallet ${wallet}`);
      
      // Get prices from CoinGecko
      const coinGeckoPrices = await fetchPricesFromCoinGecko(tokens);
      
      // Enhanced token processing with price enrichment
      const enrichedTokens = tokens.map(token => {
        const symbol = (token.symbol || '').toLowerCase();
        
        // Try multiple price sources in order of preference
        let finalPrice = 0;
        
        // 1. Try CoinGecko price
        if (coinGeckoPrices[symbol]) {
          finalPrice = coinGeckoPrices[symbol];
        }
        // 2. Try wrapped token equivalent
        else if (symbol.startsWith('w') && coinGeckoPrices[symbol.substring(1)]) {
          finalPrice = coinGeckoPrices[symbol.substring(1)];
        }
        // 3. Fall back to DeBankPrice
        else if (token.price && token.price > 0) {
          finalPrice = token.price;
        }
        
        const usdValue = finalPrice * (token.amount || 0);
        
        return {
          id: token.id,
          name: token.name,
          symbol: token.symbol,
          amount: token.amount || 0,
          price: finalPrice,
          usd_value: usdValue,
          chain: token.chain_id || token.chain,
          logo_url: token.logo_url,
          is_verified: token.is_verified,
          is_core: token.is_core,
          decimals: token.decimals
        };
      });
    
      // Enhanced protocol processing
      const enrichedProtocols = protocols
        .filter(protocol => protocol.net_usd_value && protocol.net_usd_value > 0.01) // Only protocols with significant value
        .map(protocol => ({
          protocol_id: protocol.id,
          name: protocol.name,
          chain: protocol.chain_id,
          lending_rate: protocol.tvl,
          logo_url: protocol.logo_url,
          site_url: protocol.site_url,
          net_usd_value: protocol.net_usd_value || 0,
          asset_usd_value: protocol.asset_usd_value || 0,
          debt_usd_value: protocol.debt_usd_value || 0,
          portfolio_item_count: protocol.portfolio_item_list?.length || 0,
          description: protocol.description
        }));

      // Calculate summary
      const summary = calculatePortfolioSummary(enrichedTokens, enrichedProtocols);

      console.log(`💼 Wallet ${wallet} summary:`, {
        tokens: enrichedTokens.length,
        token_value: summary.token_usd_value.toFixed(2),
        protocols: enrichedProtocols.length,
        protocol_value: summary.protocol_usd_value.toFixed(2),
        total_value: summary.total_usd_value.toFixed(2)
      });

      return {
        address: wallet,
        tokens: enrichedTokens.map(t => ({
          symbol: t.symbol,
          name: t.name,
          amount: t.amount,
          price: t.price,
          usd_value: t.usd_value,
          chain: t.chain,
          logo_url: t.logo_url
        })),
        protocols: protocols.map(protocol => {
          // Calculate protocol value from positions if net_usd_value is 0 or invalid
          let calculatedValue = protocol.net_usd_value || 0;
          
          // If the API value is 0 or very small, calculate from positions
          if (!calculatedValue || calculatedValue < 0.01) {
            calculatedValue = (protocol.portfolio_item_list || []).reduce((total, item) => {
              const positionValue = [
                ...(item.detail?.supply_token_list || []),
                ...(item.detail?.reward_token_list || [])
              ].reduce((sum, token) => sum + ((token.amount || 0) * (token.price || 0)), 0);
              return total + positionValue;
            }, 0);
            
            console.log(`📊 Protocol ${protocol.name} calculated value: $${calculatedValue.toFixed(2)} (API value was $${protocol.net_usd_value || 0})`);
            
            // Debug: Log raw portfolio item structure for this protocol
            console.log(`🔍 Debug protocol structure for ${protocol.name}:`);
            protocol.portfolio_item_list?.forEach((item, idx) => {
              console.log(`  Item ${idx + 1}:`, {
                name: item.name,
                pool_id: item.pool?.id,
                detail_structure: item.detail ? Object.keys(item.detail) : 'no detail',
                supply_tokens: item.detail?.supply_token_list?.length || 0,
                reward_tokens: item.detail?.reward_token_list?.length || 0
              });
              
              if (item.detail?.supply_token_list) {
                console.log(`    Supply tokens:`, item.detail.supply_token_list.map(t => ({
                  symbol: t.symbol,
                  amount: t.amount,
                  usd_value: (t.amount || 0) * (t.price || 0)
                })));
              }
              
              if (item.detail?.reward_token_list) {
                console.log(`    Reward tokens:`, item.detail.reward_token_list.map(t => ({
                  symbol: t.symbol,
                  amount: t.amount,
                  usd_value: (t.amount || 0) * (t.price || 0)
                })));
              }
            });
          }
          
          return {
            protocol_id: protocol.id,
            lending_rate: protocol.tvl,
            name: protocol.name,
            chain: protocol.chain_id,
            logo_url: protocol.logo_url,
            site_url: protocol.site_url,
            net_usd_value: calculatedValue,
            positions: (() => {
              // Deduplicate positions within this protocol by creating unique signature
              const uniquePositionsMap = new Map();
              (protocol.portfolio_item_list || []).forEach(item => {
                // Create unique signature based on pool_id and token amounts
                const tokenAmounts = (item.detail?.supply_token_list || [])
                  .map(t => `${t.symbol}:${(t.amount || 0).toFixed(6)}`)
                  .sort()
                  .join('|');
                const positionKey = `${item.pool?.id || 'no-pool'}-${tokenAmounts}`;
                
                if (!uniquePositionsMap.has(positionKey)) {
                  uniquePositionsMap.set(positionKey, item);
                  console.log(`  -> Added unique position: ${positionKey}`);
                } else {
                  console.log(`  -> Skipped duplicate position: ${positionKey}`);
                }
              });
              
              const uniquePositions = Array.from(uniquePositionsMap.values());
              console.log(`🔄 Deduplicated positions: ${protocol.portfolio_item_list?.length || 0} -> ${uniquePositions.length} for protocol ${protocol.name}`);
              
              return uniquePositions.map(item => ({
                position_name: item.name,
                position_id: item.detail?.portfolio_item_id || item.pool?.id,
                chain: protocol.chain_id,
                tokens: (item.detail?.supply_token_list || []).map(t => ({
                  symbol: t.symbol,
                  name: t.name,
                  amount: t.amount || 0,
                  price: t.price || 0,
                  usd_value: (t.amount || 0) * (t.price || 0),
                  chain: protocol.chain_id,
                  logo_url: t.logo_url,
                  decimals: t.decimals
                })),
                rewards: (item.detail?.reward_token_list || []).map(t => ({
                  symbol: t.symbol,
                  name: t.name,
                  amount: t.amount || 0,
                  price: t.price || 0,
                  usd_value: (t.amount || 0) * (t.price || 0),
                  chain: protocol.chain_id,
                  logo_url: t.logo_url,
                  decimals: t.decimals
                })),
                pool_id: item.pool?.id,
                pool_name: item.pool?.name,
                description: item.detail?.description,
                stats: item.stats,
                health_rate: item.health_rate,
                proxy_detail: item.proxy_detail
              }));
            })()
          };
        }),
        summary
      };
      } catch (apiError) {
        console.log(`⚠️ Live API failed for wallet ${wallet}, using stored data fallback:`, apiError.message);
        
        // Fallback to stored data if available
        if (storedWallet) {
          console.log(`📦 Using stored data for wallet ${wallet}`);
          
          const summary = {
            total_usd_value: storedWallet.protocols.reduce((sum, p) => sum + (p.net_usd_value || 0), 0),
            token_usd_value: 0,
            protocol_usd_value: storedWallet.protocols.reduce((sum, p) => sum + (p.net_usd_value || 0), 0),
            token_count: 0,
            protocol_count: storedWallet.protocols.length
          };

          return {
            address: storedWallet.address,
            balance: storedWallet.balance || 0,
            tokens: [], // Empty tokens array for stored data
            protocols: storedWallet.protocols.map(protocol => ({
              protocol_id: protocol.protocol_id,
              name: protocol.name,
              chain_id: protocol.chain || 'ethereum',
              chain: protocol.chain || 'ethereum',
              logo_url: null,
              net_usd_value: protocol.net_usd_value,
              positions: protocol.positions || []
            })),
            summary
          };
        } else {
          console.log(`❌ No stored data available for wallet ${wallet}, returning empty result`);
          
          return {
            address: wallet,
            balance: 0,
            tokens: [],
            protocols: [],
            summary: {
              total_usd_value: 0,
              token_usd_value: 0,
              protocol_usd_value: 0,
              token_count: 0,
              protocol_count: 0
            }
          };
        }
      }
    }));

    // Calculate overall portfolio summary
    const overallSummary = results.reduce((acc, wallet) => ({
      total_usd_value: acc.total_usd_value + wallet.summary.total_usd_value,
      token_usd_value: acc.token_usd_value + wallet.summary.token_usd_value,
      protocol_usd_value: acc.protocol_usd_value + wallet.summary.protocol_usd_value,
      token_count: acc.token_count + wallet.summary.token_count,
      protocol_count: acc.protocol_count + wallet.summary.protocol_count,
      wallet_count: acc.wallet_count + 1
    }), {
      total_usd_value: 0,
      token_usd_value: 0,
      protocol_usd_value: 0,
      token_count: 0,
      protocol_count: 0,
      wallet_count: 0
    });

    console.log(`✅ Successfully processed all wallets. Total portfolio value: $${overallSummary.total_usd_value.toFixed(2)}`);
    
    // Save wallet data to database for each wallet
    try {
      for (const walletResult of results) {
        const walletData = new WalletData({
          userId: targetUserId,
          walletAddress: walletResult.address,
          tokens: walletResult.tokens,
          protocols: walletResult.protocols,
          summary: walletResult.summary
        });
        await walletData.save();
        console.log(`💾 Saved wallet data for ${walletResult.address}`);
      }
    } catch (saveErr) {
      console.error('❌ Error saving wallet data:', saveErr.message);
      // Continue with response even if save fails
    }
    
    console.log(`🔄 CHECKPOINT - About to start snapshot creation process...`);
    console.log(`🔄 CHECKPOINT - Target User ID: ${targetUserId}`);
    console.log(`🔄 CHECKPOINT - Results count: ${results.length}`);
    
    // Create daily snapshots for APY calculations
    console.log(`📸 MAIN ROUTE - About to create daily snapshots for ${results.length} wallets...`);
    console.log(`📸 MAIN ROUTE - Target User ID: ${targetUserId}`);
    console.log(`📸 MAIN ROUTE - Results length: ${results.length}`);
    
    try {
      for (const walletResult of results) {
        console.log(`📸 MAIN ROUTE - Processing snapshot for wallet ${walletResult.address}...`);
        console.log(`📸 MAIN ROUTE - Wallet result summary:`, {
          address: walletResult.address,
          tokensCount: walletResult.tokens?.length,
          protocolsCount: walletResult.protocols?.length,
          summaryValue: walletResult.summary?.total_usd_value
        });
        await createDailySnapshot(targetUserId, walletResult.address, walletResult);
        console.log(`📸 MAIN ROUTE - Finished processing snapshot for wallet ${walletResult.address}`);
      }
      console.log(`✅ MAIN ROUTE - Daily snapshots created successfully for all ${results.length} wallets`);
    } catch (snapshotErr) {
      console.error('❌ MAIN ROUTE - Error creating daily snapshots:', snapshotErr.message);
      console.error('❌ MAIN ROUTE - Snapshot error details:', snapshotErr);
      // Continue with response even if snapshot creation fails
    }
    
    res.json(ApiResponse.success(
      { 
        portfolios: results,
        overall_summary: overallSummary,
        timestamp: new Date().toISOString()
      },
      'Wallets data retrieved successfully'
    ));
  } catch (err) {
    console.error('❌ Main error in /wallets route:', err.response?.data || err.message);
    res.status(500).json(ApiResponse.error('Failed to fetch wallet and protocol data', 500, err.message));
  }
});

// GET /api/wallet/:address -> fetch enriched data for specific wallet
router.get('/wallet/:address', auth, requireUser, async (req, res) => {
  const address = req.params.address;
  console.log(`🔍 Fetching data for single wallet: ${address}`);
  
  // Check if user has access to this wallet
  let hasAccess = false;
  let targetUserId = req.user._id;
  
  if (req.user.role === 'admin') {
    // Admin can access any wallet, optionally specify userId in query
    const { userId } = req.query;
    if (userId) {
      const targetUser = await User.findById(userId);
      if (!targetUser) return res.status(404).json({ error: 'User not found' });
      hasAccess = targetUser.wallets.includes(address);
      targetUserId = targetUser._id;
    } else {
      // Admin accessing any wallet (for system admin purposes)
      hasAccess = true;
    }
  } else {
    // Regular user can only access their own wallets
    const user = await User.findById(req.user._id);
    hasAccess = user.wallets.includes(address);
  }
  
  if (!hasAccess) {
    return res.status(403).json({ error: 'Access denied: Wallet not associated with your account' });
  }
  
  try {
    // Fetch tokens and protocols in parallel
    const [tokens, protocols] = await Promise.all([
      fetchTokens(address),
      fetchAllProtocols(address)
    ]);
    
    // Get prices from CoinGecko
    const coinGeckoPrices = await fetchPricesFromCoinGecko(tokens);
    
    const enrichedTokens = tokens.map(token => {
      const symbol = (token.symbol || '').toLowerCase();
      let finalPrice = coinGeckoPrices[symbol] || token.price || 0;
      
      return {
        id: token.id,
        name: token.name,
        symbol: token.symbol,
        amount: token.amount || 0,
        price: finalPrice,
        usd_value: finalPrice * (token.amount || 0),
        chain: token.chain_id || token.chain,
        logo_url: token.logo_url,
        decimals: token.decimals
      };
    });
    
    const enrichedProtocols = protocols
      .filter(protocol => protocol.net_usd_value && protocol.net_usd_value > 0.01)
      .map(protocol => ({
        protocol_id: protocol.id,
        name: protocol.name,
        chain: protocol.chain_id,
        net_usd_value: protocol.net_usd_value || 0,
        logo_url: protocol.logo_url,
        positions: (protocol.portfolio_item_list || []).map(item => ({
          position_name: item.name,
          position_id: item.detail?.portfolio_item_id || item.pool?.id,
          chain: protocol.chain_id,
          tokens: (item.detail?.supply_token_list || []).map(t => ({
            symbol: t.symbol,
            name: t.name,
            amount: t.amount || 0,
            price: t.price || 0,
            usd_value: (t.amount || 0) * (t.price || 0),
            chain: protocol.chain_id,
            logo_url: t.logo_url,
            decimals: t.decimals
          })),
          rewards: (item.detail?.reward_token_list || []).map(t => ({
            symbol: t.symbol,
            name: t.name,
            amount: t.amount || 0,
            price: t.price || 0,
            usd_value: (t.amount || 0) * (t.price || 0),
            chain: protocol.chain_id,
            logo_url: t.logo_url,
            decimals: t.decimals
          })),
          pool_id: item.pool?.id,
          pool_name: item.pool?.name,
          description: item.detail?.description,
          stats: item.stats,
          health_rate: item.health_rate,
          proxy_detail: item.proxy_detail
        }))
      }));
    
    const summary = calculatePortfolioSummary(enrichedTokens, enrichedProtocols);
    
    // Save single wallet data to database
    try {
      const walletData = new WalletData({
        userId: targetUserId,
        walletAddress: address,
        tokens: enrichedTokens,
        protocols: enrichedProtocols,
        summary: summary
      });
      await walletData.save();
      console.log(`💾 Saved single wallet data for ${address}`);
    } catch (saveErr) {
      console.error('❌ Error saving single wallet data:', saveErr.message);
      // Continue with response even if save fails
    }
    
    // Create daily snapshot for this wallet
    try {
      const walletResult = {
        address,
        tokens: enrichedTokens,
        protocols: enrichedProtocols,
        summary
      };
      await createDailySnapshot(targetUserId, address, walletResult);
      console.log(`📸 Created snapshot for single wallet ${address}`);
    } catch (snapshotErr) {
      console.error('❌ Error creating snapshot for single wallet:', snapshotErr.message);
      // Continue with response even if snapshot creation fails
    }
    
    res.json({ 
      address, 
      tokens: enrichedTokens,
      protocols: enrichedProtocols,
      summary,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('❌ Error in /wallet/:address route:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch wallet data', details: err.message });
  }
});

// New route to get detailed protocol information
router.get('/wallet/:address/protocol/:protocolId/:chainId', auth, async (req, res) => {
  const { address, protocolId, chainId } = req.params;
  
  try {
    console.log(`📡 Fetching detailed protocol data for ${protocolId} on ${chainId}...`);
    
    const { data } = await axios.get(
      `${DEBANK_BASE}/user/protocol`,
      {
        params: { 
          id: address, 
          protocol_id: protocolId,
          chain_id: chainId 
        },
        headers: { 
          AccessKey: process.env.DEBANK_API_KEY, 
          Accept: 'application/json' 
        },
        timeout: 10000
      }
    );
    
    res.json({ 
      protocol: data,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error(`❌ Error fetching protocol details:`, err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch protocol details', details: err.message });
  }
});

// Debug endpoint to check recent snapshots
router.get('/debug/snapshots', auth, async (req, res) => {
  try {
    const { userId } = req.query;
    const targetUserId = userId || req.user._id;
    
    console.log(`🔍 Checking recent snapshots for user: ${targetUserId}`);
    
    const snapshots = await DailySnapshot.find({ userId: targetUserId })
      .sort({ date: -1 })
      .limit(5);
    
    const snapshotSummary = snapshots.map(s => ({
      date: s.date,
      walletAddress: s.walletAddress,
      totalNavUsd: s.totalNavUsd,
      positionCount: s.positions?.length || 0,
      hasRewardTokens: s.positions?.some(p => p.rewardTokens?.length > 0) || false,
      createdAt: s.createdAt
    }));
    
    res.json({
      userId: targetUserId,
      snapshotCount: snapshots.length,
      snapshots: snapshotSummary,
      message: `Found ${snapshots.length} recent snapshots`
    });
  } catch (error) {
    console.error('❌ Error checking snapshots:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;