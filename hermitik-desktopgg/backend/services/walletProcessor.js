const {
  fetchTokens,
  fetchAllProtocols,
  fetchPricesFromCoinGecko
} = require('../utils/debankUtils'); 

async function processWalletData(wallet, includeSummary = false) {
  const [tokensRaw, protocols] = await Promise.all([
    fetchTokens(wallet),
    fetchAllProtocols(wallet)
  ]);

  const coinGeckoPrices = await fetchPricesFromCoinGecko(tokensRaw);

  const enrichedTokens = tokensRaw.map(token => {
    const symbol = (token.symbol || '').toLowerCase();
    let finalPrice = 0;

    if (coinGeckoPrices[symbol]) finalPrice = coinGeckoPrices[symbol];
    else if (symbol.startsWith('w') && coinGeckoPrices[symbol.slice(1)]) finalPrice = coinGeckoPrices[symbol.slice(1)];
    else if (token.price && token.price > 0) finalPrice = token.price;

    return {
      symbol: token.symbol,
      name: token.name,
      chain: token.chain_id || token.chain,
      amount: token.amount,
      price: finalPrice,
      usd_value: (token.amount || 0) * finalPrice,
      logo_url: token.logo_url,
      decimals: token.decimals
    };
  });

  const navUsd = enrichedTokens.reduce((sum, t) => sum + t.usd_value, 0);

  if (includeSummary) {
    const token_usd_value = navUsd;
    const protocol_usd_value = protocols.reduce((sum, p) => sum + (p.net_usd_value || 0), 0);

    const summary = {
      total_usd_value: token_usd_value + protocol_usd_value,
      token_usd_value,
      protocol_usd_value,
      token_count: enrichedTokens.length,
      protocol_count: protocols.length
    };

    return { tokens: enrichedTokens, navUsd, protocols, summary };
  }

  return { tokens: enrichedTokens, navUsd, protocols };
}


module.exports = { processWalletData };
