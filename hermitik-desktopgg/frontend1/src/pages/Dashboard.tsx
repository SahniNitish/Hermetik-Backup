import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { walletApi, analyticsApi } from '../services/api';
import { TrendingUp, TrendingDown, Wallet, DollarSign, Download, BarChart3, Activity, Target, ArrowUpDown } from 'lucide-react';
import { useUserView } from '../contexts/UserViewContext';
import { useNAV } from '../contexts/NAVContext';
import Card from '../components/UI/Card';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import AdminViewBanner from '../components/Admin/AdminViewBanner';
import Button from '../components/UI/Button';

const Dashboard: React.FC = () => {
  console.log('Dashboard: Component rendering');
  
  const { viewedUser, isViewingAsAdmin } = useUserView();
  const { navData } = useNAV();
  const queryClient = useQueryClient();
  const [exportingNav, setExportingNav] = useState(false);
  const [error, setError] = useState('');
  // Remove time period selector - using consecutive day APY calculation
  
  console.log('🔍 Dashboard: viewedUser:', viewedUser);
  console.log('🔍 Dashboard: isViewingAsAdmin:', isViewingAsAdmin);
  
  const { data: wallets, isLoading, error: queryError } = useQuery({
    queryKey: ['wallets', viewedUser?.id],
    queryFn: () => {
      // If admin is viewing as a user, fetch that user's wallets
      if (viewedUser) {
        return walletApi.getUserWallets(viewedUser.id);
      }
      return walletApi.getWallets();
    },
    refetchInterval: 30000,
  });

  // Fetch APY data for dashboard (uses shared API client so tokens/mocks are handled)
  const { data: positionAPYs, isLoading: apyLoading, error: apyError } = useQuery({
    queryKey: ['positionAPYs', viewedUser?.id],
    queryFn: async () => {
      try {
        // Pass viewedUser.id when admin is viewing another user's profile
        const data = await analyticsApi.getPositionAPYs(1, viewedUser?.id); // Use 1 day for consecutive calculation
        console.log('🔥 DASHBOARD: APY data received:', data);
        return data;
      } catch (error) {
        console.error('❌ Dashboard APYs error:', error);
        return null;
      }
    },
    enabled: !!wallets && (!!localStorage.getItem('access_token') || !!localStorage.getItem('mock_access_token') || import.meta.env.VITE_USE_MOCK_API !== 'false'),
    refetchInterval: 300000,
    staleTime: 240000
  });

  // Fetch real PnL data
  const { data: pnlData, isLoading: pnlLoading, error: pnlError } = useQuery({
    queryKey: ['pnlSinceLastReport'],
    queryFn: async () => {
      try {
        const data = await analyticsApi.getPnLSinceLastReport('daily');
        console.log('🔥 DASHBOARD: PnL data received:', data);
        return data;
      } catch (error) {
        console.error('❌ Dashboard PnL error:', error);
        return null;
      }
    },
    enabled: !!wallets && (!!localStorage.getItem('access_token') || !!localStorage.getItem('mock_access_token') || import.meta.env.VITE_USE_MOCK_API !== 'false'),
    refetchInterval: 300000,
    staleTime: 240000
  });

  console.log('Dashboard: Query state:', { wallets, isLoading, error: queryError });
  console.log('Dashboard: APY state:', { positionAPYs, apyLoading, apyError });
  console.log('Dashboard: PnL state:', { pnlData, pnlLoading, pnlError });
  console.log('Dashboard: NAV state:', { navData, navLoading: false, navError: null });
  console.log('🔥 DASHBOARD: Full APY object:', JSON.stringify(positionAPYs, null, 2));
  console.log('🔥 DASHBOARD: Full PnL object:', JSON.stringify(pnlData, null, 2));
  console.log('🔥 DASHBOARD: APY success?', positionAPYs?.success);
  console.log('🔥 DASHBOARD: APY positions?', positionAPYs?.data?.positions);
  console.log('🔥 DASHBOARD: APY positions keys:', positionAPYs?.data?.positions ? Object.keys(positionAPYs.data.positions) : 'NO POSITIONS');
  console.log('🔥 DASHBOARD: APY calculation method:', positionAPYs?.data?.positions ? Object.values(positionAPYs.data.positions)[0]?.calculationMethod : 'N/A');

  if (isLoading || apyLoading || pnlLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
        <p className="text-white ml-4">
          {(isLoading && apyLoading && pnlLoading) ? 'Loading portfolio, APY, and PnL data...' :
           (isLoading && apyLoading) ? 'Loading portfolio and APY data...' :
           (isLoading && pnlLoading) ? 'Loading portfolio and PnL data...' :
           (apyLoading && pnlLoading) ? 'Loading APY and PnL data...' :
           isLoading ? 'Loading wallet data...' : 
           apyLoading ? 'Loading APY data...' : 'Loading PnL data...'}
        </p>
      </div>
    );
  }

  if (queryError) {
    console.error('Dashboard: Error state:', queryError);
    return (
      <div className="text-center py-12">
        <p className="text-red-400">Error loading portfolio data</p>
        <p className="text-sm text-gray-400 mt-2">
          {queryError instanceof Error ? queryError.message : 'Unknown error'}
        </p>
      </div>
    );
  }

  if (!wallets || wallets.length === 0) {
    return (
      <div className="text-center py-12">
        <Wallet className="w-16 h-16 text-gray-600 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">No wallets connected</h2>
        <p className="text-gray-400 mb-4">Add your first wallet to start tracking your portfolio</p>
      </div>
    );
  }

  const totalTokensValue = wallets.reduce((sum, wallet) => {
    const tokensValue = (wallet.tokens || []).reduce((tokenSum, token) => tokenSum + (token.usd_value || 0), 0);
    return sum + tokensValue;
  }, 0);
  
  // Calculate positions using EXACT same logic as Positions page
  // Step 1: Get all protocols from all wallets, flatten them
  const allProtocolsFlat: any[] = [];
  wallets.forEach((wallet: any) => {
    (wallet.protocols || []).forEach((protocol: any) => {
      allProtocolsFlat.push({ ...protocol, sourceWallet: wallet.address });
    });
  });

  // Step 2: Deduplicate protocols by protocol_id and chain (same as Positions page)
  const uniqueProtocolsMap = new Map<string, any>();
  allProtocolsFlat.forEach((protocol: any) => {
    const key = `${protocol.protocol_id}-${protocol.chain}`;
    if (!uniqueProtocolsMap.has(key)) {
      uniqueProtocolsMap.set(key, { ...protocol });
    } else {
      // Merge positions from duplicate protocols
      const existing = uniqueProtocolsMap.get(key);
      (protocol.positions || []).forEach((newPosition: any) => {
        const positionKey = `${newPosition.position_name}-${newPosition.chain || protocol.chain}`;
        const existingPosition = (existing.positions || []).find((p: any) => 
          `${p.position_name}-${p.chain || protocol.chain}` === positionKey
        );
        
        if (!existingPosition) {
          existing.positions = existing.positions || [];
          existing.positions.push(newPosition);
        } else {
          // Merge tokens and rewards in the position
          (newPosition.tokens || []).forEach((token: any) => {
            const existingToken = existingPosition.tokens.find((t: any) => 
              t.symbol === token.symbol && t.chain === token.chain
            );
            if (!existingToken) {
              existingPosition.tokens.push(token);
            } else {
              existingToken.amount += token.amount;
              existingToken.usd_value += token.usd_value;
            }
          });
          
          (newPosition.rewards || []).forEach((reward: any) => {
            const existingReward = existingPosition.rewards.find((r: any) => 
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

  const allProtocols = Array.from(uniqueProtocolsMap.values());

  // Step 3: Calculate final positions value using hierarchical structure like Positions page
  const protocolPositions = allProtocols.map(protocol => {
    // Deduplicate tokens within this protocol
    const positionTokensMap = new Map<string, any>();
    const rewardTokensMap = new Map<string, any>();
    
    (protocol.positions || []).forEach((position: any) => {
      (position.tokens || []).forEach((token: any) => {
        const key = `${token.symbol}-${token.ticker}`;
        if (positionTokensMap.has(key)) {
          const existing = positionTokensMap.get(key);
          existing.amount += token.amount;
          existing.usd_value += token.usd_value;
        } else {
          positionTokensMap.set(key, { ...token });
        }
      });
      
      (position.rewards || []).forEach((reward: any) => {
        const key = `${reward.symbol}-${reward.ticker}`;
        if (rewardTokensMap.has(key)) {
          const existing = rewardTokensMap.get(key);
          existing.amount += reward.amount;
          existing.usd_value += reward.usd_value;
        } else {
          rewardTokensMap.set(key, { ...reward });
        }
      });
    });
    
    const positionNavValue = Array.from(positionTokensMap.values()).reduce((sum, token) => sum + token.usd_value, 0);
    const rewardNavValue = Array.from(rewardTokensMap.values()).reduce((sum, reward) => sum + reward.usd_value, 0);
    
    return {
      protocol: protocol,
      totalNavValue: positionNavValue + rewardNavValue
    };
  });

  // Step 4: Calculate final total from hierarchical structure (matches Positions page finalTotalPositionsValue)
  const totalPositionsValue = protocolPositions.reduce((sum, item) => sum + item.totalNavValue, 0);
  
  // Calculate totals - combine tokens and corrected positions
  const totalValue = totalTokensValue + totalPositionsValue;
  
  console.log('=== DASHBOARD NAV BREAKDOWN ===');
  console.log('Admin view status:', { isViewingAsAdmin, viewedUser });
  console.log('Export button should be visible:', isViewingAsAdmin && viewedUser);
  console.log('Wallets data:', wallets);
  wallets.forEach((wallet, index) => {
    const walletTokensValue = (wallet.tokens || []).reduce((sum, token) => sum + (token.usd_value || 0), 0);
    const walletPositionsValueOld = (wallet.protocols || []).reduce((sum, protocol) => sum + (protocol.net_usd_value || 0), 0);
    const walletPositionsValueNew = (wallet.protocols || []).reduce((protocolSum, protocol) => {
      const protocolValue = (protocol.positions || []).reduce((posSum, position) => {
        const positionTokensValue = (position.tokens || []).reduce((tokenSum, token) => tokenSum + (token.usd_value || 0), 0);
        const rewardTokensValue = (position.rewards || []).reduce((rewardSum, reward) => rewardSum + (reward.usd_value || 0), 0);
        return posSum + positionTokensValue + rewardTokensValue;
      }, 0);
      return protocolSum + protocolValue;
    }, 0);
    console.log(`Wallet ${index + 1} (${wallet.address}):`);
    console.log(`  - Backend totalValue: $${wallet.totalValue}`);
    console.log(`  - Calculated tokens: $${walletTokensValue}`);
    console.log(`  - Old positions (backend net_usd_value): $${walletPositionsValueOld}`);
    console.log(`  - New positions (from token data): $${walletPositionsValueNew}`);
  });
  console.log(`Total Tokens NAV: $${totalTokensValue.toLocaleString()}`);
  console.log(`Total Positions NAV: $${totalPositionsValue.toLocaleString()}`);
  console.log(`Total Portfolio NAV: $${totalValue.toLocaleString()}`);
  
  // Extract real PnL data or use fallback
  const pnlAmount = pnlData?.data?.pnlAmount || 0;
  const dailyReturn = pnlData?.data?.pnlPercentage || 0;
  const isPositive = dailyReturn >= 0;
  const previousValue = pnlData?.data?.previousValue || totalValue;
  const hasRealPnLData = pnlData?.data?.hasData || false;
  
  // Show meaningful message when no PnL data is available
  const pnlStatusMessage = !hasRealPnLData ? 
    (pnlData?.success === false ? 'No historical data' : 'Loading...') : 
    null;

  // Handle NAV export for admin viewing user's profile
  const handleNavExport = async () => {
    if (!isViewingAsAdmin || !viewedUser) {
      setError('Export failed: No user selected or insufficient permissions');
      return;
    }

    try {
      setExportingNav(true);
      setError('');
      
      // Safely access user properties with fallbacks
      const userIdSafe = viewedUser.id || 'unknown';
      const userNameSafe = viewedUser.name || 'Unknown User';
      
      console.log(`Admin exporting NAV for user: ${userNameSafe} (${userIdSafe})`);
      console.log('Export URL will be:', `/analytics/export/excel?userId=${userIdSafe}`);
      console.log('viewedUser object:', viewedUser);
      console.log('Current wallets data:', wallets);
      console.log('API Base URL:', import.meta.env.VITE_API_BASE_URL);
      console.log('Use Mock API:', import.meta.env.VITE_USE_MOCK_API);
      
      // Export current month by default
      const now = new Date();
      const currentMonth = now.getMonth(); // 0-based (0 = January)
      const currentYear = now.getFullYear();
      
      console.log(`Exporting monthly NAV for user: ${userNameSafe} (${userIdSafe}) for month: ${currentMonth + 1}/${currentYear}`);
      
      // Invalidate NAV settings cache to ensure we get the latest saved settings
      const queryClient = useQueryClient();
      queryClient.invalidateQueries(['nav-settings']);
      
      // Use the correct monthly NAV export function
      const blob = await analyticsApi.exportUserMonthlyNav(userIdSafe, currentMonth, currentYear);
      
      if (!blob || blob.size === 0) {
        throw new Error('Received empty report from server');
      }
      
      console.log('Blob details:', {
        size: blob.size,
        type: blob.type
      });
      
      // Check if blob contains HTML error instead of Excel
      if (blob.type === 'text/html' || blob.type.includes('text')) {
        const text = await blob.text();
        console.error('Backend returned HTML/text instead of Excel:', text);
        
        // Show more specific error message
        if (text.includes('Cannot find module')) {
          throw new Error('Backend missing Excel library dependencies');
        } else if (text.includes('500') || text.includes('Internal Server Error')) {
          throw new Error('Backend analytics.js crashed - check server logs');
        } else if (text.includes('404') || text.includes('Not Found')) {
          throw new Error('Backend analytics endpoint not found');
        } else {
          throw new Error(`Backend error: ${text.substring(0, 200)}...`);
        }
      }
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Safely create filename with null checks
      const userName = (viewedUser && viewedUser.name) ? viewedUser.name.toString().replace(/\s+/g, '_') : 'User';
      const filename = `${userName}_Monthly_NAV_Report_${currentYear}_${String(currentMonth + 1).padStart(2, '0')}.xlsx`;
      link.download = filename;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 100);
      
      console.log(`NAV report exported successfully: ${filename}`);
      
    } catch (err: any) {
      console.error('Error exporting NAV report:', err);
      console.error('Error response:', err?.response);
      console.error('Error response data:', err?.response?.data);
      console.error('Error response status:', err?.response?.status);
      console.error('Error response headers:', err?.response?.headers);
      
      let errorMessage = 'Unknown error occurred';
      if (err?.response?.status === 404) {
        errorMessage = `User data not found. User might not have any portfolio snapshots yet.`;
      } else if (err?.response?.status === 403) {
        errorMessage = `Permission denied. Admin access required.`;
      } else if (err?.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err?.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err?.message) {
        errorMessage = err.message;
      }
      
      setError(`Failed to export NAV report: ${errorMessage}`);
    } finally {
      setExportingNav(false);
    }
  };


  return (
    <div className="space-y-6">
      <AdminViewBanner />

      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white font-heading">
          {isViewingAsAdmin && viewedUser ? `${viewedUser.name}'s Portfolio` : 'Portfolio Overview'}
        </h1>
        <div className="flex items-center space-x-4">
          {/* Admin NAV Export Button - only show when admin is viewing user's profile */}
          {isViewingAsAdmin && viewedUser && (
            <Button
              onClick={handleNavExport}
              disabled={exportingNav}
              variant="secondary"
              className="btn-primary"
            >
              <Download className="w-4 h-4 mr-2" />
              {exportingNav ? 'Exporting...' : 'Export NAV Report'}
            </Button>
          )}
          <div className="text-sm text-gray-400">
            Last updated: {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-900/50 border border-red-500 rounded-lg p-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Hermetik Metrics Section */}
      <div className="space-y-6">
        {/* Primary NAV Display */}
        <div className="bg-gradient-hermetik rounded-lg p-6 text-center">
          <h2 className="text-xl font-heading font-semibold text-white mb-2">Current Value</h2>
          <p className="text-4xl font-bold text-white">
            ${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          <p className="text-sm text-white/80 mt-2">
            Last updated: {new Date().toLocaleTimeString()}
          </p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* PNL Since Last Report */}
          <div className="card-hermetik p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 font-heading">
                  PNL Since Last Report
                </p>
                {pnlStatusMessage ? (
                  <div className="mt-1">
                    <p className="text-lg text-gray-500">{pnlStatusMessage}</p>
                    <p className="text-xs text-gray-600">Need portfolio snapshots</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center space-x-2 mt-1">
                      <p className={`text-xl font-bold ${isPositive ? 'text-hermetik-gold' : 'text-red-400'}`}>
                        {isPositive ? '+' : ''}${Math.abs(pnlAmount).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </p>
                      {isPositive ? (
                        <TrendingUp className="w-4 h-4 text-hermetik-gold" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-400" />
                      )}
                    </div>
                    <p className={`text-xs ${isPositive ? 'text-hermetik-gold' : 'text-red-400'}`}>
                      {isPositive ? '+' : ''}{dailyReturn.toFixed(2)}%
                    </p>
                    {hasRealPnLData && pnlData?.data?.previousDate && (
                      <p className="text-xs text-gray-500 mt-1">
                        Since {new Date(pnlData.data.previousDate).toLocaleDateString()}
                      </p>
                    )}
                    {!hasRealPnLData && (
                      <p className="text-xs text-gray-500 mt-1">(No snapshots available)</p>
                    )}
                  </>
                )}
              </div>
              <BarChart3 className="w-8 h-8 text-hermetik-green" />
            </div>
          </div>

          {/* Annualized Volatility */}
          <div className="card-hermetik p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 font-heading">Annualized Volatility</p>
                <p className="text-xl font-bold text-white">
                  {(Math.abs(dailyReturn) * Math.sqrt(365)).toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500">30-day rolling</p>
              </div>
              <Activity className="w-8 h-8 text-hermetik-gold" />
            </div>
          </div>

          {/* Last NAV */}
          <div className="card-hermetik p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 font-heading">Last NAV</p>
                <p className="text-xl font-bold text-white">
                  ${previousValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-gray-500">
                  {hasRealPnLData ? 'Previous report' : 'Calculated'}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-hermetik-green" />
            </div>
          </div>

          {/* Benchmark */}
          <div className="card-hermetik p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 font-heading">Benchmark</p>
                <p className="text-xl font-bold text-hermetik-gold">+8.2%</p>
                <p className="text-xs text-gray-500">Manual input</p>
              </div>
              <Target className="w-8 h-8 text-hermetik-gold" />
            </div>
          </div>

          {/* Net Flows This Month */}
          <div className="card-hermetik p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 font-heading">Net Flows This Month</p>
                <p className={`text-xl font-bold ${navData.totalNetFlows >= 0 ? 'text-hermetik-green' : 'text-red-400'}`}>
                  {navData.totalNetFlows >= 0 ? '+' : ''}${navData.totalNetFlows.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-gray-500">
                  {navData.totalNetFlows ? 'From NAV Calculator' : 'Set in NAV Calculator'}
                </p>
              </div>
              <ArrowUpDown className={`w-8 h-8 ${navData.totalNetFlows >= 0 ? 'text-hermetik-green' : 'text-red-400'}`} />
            </div>
          </div>

          {/* Token Value */}
          <div className="card-hermetik p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 font-heading">Token Value</p>
                <p className="text-xl font-bold text-hermetik-gold">
                  ${totalTokensValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-gray-500">
                  {((totalTokensValue / totalValue) * 100).toFixed(1)}% of portfolio
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-hermetik-gold" />
            </div>
          </div>

          {/* Current Value */}
          <div className="card-hermetik p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 font-heading">Current Value</p>
                <p className="text-xl font-bold text-hermetik-green">
                  ${totalPositionsValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-gray-500">
                  {((totalPositionsValue / totalValue) * 100).toFixed(1)}% of portfolio
                </p>
              </div>
              <BarChart3 className="w-8 h-8 text-hermetik-green" />
            </div>
          </div>

          {/* Total Wallets */}
          <div className="card-hermetik p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 font-heading">Connected Wallets</p>
                <p className="text-xl font-bold text-white">{wallets.length}</p>
                <p className="text-xs text-gray-500">Active connections</p>
              </div>
              <Wallet className="w-8 h-8 text-hermetik-gold" />
            </div>
          </div>

          {/* APY Analysis Header */}
          <div className="col-span-full mb-4">
            <h3 className="text-lg font-semibold text-white">APY Analysis</h3>
            <p className="text-sm text-gray-400">Based on consecutive day calculations</p>
          </div>

          {/* Average APY */}
          <div className="card-hermetik p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 font-heading">Average APY</p>
                {apyLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-hermetik-gold"></div>
                    <p className="text-sm text-gray-400">Loading...</p>
                  </div>
                ) : positionAPYs?.success && positionAPYs.data?.positions ? (
                  <>
                    <p className="text-xl font-bold text-hermetik-gold">
                      {(() => {
                        const apyValues = Object.values(positionAPYs.data.positions)
                          .filter((apy: any) => apy.apy !== null && apy.apy !== undefined)
                          .map((apy: any) => apy.apy);
                        const avgApy = apyValues.length > 0 
                          ? apyValues.reduce((sum: number, apy: number) => sum + apy, 0) / apyValues.length 
                          : 0;
                        return avgApy >= 0 ? `+${avgApy.toFixed(2)}%` : `${avgApy.toFixed(2)}%`;
                      })()}
                    </p>
                    <p className="text-xs text-gray-500">
                      {Object.keys(positionAPYs.data.positions).length} positions
                    </p>
                    <p className="text-xs text-blue-400">
                      {(() => {
                        const positions = Object.values(positionAPYs.data.positions);
                        const hasValidApy = positions.some((pos: any) => pos.apy > 0);
                        return hasValidApy ? '✅ APY calculated' : '⚠️ No historical data';
                      })()}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-xl font-bold text-gray-500">--</p>
                    <p className="text-xs text-gray-500">No data available</p>
                  </>
                )}
              </div>
              <BarChart3 className="w-8 h-8 text-hermetik-gold" />
            </div>
          </div>
        </div>
      </div>



      {/* Wallets Overview */}
      <Card>
        <h2 className="text-xl font-semibold text-white mb-6">Wallets</h2>
        <div className="space-y-4">
          {wallets.map((wallet) => (
            <div
              key={wallet.id}
              className="flex items-center justify-between p-4 bg-gray-800 rounded-lg"
            >
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-medium text-white">{wallet.name}</p>
                  <p className="text-sm text-gray-400">{wallet.address}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-white">
                  ${wallet.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
                <p className="text-sm text-gray-400">
                  {wallet.tokens?.length || 0} tokens
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default Dashboard;