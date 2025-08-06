function convertPortfolioToExcelTables(portfolio) {
  // TOKENS TABLE
  const tokensTable = [
    ['TOKENS', '', '', '', '', '', 'Tokens NAV', 0],
    ['', '', 'chain', 'ticker symbol', 'amount', 'price', 'usd value', ''],
  ];

  let tokensNav = 0;
  (portfolio.tokens || []).forEach(token => {
    tokensNav += token.usd_value || 0;
    tokensTable.push([
      '', '', token.chain || '', token.symbol || '', token.amount || 0, token.price || 0, token.usd_value || 0, ''
    ]);
  });
  tokensTable[0][7] = tokensNav;

  // POSITIONS TABLE
  const positionsTable = [
    ['POSITIONS', '', '', '', '', '', 'Positions NAV', 0]
  ];
  let positionsNav = 0;

  (portfolio.protocols || []).forEach(protocol => {
    let protocolNav = 0;
    // Protocol header
    positionsTable.push([
      protocol.name || '', 'Protocol NAV', 0, '', '', '', '', ''
    ]);
    (protocol.positions || []).forEach(position => {
      // Calculate position NAV
      let positionNav = 0;
      (position.supply_tokens || []).forEach(t => { positionNav += t.usd_value || 0; });
      (position.reward_tokens || []).forEach(t => { positionNav += t.usd_value || 0; });
      protocolNav += positionNav;

      // Position header
      const symbolList = (position.supply_tokens || []).map(t => t.symbol).join('-');
      positionsTable.push([
        symbolList, position.chain || '', '', '', '', '', 'Position NAV', positionNav
      ]);
      // Supply tokens
      positionsTable.push([
        'Position', '', 'ticker symbol', 'amount', 'price', 'usd value', '', ''
      ]);
      (position.supply_tokens || []).forEach(t => {
        positionsTable.push([
          '', '', t.symbol || '', t.amount || 0, t.price || 0, t.usd_value || 0, '', ''
        ]);
      });
      // Rewards
      positionsTable.push(['Rewards', '', '', '', '', '', '', 0]);
      (position.reward_tokens || []).forEach(t => {
        positionsTable.push([
          '', '', t.symbol || '', t.amount || 0, t.price || 0, t.usd_value || 0, '', ''
        ]);
      });
    });
    // Fill protocol NAV
    positionsTable[positionsTable.length - protocol.positions.length - 1][2] = protocolNav;
    positionsNav += protocolNav;
  });
  positionsTable[0][7] = positionsNav;

  return { tokensTable, positionsTable };
}

const { tokensTable, positionsTable } = convertPortfolioToExcelTables(portfolio);
// Now you can export these arrays to Excel using a library like xlsx or csv-stringify