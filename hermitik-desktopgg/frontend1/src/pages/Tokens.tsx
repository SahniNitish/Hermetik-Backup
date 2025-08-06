import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { walletApi } from '../services/api';
import { Search, Filter, ArrowUpDown } from 'lucide-react';
import Card from '../components/UI/Card';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import AdminViewBanner from '../components/Admin/AdminViewBanner';
import { useUserView } from '../contexts/UserViewContext';
import { Token } from '../types';

const Tokens: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedChain, setSelectedChain] = useState('all');
  const [sortBy, setSortBy] = useState<'value' | 'name' | 'amount'>('value');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const { viewedUser } = useUserView();

  const { data: wallets, isLoading, error } = useQuery({
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
        <p className="text-red-400">Error loading token data</p>
      </div>
    );
  }

  if (!wallets || wallets.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">No tokens found. Add a wallet to see your holdings.</p>
      </div>
    );
  }

  // Flatten all tokens from all wallets and filter out tokens with 0 value
  const allTokens: Token[] = wallets.flatMap(wallet => wallet.tokens).filter(token => token.usd_value > 0);
  const totalPortfolioValue = allTokens.reduce((sum, token) => sum + token.usd_value, 0);

  // Add percentage of portfolio to each token
  const tokensWithPercentage = allTokens.map(token => ({
    ...token,
    percentage_of_portfolio: (token.usd_value / totalPortfolioValue) * 100
  }));

  // Get unique chains for filter
  const chains = Array.from(new Set(allTokens.map(token => token.chain)));

  // Filter tokens
  const filteredTokens = tokensWithPercentage.filter(token => {
    const matchesSearch = token.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         token.symbol.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesChain = selectedChain === 'all' || token.chain === selectedChain;
    return matchesSearch && matchesChain;
  });

  // Sort tokens
  const sortedTokens = [...filteredTokens].sort((a, b) => {
    let aValue, bValue;
    
    switch (sortBy) {
      case 'value':
        aValue = a.usd_value;
        bValue = b.usd_value;
        break;
      case 'name':
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
        break;
      case 'amount':
        aValue = a.amount;
        bValue = b.amount;
        break;
      default:
        aValue = a.usd_value;
        bValue = b.usd_value;
    }

    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  const handleSort = (field: 'value' | 'name' | 'amount') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  return (
    <div className="space-y-6">
      <AdminViewBanner />
      
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Token Holdings</h1>
        <p className="text-gray-400">Manage and track your token portfolio across all chains</p>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search tokens..."
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

      {/* Tokens Table */}
      <Card padding="sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left py-3 px-4 text-gray-400 font-medium">Token</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium">Chain</th>
                <th 
                  className="text-right py-3 px-4 text-gray-400 font-medium cursor-pointer hover:text-white"
                  onClick={() => handleSort('amount')}
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>Amount</span>
                    <ArrowUpDown className="w-4 h-4" />
                  </div>
                </th>
                <th className="text-right py-3 px-4 text-gray-400 font-medium">Price</th>
                <th 
                  className="text-right py-3 px-4 text-gray-400 font-medium cursor-pointer hover:text-white"
                  onClick={() => handleSort('value')}
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>Value</span>
                    <ArrowUpDown className="w-4 h-4" />
                  </div>
                </th>
                <th className="text-right py-3 px-4 text-gray-400 font-medium">% of Portfolio</th>
              </tr>
            </thead>
            <tbody>
              {sortedTokens.map((token, index) => (
                <tr key={`${token.symbol}-${index}`} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="py-4 px-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center">
                        <span className="text-white font-medium text-sm">
                          {token.symbol.slice(0, 2)}
                        </span>
                      </div>
                      <div>
                        <p className="text-white font-medium">{token.symbol}</p>
                        <p className="text-gray-400 text-sm">{token.name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span className="px-2 py-1 bg-blue-900/50 text-blue-300 rounded-full text-xs">
                      {token.chain}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right text-white">
                    {token.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                  </td>
                  <td className="py-4 px-4 text-right text-white">
                    ${token.price.toLocaleString()}
                  </td>
                  <td className="py-4 px-4 text-right text-white font-medium">
                    ${token.usd_value.toLocaleString()}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <span className="text-white">
                        {token.percentage_of_portfolio?.toFixed(2)}%
                      </span>
                      <div className="w-12 h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${Math.min(token.percentage_of_portfolio || 0, 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Summary */}
      <Card>
        <div className="flex justify-between items-center">
          <div>
            <p className="text-gray-400">Total Token Value</p>
            <p className="text-2xl font-bold text-white">${totalPortfolioValue.toLocaleString()}</p>
          </div>
          <div className="text-right">
            <p className="text-gray-400">Tokens Tracked</p>
            <p className="text-2xl font-bold text-white">{filteredTokens.length}</p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Tokens;