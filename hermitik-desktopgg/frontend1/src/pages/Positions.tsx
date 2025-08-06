import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { walletApi } from '../services/api';
import { Search, Filter } from 'lucide-react';
import Card from '../components/UI/Card';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import DataTable from '../components/UI/DataTable';
import AccordionDataTable from '../components/UI/AccordionDataTable';
import AdminViewBanner from '../components/Admin/AdminViewBanner';
import { useUserView } from '../contexts/UserViewContext';
import { Protocol, Token } from '../types';

const Positions: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedChain, setSelectedChain] = useState('all');

  const { viewedUser } = useUserView();

  const { data: wallets, isLoading, error } = useQuery({
    queryKey: ['wallets', viewedUser?.id],
    queryFn: () => {
      console.log('🔄 Fetching wallet data...');
      // If admin is viewing as a user, fetch that user's wallets
      if (viewedUser) {
        console.log('👤 Admin viewing user:', viewedUser.id);
        return walletApi.getUserWallets(viewedUser.id);
      }
      console.log('👤 Fetching current user wallets');
      return walletApi.getWallets();
    },
    refetchInterval: 30000,
    onSuccess: (data) => {
      console.log('✅ Wallet API Success - Raw data:', data);
    },
    onError: (err) => {
      console.error('❌ Wallet API Error:', err);
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400">Error loading positions data</p>
      </div>
    );
  }

  if (!wallets || wallets.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">No wallets found. Add a wallet to see your DeFi positions.</p>
        <p className="text-gray-500 text-sm mt-2">Check browser console for API errors.</p>
      </div>
    );
  }

  // Debug: Log the raw wallet data to understand the structure
  console.log('=== RAW WALLET DATA ===');
  console.log(`Total wallets: ${wallets.length}`);
  
  // Look specifically for the hello wallet with Uniswap V4 position
  const helloWallet = wallets.find(w => w.address === '0xbfa2ef4cab56ace20a4e11bb6080a09d126bf5cd');
  if (helloWallet) {
    console.log('🔍 FOUND HELLO WALLET:', helloWallet.address);
    console.log('  Total protocols:', helloWallet.protocols?.length || 0);
    console.log('  Wallet total value: $', helloWallet.totalValue || 0);
    
    // Look for Uniswap protocols
    const uniswapProtocols = helloWallet.protocols?.filter(p => 
      p.name?.toLowerCase().includes('uniswap') || 
      p.protocol_id?.toLowerCase().includes('uniswap')
    ) || [];
    
    console.log('🦄 Uniswap protocols found:', uniswapProtocols.length);
    uniswapProtocols.forEach((protocol, idx) => {
      console.log(`  Uniswap ${idx + 1}:`, {
        name: protocol.name,
        protocol_id: protocol.protocol_id,
        chain: protocol.chain,
        net_usd_value: protocol.net_usd_value,
        positions_count: protocol.positions?.length || 0
      });
      
      protocol.positions?.forEach((pos, posIdx) => {
        console.log(`    Position ${posIdx + 1}: ${pos.position_name}`);
        console.log(`      Tokens:`, pos.tokens?.map(t => ({
          symbol: t.symbol, 
          amount: t.amount, 
          usd_value: t.usd_value
        })));
        console.log(`      Rewards:`, pos.rewards?.map(r => ({
          symbol: r.symbol, 
          amount: r.amount, 
          usd_value: r.usd_value
        })));
      });
    });
  } else {
    console.log('❌ Hello wallet not found in wallets array');
  }
  
  wallets.forEach((wallet, walletIndex) => {
    console.log(`Wallet ${walletIndex + 1} (${wallet.address}):`);
    console.log(`  Protocols: ${wallet.protocols?.length || 0}, Total Value: $${wallet.totalValue || 0}`);
    
    // Log high-value protocols specifically
    const highValueProtocols = wallet.protocols?.filter(p => p.net_usd_value > 1000) || [];
    if (highValueProtocols.length > 0) {
      console.log(`  🔥 HIGH VALUE PROTOCOLS (${highValueProtocols.length}):`);
      highValueProtocols.forEach(protocol => {
        console.log(`    ${protocol.name}: $${protocol.net_usd_value} (${protocol.positions?.length || 0} positions)`);
      });
    }
  });

  // Flatten all protocols from all wallets and deduplicate
  const allProtocolsFlat = wallets.flatMap(wallet => 
    wallet.protocols.map(protocol => ({
      ...protocol,
      sourceWallet: wallet.address // Add source wallet for debugging
    }))
  );
  
  // Debug: Show all flattened protocols
  console.log('=== FLATTENED PROTOCOLS ===');
  console.log(`Total flattened protocols: ${allProtocolsFlat.length}`);
  allProtocolsFlat.forEach((protocol, index) => {
    console.log(`${index + 1}. ${protocol.name} (${protocol.protocol_id}) from wallet ${protocol.sourceWallet}`);
    console.log(`   Net USD Value: $${protocol.net_usd_value}`);
    console.log(`   Positions: ${protocol.positions?.length || 0}`);
  });
  
  // Deduplicate protocols by protocol name only (consolidate across chains)
  const uniqueProtocolsMap = new Map<string, Protocol & { sourceWallet?: string }>();
  allProtocolsFlat.forEach(protocol => {
    const key = protocol.name; // Group by name only, not by chain
    console.log(`Processing protocol key: ${key} for ${protocol.name}`);
    
    if (!uniqueProtocolsMap.has(key)) {
      uniqueProtocolsMap.set(key, protocol);
      console.log(`  -> Added new protocol: ${protocol.name}`);
    } else {
      console.log(`  -> Found duplicate, merging with existing ${protocol.name}`);
      // If we have a duplicate, merge the positions and values
      const existing = uniqueProtocolsMap.get(key)!;
      existing.net_usd_value += protocol.net_usd_value;
      
      // Merge positions (deduplicate by position name + chain to avoid merging different positions)
      protocol.positions.forEach(newPosition => {
        const positionKey = `${newPosition.position_name}-${newPosition.chain || protocol.chain}`;
        const existingPosition = existing.positions.find(p => 
          `${p.position_name}-${p.chain || protocol.chain}` === positionKey
        );
        
        if (!existingPosition) {
          existing.positions.push(newPosition);
          console.log(`    -> Added new position: ${newPosition.position_name} (${newPosition.chain || protocol.chain})`);
        } else {
          console.log(`    -> Merging position: ${newPosition.position_name} (${newPosition.chain || protocol.chain})`);
          // Merge tokens and rewards in the position
          newPosition.tokens.forEach(token => {
            const existingToken = existingPosition.tokens.find(t => 
              t.symbol === token.symbol && t.chain === token.chain
            );
            if (!existingToken) {
              existingPosition.tokens.push(token);
            } else {
              existingToken.amount += token.amount;
              existingToken.usd_value += token.usd_value;
            }
          });
          
          newPosition.rewards.forEach(reward => {
            const existingReward = existingPosition.rewards.find(r => 
              r.symbol === reward.symbol && r.chain === reward.chain
            );
            if (!existingReward) {
              existingPosition.rewards.push(reward);
            } else {
              existingReward.amount += reward.amount;
              existingReward.usd_value += reward.usd_value;
            }
          });
        }
      });
    }
  });
  
  const allProtocols: Protocol[] = Array.from(uniqueProtocolsMap.values()).map(protocol => {
    const { sourceWallet, ...cleanProtocol } = protocol;
    return cleanProtocol;
  });
  
  // Debug logging to help track deduplication
  console.log(`=== DEDUPLICATION SUMMARY ===`);
  console.log(`Total protocols before deduplication: ${allProtocolsFlat.length}`);
  console.log(`Unique protocols after deduplication: ${allProtocols.length}`);
  console.log('Final protocols:', allProtocols.map(p => `${p.name} (${p.protocol_id})`));

  // Get unique chains for filter
  const chains = Array.from(new Set(allProtocols.map(protocol => protocol.chain)));

  // Filter protocols - temporarily show ALL positions to debug what's available
  const filteredProtocols = allProtocols.filter(protocol => {
    const matchesSearch = protocol.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesChain = selectedChain === 'all' || protocol.chain === selectedChain;
    const hasValue = true; // Temporarily show ALL positions including zero value ones for debugging
    return matchesSearch && matchesChain && hasValue;
  });

  const totalPositionsValue = filteredProtocols.reduce((sum, protocol) => sum + protocol.net_usd_value, 0);

  // Extract all unique tokens from all wallets
  const allTokens = wallets.flatMap(wallet => wallet.tokens.map(token => ({ ...token, wallet: wallet.address })));
  const uniqueTokens = allTokens.reduce((acc, token) => {
    const key = `${token.symbol}-${token.chain}`;
    if (acc[key]) {
      acc[key].amount += token.amount;
      acc[key].usd_value += token.usd_value;
    } else {
      acc[key] = { ...token };
    }
    return acc;
  }, {} as Record<string, Token & { wallet?: string }>);
  // Filter tokens - temporarily show ALL tokens to debug what's available
  const tokensArray = Object.values(uniqueTokens).filter(token => true); // Show all tokens for debugging
  const totalTokensValue = tokensArray.reduce((sum, token) => sum + token.usd_value, 0);

  // Prepare tokens table data  
  const tokensTableData = tokensArray.map(token => ({
    chain: token.chain.toUpperCase(),
    ticker: token.symbol,
    symbol: token.name,
    amount: token.amount.toLocaleString(undefined, { maximumFractionDigits: 6 }),
    price: `$${token.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`,
    usd_value: `$${token.usd_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
  }));

  // Prepare hierarchical positions data grouped by protocol (matching Excel format)
  const protocolPositions = filteredProtocols.map(protocol => {
    console.log(`Processing protocol: ${protocol.name}`);
    
    // Aggregate all position tokens with deduplication
    const positionTokensMap = new Map<string, any>();
    const rewardTokensMap = new Map<string, any>();
    
    protocol.positions.forEach(position => {
      // Process position tokens
      position.tokens.forEach(token => {
        const key = token.symbol;
        const price = token.amount > 0 ? token.usd_value / token.amount : 0;
        
        if (!positionTokensMap.has(key)) {
          positionTokensMap.set(key, {
            ticker: token.symbol,
            symbol: token.symbol,
            amount: token.amount,
            usd_value: token.usd_value,
            price: price
          });
        } else {
          // Merge duplicate tokens
          const existing = positionTokensMap.get(key)!;
          existing.amount += token.amount;
          existing.usd_value += token.usd_value;
          existing.price = existing.amount > 0 ? existing.usd_value / existing.amount : 0;
        }
      });
      
      // Process reward tokens
      position.rewards.forEach(reward => {
        const key = reward.symbol;
        const price = reward.amount > 0 ? reward.usd_value / reward.amount : 0;
        
        if (!rewardTokensMap.has(key)) {
          rewardTokensMap.set(key, {
            ticker: reward.symbol,
            symbol: reward.symbol,
            amount: reward.amount,
            usd_value: reward.usd_value,
            price: price,
            isReward: true
          });
        } else {
          // Merge duplicate rewards
          const existing = rewardTokensMap.get(key)!;
          existing.amount += reward.amount;
          existing.usd_value += reward.usd_value;
          existing.price = existing.amount > 0 ? existing.usd_value / existing.amount : 0;
        }
      });
    });
    
    // Calculate NAV for positions and rewards (before formatting)
    const positionNavValue = Array.from(positionTokensMap.values()).reduce((sum, token) => sum + token.usd_value, 0);
    const rewardNavValue = Array.from(rewardTokensMap.values()).reduce((sum, reward) => sum + reward.usd_value, 0);
    
    // Debug NAV calculations
    console.log(`=== PROTOCOL ${protocol.name} NAV CALCULATION ===`);
    console.log(`Position tokens:`, Array.from(positionTokensMap.values()));
    console.log(`Calculated position NAV: $${positionNavValue.toLocaleString()}`);
    console.log(`Reward tokens:`, Array.from(rewardTokensMap.values()));
    console.log(`Calculated reward NAV: $${rewardNavValue.toLocaleString()}`);
    console.log(`Total calculated NAV: $${(positionNavValue + rewardNavValue).toLocaleString()}`);
    
    // Format position tokens for display (no adjustment needed - use calculated values)
    const positionData = Array.from(positionTokensMap.values()).map(token => ({
      ticker: token.ticker,
      symbol: token.symbol,
      amount: token.amount.toLocaleString(undefined, { maximumFractionDigits: 6 }),
      price: `$${token.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`,
      usd_value: `$${token.usd_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
    }));
    
    // Format reward tokens for display (no adjustment needed - use calculated values)
    const rewardData = Array.from(rewardTokensMap.values()).map(reward => ({
      ticker: reward.ticker,
      symbol: reward.symbol,
      amount: reward.amount.toLocaleString(undefined, { maximumFractionDigits: 6 }),
      price: `$${reward.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`,
      usd_value: `$${reward.usd_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      isReward: true
    }));
    
    // Use calculated NAVs directly (no adjustment needed)
    const finalPositionNav = positionNavValue;
    const finalRewardNav = rewardNavValue;
    
    console.log(`Final position NAV: $${finalPositionNav.toLocaleString()}`);
    console.log(`Final reward NAV: $${finalRewardNav.toLocaleString()}`);
    
    // Verify row-level values sum to section totals
    const positionRowsTotal = positionData.reduce((sum, row) => {
      const value = parseFloat(row.usd_value.replace(/[$,]/g, ''));
      return sum + value;
    }, 0);
    const rewardRowsTotal = rewardData.reduce((sum, row) => {
      const value = parseFloat(row.usd_value.replace(/[$,]/g, ''));
      return sum + value;
    }, 0);
    
    console.log(`Position rows total: $${positionRowsTotal.toLocaleString()}`);
    console.log(`Reward rows total: $${rewardRowsTotal.toLocaleString()}`);
    console.log(`Position NAV match: ${Math.abs(positionRowsTotal - finalPositionNav) < 0.01}`);
    console.log(`Reward NAV match: ${Math.abs(rewardRowsTotal - finalRewardNav) < 0.01}`);
    
    // Create sections for this protocol
    const sections = [];
    
    if (positionData.length > 0) {
      sections.push({
        title: 'Position',
        data: positionData,
        navValue: `$${finalPositionNav.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
      });
    }
    
    if (rewardData.length > 0) {
      sections.push({
        title: 'Rewards',
        data: rewardData,
        navValue: `$${finalRewardNav.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
      });
    }
    
    // Use the calculated total instead of protocol.net_usd_value (which may be 0)
    const calculatedTotal = finalPositionNav + finalRewardNav;
    return {
      protocol,
      sections,
      totalNavValue: calculatedTotal
    };
  });

  // Recalculate total positions value from the new hierarchical structure
  const finalTotalPositionsValue = protocolPositions.reduce((sum, item) => sum + item.totalNavValue, 0);
  
  // Debug total calculations
  console.log(`=== TOTAL NAV CALCULATION ===`);
  console.log(`Original total positions value: $${totalPositionsValue.toLocaleString()}`);
  console.log(`Calculated final total: $${finalTotalPositionsValue.toLocaleString()}`);
  console.log(`Individual protocol NAVs:`, protocolPositions.map(p => ({
    name: p.protocol.name,
    nav: p.totalNavValue
  })));
  console.log(`Sum check: $${protocolPositions.reduce((sum, item) => sum + item.totalNavValue, 0).toLocaleString()}`);
  
  // Verify our calculations match
  const shouldEqual = finalTotalPositionsValue === totalPositionsValue;
  console.log(`Final calculations match original: ${shouldEqual}`);
  
  // Additional debug: Check what we're actually passing to the AccordionDataTable
  console.log('=== PROTOCOL POSITIONS FOR TABLE ===');
  console.log(`Number of protocol positions: ${protocolPositions.length}`);
  protocolPositions.forEach((item, index) => {
    console.log(`${index + 1}. ${item.protocol.name} - ${item.sections.length} sections - $${item.totalNavValue}`);
  });

  // Define table columns
  const tokensColumns = [
    { key: 'chain', label: 'Chain', align: 'left' as const, className: 'min-w-20' },
    { key: 'ticker', label: 'Ticker', align: 'left' as const, className: 'min-w-16' },
    { key: 'symbol', label: 'Symbol', align: 'left' as const, className: 'min-w-32' },
    { key: 'amount', label: 'Amount', align: 'right' as const, className: 'min-w-24' },
    { key: 'price', label: 'Price', align: 'right' as const, className: 'min-w-20' },
    { key: 'usd_value', label: 'USD Value', align: 'right' as const, className: 'min-w-24' }
  ];

  const positionsColumns = [
    { key: 'ticker', label: 'Ticker', align: 'left' as const, className: 'min-w-16' },
    { key: 'symbol', label: 'Symbol', align: 'left' as const, className: 'min-w-32' },
    { key: 'amount', label: 'Amount', align: 'right' as const, className: 'min-w-24' },
    { key: 'price', label: 'Price', align: 'right' as const, className: 'min-w-20' },
    { key: 'usd_value', label: 'USD Value', align: 'right' as const, className: 'min-w-24' }
  ];

  return (
    <div className="space-y-8">
      <AdminViewBanner />
      
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">DeFi Positions</h1>
        <p className="text-gray-600 dark:text-gray-400">Track your lending, liquidity, and yield farming positions</p>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search protocols..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={selectedChain}
              onChange={(e) => setSelectedChain(e.target.value)}
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Chains</option>
              {chains.map(chain => (
                <option key={chain} value={chain}>{chain}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* TOKENS Section */}
      <DataTable
        columns={tokensColumns}
        data={tokensTableData}
        title="TOKENS"
        totalLabel="Tokens NAV"
        totalValue={`$${totalTokensValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
        showTotal
      />

      {/* POSITIONS Section */}
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">POSITIONS</h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm">Click on protocols and sections to expand/collapse</p>
        </div>
        <AccordionDataTable
          columns={positionsColumns}
          data={protocolPositions}
          className="mb-4"
        />
      </div>

      {/* Summary */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <p className="text-gray-600 dark:text-gray-400 text-sm">Total Tokens NAV</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">${totalTokensValue.toLocaleString()}</p>
          </div>
          <div className="text-center">
            <p className="text-gray-600 dark:text-gray-400 text-sm">Total Positions NAV</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">${finalTotalPositionsValue.toLocaleString()}</p>
          </div>
          <div className="text-center">
            <p className="text-gray-600 dark:text-gray-400 text-sm">Active Protocols</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{filteredProtocols.length}</p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Positions;