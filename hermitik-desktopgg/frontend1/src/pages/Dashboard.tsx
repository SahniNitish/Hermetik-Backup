import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { walletApi, analyticsApi } from '../services/api';
import { TrendingUp, TrendingDown, Wallet, DollarSign, Download } from 'lucide-react';
import { useUserView } from '../contexts/UserViewContext';
import Card from '../components/UI/Card';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import AdminViewBanner from '../components/Admin/AdminViewBanner';
import Button from '../components/UI/Button';

const Dashboard: React.FC = () => {
  console.log('Dashboard: Component rendering');
  
  const { viewedUser, isViewingAsAdmin } = useUserView();
  const [exportingNav, setExportingNav] = useState(false);
  const [error, setError] = useState('');
  
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

  console.log('Dashboard: Query state:', { wallets, isLoading, error: queryError });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
        <p className="text-white ml-4">Loading wallet data...</p>
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
  const allProtocolsFlat = [];
  wallets.forEach(wallet => {
    (wallet.protocols || []).forEach(protocol => {
      allProtocolsFlat.push({ ...protocol, sourceWallet: wallet.address });
    });
  });

  // Step 2: Deduplicate protocols by protocol_id and chain (same as Positions page)
  const uniqueProtocolsMap = new Map();
  allProtocolsFlat.forEach(protocol => {
    const key = `${protocol.protocol_id}-${protocol.chain}`;
    if (!uniqueProtocolsMap.has(key)) {
      uniqueProtocolsMap.set(key, { ...protocol });
    } else {
      // Merge positions from duplicate protocols
      const existing = uniqueProtocolsMap.get(key);
      (protocol.positions || []).forEach(newPosition => {
        const positionKey = `${newPosition.position_name}-${newPosition.chain || protocol.chain}`;
        const existingPosition = (existing.positions || []).find(p => 
          `${p.position_name}-${p.chain || protocol.chain}` === positionKey
        );
        
        if (!existingPosition) {
          existing.positions = existing.positions || [];
          existing.positions.push(newPosition);
        } else {
          // Merge tokens and rewards in the position
          (newPosition.tokens || []).forEach(token => {
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
          
          (newPosition.rewards || []).forEach(reward => {
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

  const allProtocols = Array.from(uniqueProtocolsMap.values());

  // Step 3: Calculate final positions value using hierarchical structure like Positions page
  const protocolPositions = allProtocols.map(protocol => {
    // Deduplicate tokens within this protocol
    const positionTokensMap = new Map();
    const rewardTokensMap = new Map();
    
    (protocol.positions || []).forEach(position => {
      (position.tokens || []).forEach(token => {
        const key = `${token.symbol}-${token.ticker}`;
        if (positionTokensMap.has(key)) {
          const existing = positionTokensMap.get(key);
          existing.amount += token.amount;
          existing.usd_value += token.usd_value;
        } else {
          positionTokensMap.set(key, { ...token });
        }
      });
      
      (position.rewards || []).forEach(reward => {
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
  
  const dailyReturn = 2.34; // Mock data
  const isPositive = dailyReturn >= 0;

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
      const userIdSafe = viewedUser.id || viewedUser._id || 'unknown';
      const userNameSafe = viewedUser.name || 'Unknown User';
      
      console.log(`Admin exporting NAV for user: ${userNameSafe} (${userIdSafe})`);
      console.log('Export URL will be:', `/analytics/export/excel?userId=${userIdSafe}`);
      console.log('viewedUser object:', viewedUser);
      console.log('Current wallets data:', wallets);
      console.log('API Base URL:', import.meta.env.VITE_API_BASE_URL);
      console.log('Use Mock API:', import.meta.env.VITE_USE_MOCK_API);
      
      // Try different export approaches
      let blob;
      try {
        console.log('Trying regular exportExcel (no userId)...');
        blob = await analyticsApi.exportExcel();
        console.log('Regular export worked! Blob size:', blob.size);
      } catch (regularError) {
        console.log('Regular export failed, trying user-specific...');
        console.error('Regular export error:', regularError);
        
        try {
          console.log('Trying exportUserExcel with userId:', userIdSafe);
          blob = await analyticsApi.exportUserExcel(userIdSafe);
        } catch (userError) {
          console.log('User Excel export failed, trying different ID format...');
          console.error('User Excel error:', userError);
          
          // Try different endpoints that might exist
          try {
            console.log('Trying /analytics/export endpoint...');
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/analytics/export?userId=${userIdSafe}`, {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`
              }
            });
            blob = await response.blob();
          } catch (exportError) {
            try {
              console.log('Trying /export/excel endpoint...');
              const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/export/excel?userId=${userIdSafe}`, {
                headers: {
                  'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                }
              });
              blob = await response.blob();
            } catch (finalError) {
              console.log('All export attempts failed');
              console.error('Final error:', finalError);
              throw new Error('No working export endpoint found. Backend needs /api/analytics/export/excel route.');
            }
          }
        }
      }
      
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
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `${userName}_NAV_Report_${dateStr}.xlsx`;
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
        <h1 className="text-3xl font-bold text-white">
          {isViewingAsAdmin && viewedUser ? `${viewedUser.name}'s Portfolio` : 'Portfolio Overview'}
        </h1>
        <div className="flex items-center space-x-4">
          {/* Admin NAV Export Button - only show when admin is viewing user's profile */}
          {isViewingAsAdmin && viewedUser && (
            <Button
              onClick={handleNavExport}
              disabled={exportingNav}
              variant="secondary"
              className="bg-purple-600 hover:bg-purple-700"
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

      {/* Portfolio Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total Portfolio Value</p>
              <p className="text-2xl font-bold text-white">
                ${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-blue-500" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Token NAV</p>
              <p className="text-2xl font-bold text-green-400">
                ${totalTokensValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-green-500" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Position NAV</p>
              <p className="text-2xl font-bold text-purple-400">
                ${totalPositionsValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-purple-500" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">24h Change</p>
              <div className="flex items-center space-x-1">
                <p className={`text-2xl font-bold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                  {isPositive ? '+' : ''}{dailyReturn.toFixed(2)}%
                </p>
                {isPositive ? (
                  <TrendingUp className="w-5 h-5 text-green-400" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-400" />
                )}
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total Wallets</p>
              <p className="text-2xl font-bold text-white">{wallets.length}</p>
            </div>
            <Wallet className="w-8 h-8 text-purple-500" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total Tokens</p>
              <p className="text-2xl font-bold text-white">
                {wallets.reduce((sum, wallet) => sum + (wallet.tokens?.length || 0), 0)}
              </p>
            </div>
          </div>
        </Card>
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