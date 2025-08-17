import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { walletApi } from '../services/api';
import { TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import Card from '../components/UI/Card';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import AdminViewBanner from '../components/Admin/AdminViewBanner';
import { useUserView } from '../contexts/UserViewContext';
import { Protocol, Wallet } from '../types';

const Positions: React.FC = () => {

  const { viewedUser } = useUserView();

  const { data: wallets, isLoading, error } = useQuery<Wallet[]>({
    queryKey: ['wallets', viewedUser?.id],
    queryFn: () => {
      // If admin is viewing as a user, fetch that user's wallets
      if (viewedUser) {
        return walletApi.getUserWallets(viewedUser.id);
      }
      return walletApi.getWallets();
    },
    refetchInterval: 30000
  });

  // Fetch position APY data for the APY display component
  const { data: positionAPYs } = useQuery({
    queryKey: ['positionAPYs', viewedUser?.id],
    queryFn: async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/analytics/positions/apy`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`
          }
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch position APYs: ${response.status}`);
        }
        
        const data = await response.json();
        return data;
      } catch (error) {
        console.error('❌ Position APYs error:', error);
        return null;
      }
    },
    enabled: !!localStorage.getItem('access_token') && !!wallets,
    refetchInterval: 300000, // Refresh every 5 minutes
    staleTime: 240000 // Consider data stale after 4 minutes
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

  if (!wallets || !Array.isArray(wallets) || wallets.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">No wallets found. Add a wallet to see your DeFi positions.</p>
        <p className="text-gray-500 text-sm mt-2">Check browser console for API errors.</p>
      </div>
    );
  }


  // Flatten all protocols from all wallets and deduplicate
  const allProtocolsFlat = (wallets || []).flatMap((wallet: Wallet) => 
    (wallet.protocols || []).map((protocol: Protocol) => ({
      ...protocol,
      sourceWallet: wallet.address // Add source wallet for APY lookup
    }))
  );
  
  // Deduplicate protocols by protocol name and chain
  const uniqueProtocolsMap = new Map<string, Protocol & { sourceWallet?: string }>();
  allProtocolsFlat.forEach((protocol: Protocol & { sourceWallet?: string }) => {
    const key = `${protocol.name}-${protocol.chain}`;
    
    if (!uniqueProtocolsMap.has(key)) {
      uniqueProtocolsMap.set(key, protocol);
    } else {
      // If we have a duplicate, merge the positions and values
      const existing = uniqueProtocolsMap.get(key)!;
      existing.net_usd_value += protocol.net_usd_value;
      
      // Merge positions (deduplicate by position name + chain to avoid merging different positions)
      (protocol.positions || []).forEach((newPosition: any) => {
        const positionKey = `${newPosition.position_name}-${newPosition.chain || protocol.chain}`;
        const existingPosition = existing.positions.find(p => 
          `${p.position_name}-${p.chain || protocol.chain}` === positionKey
        );
        
        if (!existingPosition) {
          existing.positions = existing.positions || [];
          existing.positions.push(newPosition);
        } else {
          // Merge tokens and rewards in the position
          (newPosition.tokens || []).forEach((token: any) => {
            const existingToken = (existingPosition.tokens || []).find((t: any) => 
              t.symbol === token.symbol
            );
            if (!existingToken) {
              existingPosition.tokens = existingPosition.tokens || [];
              existingPosition.tokens.push(token);
            } else {
              existingToken.amount += token.amount;
              existingToken.usd_value += token.usd_value;
            }
          });
          
          (newPosition.rewards || []).forEach((reward: any) => {
            const existingReward = (existingPosition.rewards || []).find((r: any) => 
              r.symbol === reward.symbol
            );
            if (!existingReward) {
              existingPosition.rewards = existingPosition.rewards || [];
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
  
  const allProtocols: (Protocol & { sourceWallet?: string })[] = Array.from(uniqueProtocolsMap.values());




  // Generate position IDs for APY lookup using Debank position IDs
  const generatePositionId = (protocolName: string, positionName: string, walletAddress: string, debankPositionId?: string): string => {
    // Use Debank position ID if available, otherwise fall back to constructed ID
    return debankPositionId || `${protocolName}_${positionName}_${walletAddress}`.toLowerCase().replace(/\s+/g, '_');
  };

  // Create APY lookup map
  const apyLookup = new Map();
  if (positionAPYs?.success && positionAPYs.positions) {
    Object.entries(positionAPYs.positions).forEach(([positionId, apyData]) => {
      apyLookup.set(positionId, apyData);
    });
  }

  // Helper component to display APY data
  const APYDisplay = ({ protocolName, positionName, walletAddress }: { 
    protocolName: string, 
    positionName: string, 
    walletAddress: string
  }) => {
    const positionId = generatePositionId(protocolName, positionName, walletAddress);
    const apyData = apyLookup.get(positionId);

    if (!apyData) {
      return (
        <div className="text-xs text-gray-500 mt-1">
          APY: No data available
        </div>
      );
    }

    const periods = [
      { key: 'daily', label: '1D' },
      { key: 'weekly', label: '7D' },
      { key: 'monthly', label: '30D' }
    ];

    const hasAnyData = periods.some(period => 
      apyData[period.key] && apyData[period.key].rawAPY !== null
    );

    if (!hasAnyData) {
      return (
        <div className="text-xs text-gray-500 mt-1">
          APY: Calculating... (new position)
        </div>
      );
    }

    return (
      <div className="mt-2 space-y-1">
        <div className="flex items-center text-xs text-gray-400">
          <BarChart3 className="w-3 h-3 mr-1" />
          <span>APY Performance:</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {periods.map(period => {
            const periodData = apyData[period.key];
            const hasData = periodData && periodData.rawAPY !== null;
            const isPositive = hasData ? periodData.rawAPY >= 0 : null;
            const isNewPosition = periodData?.isNewPosition || false;
            
            return (
              <div key={period.key} className="text-xs">
                <span className="text-gray-500">{period.label}: </span>
                {hasData ? (
                  <div className="flex items-center">
                    <span className={`font-medium ${
                      isPositive ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {periodData.apy}
                      {isPositive ? (
                        <TrendingUp className="w-3 h-3 inline ml-1" />
                      ) : (
                        <TrendingDown className="w-3 h-3 inline ml-1" />
                      )}
                    </span>
                    {isNewPosition && period.key === 'daily' && (
                      <span className="text-blue-400 text-xs ml-1" title="Based on unclaimed rewards">*</span>
                    )}
                  </div>
                ) : (
                  <span className="text-gray-500">No data</span>
                )}
              </div>
            );
          })}
        </div>
        {apyData.daily?.isNewPosition && (
          <div className="text-xs text-blue-400 mt-1">
            * New position APY based on unclaimed rewards
          </div>
        )}
      </div>
    );
  };

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
        <p className="text-gray-600 dark:text-gray-400">Your current DeFi positions across all protocols</p>
      </div>

      {/* Protocol Positions Display */}
      <div className="space-y-6">
        {allProtocols.map((protocol) => {
          const totalPositionsValue = (protocol.positions || []).reduce((protocolSum, position) => {
            const positionTokensValue = (position.tokens || []).reduce((sum, token) => sum + (token.usd_value || 0), 0);
            const rewardTokensValue = (position.rewards || []).reduce((sum, reward) => sum + (reward.usd_value || 0), 0);
            return protocolSum + positionTokensValue + rewardTokensValue;
          }, 0);

          if (totalPositionsValue === 0) return null;

          return (
            <Card key={protocol.protocol_id}>
              <div className="space-y-6">
                {/* Protocol Header */}
                <div className="flex items-center justify-between border-b border-gray-700 pb-4">
                  <div>
                    <h2 className="text-xl font-bold text-white">{protocol.name}</h2>
                    <p className="text-sm text-gray-400">{protocol.chain} • {protocol.positions?.length || 0} positions</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-white">
                      ${totalPositionsValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-sm text-gray-400">Total Value</p>
                  </div>
                </div>

                {/* Positions */}
                <div className="space-y-4">
                  {protocol.positions?.map((position, posIdx) => {
                    const positionTokensValue = (position.tokens || []).reduce((sum, token) => sum + (token.usd_value || 0), 0);
                    const rewardTokensValue = (position.rewards || []).reduce((sum, reward) => sum + (reward.usd_value || 0), 0);
                    const totalPositionValue = positionTokensValue + rewardTokensValue;

                    if (totalPositionValue === 0) return null;

                    return (
                      <div key={posIdx} className="bg-gray-800 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h3 className="text-lg font-semibold text-white">{position.position_name}</h3>
                            <p className="text-sm text-gray-400">{position.chain || protocol.chain}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-bold text-white">
                              ${totalPositionValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </p>
                            {/* APY Display for Position */}
                            <APYDisplay 
                              protocolName={protocol.name}
                              positionName={position.position_name}
                              walletAddress={protocol.sourceWallet || 'unknown'}
                            />
                          </div>
                        </div>

                        {/* Position Tokens */}
                        {position.tokens && position.tokens.length > 0 && (
                          <div className="mb-4">
                            <h4 className="text-sm font-medium text-gray-300 mb-2">Tokens ({positionTokensValue.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })})</h4>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-gray-400 border-b border-gray-700">
                                    {tokensColumns.map(col => (
                                      <th key={col.key} className={`text-${col.align} py-2 ${col.className}`}>
                                        {col.label}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {position.tokens.map((token, tokenIdx: number) => (
                                    <tr key={tokenIdx} className="border-b border-gray-800 hover:bg-gray-700/50">
                                      <td className="py-2 text-left text-gray-300">{position.chain || protocol.chain}</td>
                                      <td className="py-2 text-left text-white font-medium">{token.symbol}</td>
                                      <td className="py-2 text-left text-gray-300">{token.symbol}</td>
                                      <td className="py-2 text-right text-white">{token.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                                      <td className="py-2 text-right text-gray-300">$N/A</td>
                                      <td className="py-2 text-right text-white font-medium">${token.usd_value?.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Position Rewards */}
                        {position.rewards && position.rewards.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-300 mb-2">Rewards ({rewardTokensValue.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })})</h4>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-gray-400 border-b border-gray-700">
                                    {positionsColumns.map(col => (
                                      <th key={col.key} className={`text-${col.align} py-2 ${col.className}`}>
                                        {col.label}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {position.rewards.map((reward, rewardIdx: number) => (
                                    <tr key={rewardIdx} className="border-b border-gray-800 hover:bg-gray-700/50">
                                      <td className="py-2 text-left text-white font-medium">{reward.symbol}</td>
                                      <td className="py-2 text-left text-gray-300">{reward.symbol}</td>
                                      <td className="py-2 text-right text-white">{reward.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                                      <td className="py-2 text-right text-gray-300">$N/A</td>
                                      <td className="py-2 text-right text-white font-medium">${reward.usd_value?.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          );
        })}

        {allProtocols.length === 0 && (
          <Card>
            <div className="text-center py-12">
              <BarChart3 className="w-16 h-16 mx-auto text-gray-500 mb-4" />
              <h3 className="text-xl font-semibold text-gray-400 mb-2">No Positions Found</h3>
              <p className="text-gray-500">
                Connect wallets with DeFi positions to see them here.
              </p>
            </div>
          </Card>
        )}
      </div>


    </div>
  );
};

export default Positions;