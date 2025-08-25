import React, { useState } from 'react';
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
  // Remove time period selector - using consecutive day APY calculation

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
  const { data: positionAPYs, isLoading: apyLoading, error: apyError } = useQuery({
    queryKey: ['positionAPYs', viewedUser?.id],
    queryFn: async () => {
      console.log('🔥 FRONTEND: Starting APY fetch...');
      console.log('🔥 Wallets available:', !!wallets, 'Count:', wallets?.length || 0);
      
      try {
        // Use the analytics API service instead of direct fetch
        const { analyticsApi } = await import('../services/api');
        const data = await analyticsApi.getPositionAPYs(1, viewedUser?.id);
        console.log('🔥 FRONTEND: APY data received:', data);
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

  // Debug APY query status
  console.log('🔥 FRONTEND: APY Query Status:', {
    apyLoading,
    apyError: apyError?.message,
    positionAPYs: positionAPYs ? 'HAS_DATA' : 'NO_DATA',
    wallets: wallets?.length || 0,
    hasToken: !!localStorage.getItem('access_token')
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




  // Generate position IDs for APY lookup - match backend format
  const generatePositionId = (protocolName: string, chain: string): string => {
    // Match the backend APY service format: protocol_chain_id
    const protocol = protocolName.toLowerCase().replace(/\s+/g, '_');
    const chainName = chain.toLowerCase();
    return `${protocol}_${chainName}_${protocol}`;
  };

  // Create APY lookup map
  const apyLookup = new Map();
  if (positionAPYs?.success && positionAPYs.data?.positions) {
    console.log('🔥 FRONTEND: Creating APY lookup map...');
    console.log('🔥 FRONTEND: Available APY position IDs:', Object.keys(positionAPYs.data.positions));
    Object.entries(positionAPYs.data.positions).forEach(([positionId, apyData]) => {
      console.log(`🔥 FRONTEND: Adding to lookup: ${positionId}`, apyData);
      apyLookup.set(positionId, apyData);
    });
    console.log('🔥 FRONTEND: APY lookup map size:', apyLookup.size);
  } else {
    console.log('🔥 FRONTEND: No APY data available for lookup:', {
      hasPositionAPYs: !!positionAPYs,
      success: positionAPYs?.success,
      hasPositions: !!positionAPYs?.data?.positions
    });
  }

  // Enhanced APY color coding logic based on comprehensive guide
  const getAPYColor = (apy: number | null, confidence: string = 'medium') => {
    if (apy === null || apy === undefined) return 'text-gray-500';
    
    // Confidence-based color intensity
    const confidenceModifier = confidence === 'high' ? '' : confidence === 'medium' ? '-400' : '-500';
    
    if (apy >= 15) return `text-green-300${confidenceModifier}`; // Excellent (15%+)
    if (apy >= 10) return `text-green-400${confidenceModifier}`; // Very Good (10-15%)
    if (apy >= 5) return `text-green-500${confidenceModifier}`;  // Good (5-10%)
    if (apy >= 1) return `text-blue-400${confidenceModifier}`;   // Moderate (1-5%)
    if (apy >= 0) return `text-yellow-400${confidenceModifier}`; // Break-even (0-1%)
    if (apy >= -5) return `text-orange-400${confidenceModifier}`; // Small Loss (0 to -5%)
    return `text-red-400${confidenceModifier}`;                   // Significant Loss (-5%+)
  };

  // Enhanced APY formatting logic
  const formatAPY = (apy: number | null, isNewPosition: boolean = false) => {
    if (apy === null || apy === undefined) return 'Calculating...';
    
    const prefix = apy >= 0 ? '+' : '';
    const formattedValue = `${prefix}${apy.toFixed(2)}%`;
    
    if (isNewPosition) {
      return `${formattedValue} (Est.)`;
    }
    
    return formattedValue;
  };

  // Get confidence badge color and text with Hermetik colors
  const getConfidenceBadge = (confidence: string = 'medium') => {
    switch (confidence) {
      case 'high':
        return { color: 'bg-hermetik-green/30 text-hermetik-gold border border-hermetik-green/50', text: 'HIGH' };
      case 'medium':
        return { color: 'bg-hermetik-gold/30 text-hermetik-green border border-hermetik-gold/50', text: 'MED' };
      case 'low':
        return { color: 'bg-red-900/30 text-red-400 border border-red-500/50', text: 'LOW' };
      case 'very_low':
        return { color: 'bg-red-800/30 text-red-300 border border-red-400/50', text: 'V.LOW' };
      default:
        return { color: 'bg-gray-900/30 text-gray-400 border border-gray-500/50', text: 'UNK' };
    }
  };

  // Helper component to display APY data in a separate dedicated box
  const APYDisplay = ({ protocolName, chain }: { 
    protocolName: string, 
    chain: string
  }) => {
    const positionId = generatePositionId(protocolName, chain);
    let apyData = apyLookup.get(positionId);
    
    // Fallback: try multiple position ID formats to match backend
    if (!apyData) {
      // Try the exact format we see in console: uniswap_v3_eth_base_uniswap3
      const fallbackId1 = `${protocolName.toLowerCase().replace(/\s+/g, '_')}_${chain.toLowerCase()}_base_${protocolName.toLowerCase().replace(/\s+/g, '_').replace('uniswap_v3', 'uniswap3')}`;
      apyData = apyLookup.get(fallbackId1);
      console.log(`🔄 APY FALLBACK 1: Trying ${fallbackId1}`, { found: !!apyData });
      
      if (!apyData) {
        // Try with original protocol name
        const fallbackId2 = `${protocolName.toLowerCase().replace(/\s+/g, '_')}_${chain.toLowerCase()}_base_${protocolName.toLowerCase().replace(/\s+/g, '_')}`;
        apyData = apyLookup.get(fallbackId2);
        console.log(`🔄 APY FALLBACK 2: Trying ${fallbackId2}`, { found: !!apyData });
      }
      
      if (!apyData) {
        // Try the format from test results
        const fallbackId3 = `${protocolName.toLowerCase().replace(/\s+/g, '_')}_${chain.toLowerCase()}_other__${protocolName.toLowerCase().replace(/\s+/g, '_').replace('uniswap_v3', 'uniswap3')}`;
        apyData = apyLookup.get(fallbackId3);
        console.log(`🔄 APY FALLBACK 3: Trying ${fallbackId3}`, { found: !!apyData });
      }
      
      if (!apyData) {
        // Try simpler format
        const fallbackId4 = `${protocolName.toLowerCase().replace(/\s+/g, '_')}_${chain.toLowerCase()}_${protocolName.toLowerCase().replace(/\s+/g, '_').replace('uniswap_v3', 'uniswap3')}`;
        apyData = apyLookup.get(fallbackId4);
        console.log(`🔄 APY FALLBACK 4: Trying ${fallbackId4}`, { found: !!apyData });
      }
    }
    
    console.log(`🔥 APY LOOKUP: ${protocolName} > ${chain}`, {
      protocolName,
      chain,
      generatedId: positionId,
      foundData: !!apyData,
      availableKeys: Array.from(apyLookup.keys())
    });

    if (!apyData) {
      return (
        <div className="bg-hermetik-secondary/50 border border-hermetik-green/20 rounded-lg p-4 mt-4">
          <div className="flex items-center justify-center text-gray-400">
            <BarChart3 className="w-4 h-4 mr-2 text-hermetik-gold/60" />
            <span className="text-sm font-heading">APY data not available</span>
          </div>
        </div>
      );
    }

    // New backend returns flat structure with single APY value
    const confidence = apyData.confidence || 'medium';
    const isNewPosition = apyData.isNewPosition || false;
    const apy = apyData.apy;
    const days = apyData.days || 1;

    return (
      <div className="bg-gradient-hermetik-subtle border border-hermetik-green/30 rounded-lg p-4 mt-4 card-hermetik">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center">
            <BarChart3 className="w-5 h-5 mr-2 text-hermetik-gold" />
            <h4 className="text-sm font-semibold text-white font-heading">APY Analysis</h4>
          </div>
          <div className="flex items-center space-x-2">
            <span className={`px-2 py-1 rounded text-xs font-medium ${getConfidenceBadge(confidence).color}`}>
              {getConfidenceBadge(confidence).text}
            </span>
            {isNewPosition && (
              <span className="bg-hermetik-green/30 text-hermetik-gold px-2 py-1 rounded text-xs font-medium" title="Based on unclaimed rewards">
                NEW
              </span>
            )}
          </div>
        </div>

        {/* Main APY Display */}
        <div className="text-center mb-4">
          <div className="flex items-center justify-center space-x-2">
            <span className={`text-3xl font-bold ${getAPYColor(apy, confidence)}`}>
              {formatAPY(apy, isNewPosition)}
            </span>
            {apy !== null && (
              apy >= 0 ? (
                <TrendingUp className={`w-6 h-6 ${getAPYColor(apy, confidence)}`} />
              ) : (
                <TrendingDown className={`w-6 h-6 ${getAPYColor(apy, confidence)}`} />
              )
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {days} day{days !== 1 ? 's' : ''} {apyData.calculationMethod?.includes('new_position') ? 'estimate' : 'average'}
          </p>
        </div>

        {/* Financial Breakdown */}
        <div className="bg-gray-800/50 rounded-lg p-3 space-y-2">
          <h5 className="text-xs font-medium text-gray-300 mb-2">Financial Breakdown</h5>
          
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Position Value:</span>
              <span className="text-white font-medium">
                {apyData.formattedValue || `$${apyData.currentValue?.toLocaleString()}`}
              </span>
            </div>
            
            {isNewPosition && apyData.unclaimedRewards && (
              <div className="flex justify-between">
                <span className="text-gray-400">Unclaimed Rewards:</span>
                <span className="text-green-400 font-medium">
                  ${apyData.unclaimedRewards.toLocaleString()}
                </span>
              </div>
            )}
            
            {!isNewPosition && apyData.valueChange !== undefined && (
              <div className="flex justify-between">
                <span className="text-gray-400">Value Change:</span>
                <span className={`font-medium ${apyData.valueChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {apyData.valueChange >= 0 ? '+' : ''}${apyData.valueChange.toLocaleString()}
                </span>
              </div>
            )}
            
            {!isNewPosition && apyData.yesterdayValue && (
              <div className="flex justify-between">
                <span className="text-gray-400">Previous Value:</span>
                <span className="text-gray-300">
                  ${apyData.yesterdayValue.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Calculation Details */}
        <div className="mt-3 pt-3 border-t border-gray-600">
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-400">
              Method: {apyData.calculationMethod?.replace(/_/g, ' ') || 'Standard calculation'}
            </span>
            <span className="text-gray-500">
              Confidence: {confidence.toUpperCase()}
            </span>
          </div>
          
          {isNewPosition && (
            <p className="text-xs text-blue-400 mt-2 italic">
              * Estimated from current rewards (1-day assumption)
            </p>
          )}
          
          {apyData.notes && (
            <p className="text-xs text-gray-500 mt-1">
              {apyData.notes}
            </p>
          )}
        </div>
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
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 font-heading">DeFi Positions</h1>
          <p className="text-gray-400">Your current DeFi positions across all protocols</p>
        </div>
        <p className="text-sm text-gray-500">APY calculations based on consecutive day analysis</p>
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
                            <p className="text-sm text-gray-400">Total Value</p>
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

                        {/* APY Analysis Section */}
                        <APYDisplay 
                          protocolName={protocol.name}
                          chain={position.chain || protocol.chain}
                        />
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