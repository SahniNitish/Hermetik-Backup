const httpClient = require('./httpClient');
const CHAINS = ['eth', 'bsc', 'arb', 'matic', 'base', 'op'];

async function fetchTokens(address) {
  let allTokens = [];
  const validatedAddress = httpClient.validateWalletAddress(address);
  console.log(`🔍 Fetching tokens for address: ${validatedAddress}`);
  
  const debankClient = httpClient.createDebankClient();
  
  for (const chain of CHAINS) {
    try {
      httpClient.validateChainId(chain);
      console.log(`📡 Fetching tokens from ${chain}...`);
      
      const data = await debankClient.get('/user/token_list', {
        id: validatedAddress, 
        chain_id: chain, 
        is_all: false // Changed back to false to avoid spam tokens
      });
      
      console.log(`✅ Found ${data.length} tokens on ${chain}`);
     
      // Add chain info to each token and filter out spam tokens
      const tokensWithChain = data
        .filter(token => {
          // Filter out obvious spam tokens
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
    } catch (err) {
      console.error(`❌ Error fetching tokens for ${chain}:`, {
        operationId: err.operationId,
        statusCode: err.statusCode,
        message: err.message,
        chain,
        address: validatedAddress
      });
    }
  }
  
  console.log(`📊 Total clean tokens found: ${allTokens.length}`);
  return allTokens;
}

async function fetchPricesFromCoinGecko(tokens) {
  if (!tokens.length) return {};
  
  // Create a comprehensive symbol to CoinGecko ID mapping
  const symbolToId = {
    // Major tokens
    'eth': 'ethereum',
    'weth': 'ethereum',
    'btc': 'bitcoin',
    'wbtc': 'wrapped-bitcoin',
    'usdt': 'tether',
    'usdc': 'usd-coin',
    'dai': 'dai',
    'busd': 'binance-usd',
    'matic': 'matic-network',
    'wmatic': 'matic-network',
    'bnb': 'binancecoin',
    'wbnb': 'binancecoin',
    'avax': 'avalanche-2',
    'wavax': 'avalanche-2',
    'op': 'optimism',
    'arb': 'arbitrum',
    
    // DeFi tokens
    'uni': 'uniswap',
    'sushi': 'sushi',
    'aave': 'aave',
    'comp': 'compound-coin',
    'mkr': 'maker',
    'snx': 'havven',
    'crv': 'curve-dao-token',
    'cvx': 'convex-finance',
    'frax': 'frax',
    'fxs': 'frax-share',
    'bal': 'balancer',
    'yearn': 'yearn-finance',
    'yfi': 'yearn-finance',
    
    // Stablecoins
    'frax': 'frax',
    'lusd': 'liquity-usd',
    'susd': 'nusd',
    'tusd': 'true-usd',
    'gusd': 'gemini-dollar',
    'pax': 'paxos-standard',
    'usdp': 'paxos-standard',
    
    // Layer 2 tokens
    'matic': 'matic-network',
    'ftm': 'fantom',
    'one': 'harmony',
    'celo': 'celo',
    'movr': 'moonriver',
    'glmr': 'moonbeam',
    
    // Wrapped tokens
    'wftm': 'fantom',
    'wone': 'harmony',
    'wcelo': 'celo',
    'wmovr': 'moonriver',
    'wglmr': 'moonbeam'
  };
  
  // Get unique symbols and map to CoinGecko IDs
  const uniqueSymbols = [...new Set(tokens.map(t => t.symbol?.toLowerCase()).filter(Boolean))];
  const coinGeckoIds = [...new Set(uniqueSymbols.map(symbol => symbolToId[symbol]).filter(Boolean))];
  
  console.log(`💰 Fetching prices for ${coinGeckoIds.length} tokens from CoinGecko...`);
  
  if (!coinGeckoIds.length) {
    console.log(`⚠️ No matching CoinGecko IDs found`);
    return {};
  }
  
  try {
    const coinGeckoClient = httpClient.createCoinGeckoClient();
    const data = await coinGeckoClient.get('/simple/price', {
      ids: coinGeckoIds.join(','), 
      vs_currencies: 'usd',
      include_market_cap: true,
      include_24hr_vol: true,
      include_24hr_change: true,
      include_last_updated_at: true 
    });
    
    console.log(`✅ Fetched prices for ${Object.keys(data).length} tokens`);
    
    // Create reverse mapping for easy lookup
    const priceMap = {};
    for (const [symbol, id] of Object.entries(symbolToId)) {
      if (data[id]) {
        priceMap[symbol] = data[id].usd;
      }
    }
    
    return priceMap;
  } catch (err) {
    console.error('❌ Error fetching prices from CoinGecko:', err.response?.data || err.message);
    return {};
  }
}


async function fetchAllProtocols(address) {
  let allProtocols = [];
  const validatedAddress = httpClient.validateWalletAddress(address);
  console.log(`🔍 Fetching all protocols for address: ${validatedAddress}`);
  
  const debankClient = httpClient.createDebankClient();
  
  for (const chain of CHAINS) {
    try {
      httpClient.validateChainId(chain);
      console.log(`📡 Fetching protocols from ${chain}...`);
      
      const data = await debankClient.get('/user/all_complex_protocol_list', {
        id: validatedAddress, 
        chain_id: chain 
      });
   
      if (data && data.length > 0) {
        console.log(`✅ Found ${data.length} protocols on ${chain}`);
        const protocolsWithChain = data.map(protocol => ({
          ...protocol,
          chain_id: chain
        }));
        allProtocols.push(...protocolsWithChain);
      }
    } catch (err) {
      console.error(`❌ Error fetching protocols for ${chain}:`, {
        operationId: err.operationId,
        statusCode: err.statusCode,
        message: err.message,
        chain,
        address: validatedAddress
      });
    }
  }
  
  console.log(`📊 Total protocols found: ${allProtocols.length}`);
  return allProtocols;
}

module.exports = {
  fetchTokens,
  fetchAllProtocols,
  fetchPricesFromCoinGecko
};
