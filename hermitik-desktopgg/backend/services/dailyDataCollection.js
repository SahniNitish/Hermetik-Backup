// services/dailyDataCollection.js - FIXED VERSION
const axios = require('axios');
const User = require('../models/User');
const DataStandardizationService = require('./dataStandardization');
const ErrorUtils = require('../utils/errorUtils');
const httpClient = require('../utils/httpClient');

const DEBANK_BASE = 'https://pro-openapi.debank.com/v1';
const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const CHAINS = ['eth', 'bsc', 'arb', 'matic', 'base', 'op'];

class DailyDataCollectionService {
  
  // Add rate limiting helpers
  static async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Cache for CoinGecko prices to avoid repeated calls
  static priceCache = new Map();
  static cacheTimestamp = 0;
  static CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Fetch tokens for a wallet (reusing your existing logic with rate limiting)
   */
  static async fetchTokens(address) {
    let allTokens = [];
    console.log(`🔍 Fetching tokens for address: ${address}`);
    
    for (const chain of CHAINS) {
      try {
        // Add delay between chain requests to avoid rate limiting
        await this.delay(1000);
        
        const { data } = await axios.get(
          `${DEBANK_BASE}/user/token_list`,
          {
            params: { 
              id: address, 
              chain_id: chain, 
              is_all: false
            },
            headers: { 
              AccessKey: process.env.DEBANK_API_KEY, 
              Accept: 'application/json' 
            },
            timeout: 15000 // Increased timeout
          }
        );
        
        const tokensWithChain = data
          .filter(token => {
            const spamKeywords = ['visit', 'claim', 'airdrop', 'reward', 'www.', 'http', '.com', '.io', '.xyz', '.top', '.eu'];
            const tokenName = (token.name || '').toLowerCase();
            const tokenSymbol = (token.symbol || '').toLowerCase();
            
            return !spamKeywords.some(keyword => 
              tokenName.includes(keyword) || tokenSymbol.includes(keyword)
            );
          })
          .map(token => ({
            ...token,
            chain_id: chain
          }));
        
        allTokens.push(...tokensWithChain);
        console.log(`✅ Found ${tokensWithChain.length} clean tokens on ${chain}`);
        
      } catch (err) {
        console.error(`❌ Error fetching tokens for ${chain}:`, err.message);
        // Continue with other chains even if one fails
      }
    }
    
    return allTokens;
  }
  
  /**
   * Fetch protocols for a wallet with rate limiting
   */
  static async fetchAllProtocols(address) {
    let allProtocols = [];
    
    for (const chain of CHAINS) {
      try {
        // Add delay between requests
        await this.delay(1000);
        
        const { data } = await axios.get(
          `${DEBANK_BASE}/user/all_complex_protocol_list`,
          {
            params: { 
              id: address, 
              chain_id: chain 
            },
            headers: { 
              AccessKey: process.env.DEBANK_API_KEY, 
              Accept: 'application/json' 
            },
            timeout: 15000
          }
        );
        
        if (data && data.length > 0) {
          const protocolsWithChain = data.map(protocol => ({
            ...protocol,
            chain_id: chain
          }));
          allProtocols.push(...protocolsWithChain);
          console.log(`✅ Found ${data.length} protocols on ${chain}`);
        }
      } catch (err) {
        console.error(`❌ Error fetching protocols for ${chain}:`, err.message);
      }
    }
    
    return allProtocols;
  }
  
  /**
   * Fetch prices from CoinGecko with caching and rate limiting
   */
  static async fetchPricesFromCoinGecko(tokens) {
    if (!tokens.length) return {};
    
    // Check cache first
    const now = Date.now();
    if (this.priceCache.size > 0 && (now - this.cacheTimestamp) < this.CACHE_DURATION) {
      console.log('💰 Using cached CoinGecko prices');
      return Object.fromEntries(this.priceCache);
    }
    
    const symbolToId = {
      'eth': 'ethereum', 'weth': 'ethereum', 'btc': 'bitcoin', 'wbtc': 'wrapped-bitcoin',
      'usdt': 'tether', 'usdc': 'usd-coin', 'dai': 'dai', 'busd': 'binance-usd',
      'matic': 'matic-network', 'wmatic': 'matic-network', 'bnb': 'binancecoin',
      'wbnb': 'binancecoin', 'avax': 'avalanche-2', 'wavax': 'avalanche-2',
      'op': 'optimism', 'arb': 'arbitrum', 'uni': 'uniswap', 'sushi': 'sushi',
      'aave': 'aave', 'comp': 'compound-coin', 'mkr': 'maker', 'snx': 'havven',
      'crv': 'curve-dao-token', 'cvx': 'convex-finance', 'frax': 'frax',
      'fxs': 'frax-share', 'bal': 'balancer', 'yfi': 'yearn-finance'
    };
    
    const uniqueSymbols = [...new Set(tokens.map(t => t.symbol?.toLowerCase()).filter(Boolean))];
    const coinGeckoIds = [...new Set(uniqueSymbols.map(symbol => symbolToId[symbol]).filter(Boolean))];
    
    if (!coinGeckoIds.length) {
      console.log('⚠️ No matching CoinGecko IDs found');
      return {};
    }
    
    try {
      console.log(`💰 Fetching prices for ${coinGeckoIds.length} tokens from CoinGecko...`);
      
      // Add delay to respect rate limits
      await this.delay(2000);
      
      const { data } = await axios.get(
        `${COINGECKO_BASE}/simple/price`,
        { 
          params: { 
            ids: coinGeckoIds.join(','), 
            vs_currencies: 'usd'
          },
          timeout: 20000,
          headers: {
            'User-Agent': 'HermetikPortfolio/1.0'
          }
        }
      );
      
      console.log(`✅ Fetched prices for ${Object.keys(data).length} tokens`);
      
      // Create reverse mapping for easy lookup
      const priceMap = {};
      for (const [symbol, id] of Object.entries(symbolToId)) {
        if (data[id]) {
          priceMap[symbol] = data[id].usd;
        }
      }
      
      // Update cache
      this.priceCache.clear();
      for (const [symbol, price] of Object.entries(priceMap)) {
        this.priceCache.set(symbol, price);
      }
      this.cacheTimestamp = now;
      
      return priceMap;
    } catch (err) {
      if (err.response?.status === 429) {
        console.error('❌ CoinGecko rate limit hit, using fallback prices');
        // Return cached prices if available, even if expired
        if (this.priceCache.size > 0) {
          return Object.fromEntries(this.priceCache);
        }
      } else {
        console.error('❌ Error fetching prices from CoinGecko:', err.message);
      }
      return {};
    }
  }
  
  /**
   * Process a single wallet and collect daily data
   */
  static async processWallet(userId, walletAddress) {
    try {
      console.log(`📊 Processing wallet ${walletAddress} for daily collection...`);
      
      // Check if we already processed this wallet today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const existingSnapshot = await require('../models/DailySnapshot').findOne({
        userId,
        walletAddress,
        date: today
      });
      
      if (existingSnapshot) {
        console.log(`✅ Wallet ${walletAddress} already processed today, skipping...`);
        return existingSnapshot;
      }
      
      // Fetch raw data with delays
      const [tokens, protocols] = await Promise.all([
        this.fetchTokens(walletAddress),
        this.fetchAllProtocols(walletAddress)
      ]);
      
      // Get prices (with caching)
      const coinGeckoPrices = await this.fetchPricesFromCoinGecko(tokens);
      
      // Enrich tokens with prices
      const enrichedTokens = tokens.map(token => {
        const symbol = (token.symbol || '').toLowerCase();
        let finalPrice = coinGeckoPrices[symbol] || token.price || 0;
        
        // Try wrapped token equivalent if direct symbol not found
        if (!finalPrice && symbol.startsWith('w')) {
          finalPrice = coinGeckoPrices[symbol.substring(1)] || 0;
        }
        
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
      
      // Process protocols with correct API structure
      const processedProtocols = protocols
        .filter(protocol => {
          // Calculate total value from portfolio items if net_usd_value is missing
          const totalValue = (protocol.portfolio_item_list || []).reduce((sum, item) => {
            return sum + (item.stats?.net_usd_value || 0);
          }, 0);
          return totalValue > 0.01;
        })
        .map(protocol => {
          // Calculate net value from portfolio items
          const calculatedNetValue = (protocol.portfolio_item_list || []).reduce((sum, item) => {
            return sum + (item.stats?.net_usd_value || 0);
          }, 0);
          
          return {
            protocol_id: protocol.id,
            name: protocol.name,
            chain: protocol.chain,
            net_usd_value: calculatedNetValue,
            logo_url: protocol.logo_url,
            positions: (protocol.portfolio_item_list || []).map(item => ({
              position_name: item.name,
              tokens: (item.detail?.supply_token_list || []).map(t => ({
                symbol: t.symbol,
                amount: t.amount,
                usd_value: (t.amount || 0) * (t.price || 0)
              })),
              rewards: (item.detail?.reward_token_list || []).map(t => ({
                symbol: t.symbol,
                amount: t.amount,
                usd_value: (t.amount || 0) * (t.price || 0)
              }))
            }))
          };
        });
      
      // Calculate summary
      const tokenValue = enrichedTokens.reduce((sum, token) => sum + (token.usd_value || 0), 0);
      const protocolValue = processedProtocols.reduce((sum, protocol) => sum + (protocol.net_usd_value || 0), 0);
      
      const portfolioData = {
        tokens: enrichedTokens,
        protocols: processedProtocols,
        summary: {
          total_usd_value: tokenValue + protocolValue,
          token_usd_value: tokenValue,
          protocol_usd_value: protocolValue
        }
      };
      
      // Standardize the data
      const standardizedData = DataStandardizationService.standardizePortfolioData(
        portfolioData,
        userId,
        walletAddress
      );
      
      // Save to database
      const savedSnapshot = await DataStandardizationService.saveDailySnapshot(standardizedData);
      
      console.log(`✅ Successfully processed wallet ${walletAddress}, NAV: $${savedSnapshot.totalNavUsd.toFixed(2)}`);
      return savedSnapshot;
      
    } catch (error) {
      console.error(`❌ Error processing wallet ${walletAddress}:`, {
        message: error.message,
        stack: error.stack,
        walletAddress,
        userId
      });
      
      // Re-throw with more context
      throw new Error(`Failed to process wallet ${walletAddress} for user ${userId}: ${error.message}`);
    }
  }
  
  /**
   * Run daily collection for all users (FIXED)
   */
  static async runDailyCollection() {
    try {
      console.log('🚀 Starting daily data collection...');
      
      // Get all users with wallets and create unique wallet list
      const users = await User.find({ wallets: { $exists: true, $ne: [] } });
      console.log(`Found ${users.length} users with wallets`);
      
      // Create a Set to track unique wallet-user combinations
      const processedWallets = new Set();
      const walletUserPairs = [];
      
      try {
        for (const user of users) {
          for (const wallet of user.wallets) {
            const walletKey = `${user._id}-${wallet}`;
            if (!processedWallets.has(walletKey)) {
              processedWallets.add(walletKey);
              walletUserPairs.push({ userId: user._id, wallet });
            }
          }
        }
        
        console.log(`Processing ${walletUserPairs.length} unique wallet-user combinations`);
      } finally {
        // Clean up memory to prevent leaks
        processedWallets.clear();
      }
      
      const results = [];
      
      for (const { userId, wallet } of walletUserPairs) {
        try {
          const snapshot = await this.processWallet(userId, wallet);
          results.push({
            userId,
            wallet,
            success: true,
            navUsd: snapshot.totalNavUsd
          });
          
          // Add delay between wallet processing to avoid rate limiting
          await this.delay(3000);
          
        } catch (error) {
          console.error(`Failed to process wallet ${wallet} for user ${userId}:`, error.message);
          results.push({
            userId,
            wallet,
            success: false,
            error: error.message
          });
          
          // Still add delay even on error
          await this.delay(1000);
        }
      }
      
      const successCount = results.filter(r => r.success).length;
      const totalWallets = results.length;
      
      console.log(`✅ Daily collection completed: ${successCount}/${totalWallets} wallets processed successfully`);
      return results;
      
    } catch (error) {
      console.error('❌ Error in daily collection:', error);
      throw error;
    }
  }
  
  /**
   * Schedule daily collection (call this at midnight UTC)
   */
  static scheduleDailyCollection() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0); // Midnight UTC
    
    const timeUntilMidnight = tomorrow.getTime() - now.getTime();
    
    console.log(`⏰ Scheduling next daily collection in ${Math.round(timeUntilMidnight / 1000 / 60 / 60)} hours`);
    
    setTimeout(() => {
      this.runDailyCollection();
      // Schedule the next collection (24 hours later)
      setInterval(() => {
        this.runDailyCollection();
      }, 24 * 60 * 60 * 1000); // 24 hours
    }, timeUntilMidnight);
  }
}

module.exports = DailyDataCollectionService;