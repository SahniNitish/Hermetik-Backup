const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const WalletData = require('../models/WalletData');
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
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id);
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = { ...user.toObject(), role: payload.role }; // Include role from token
    next();
  } catch {
    res.status(403).json({ error: 'Invalid token' });
  }
}

// Role-based middleware for wallet routes
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

const requireUser = (req, res, next) => {
  if (!req.user.role || (req.user.role !== 'admin' && req.user.role !== 'user')) {
    return res.status(403).json({ error: 'User access required' });
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
  
  if (!wallets.length) return res.status(400).json({ error: 'No wallets added' });

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
    
    res.json({ 
      portfolios: results,
      overall_summary: overallSummary,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('❌ Main error in /wallets route:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch wallet and protocol data', details: err.message });
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
        logo_url: protocol.logo_url
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

module.exports = router;