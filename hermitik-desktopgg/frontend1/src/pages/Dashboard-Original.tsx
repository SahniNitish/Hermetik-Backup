import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { walletApi } from '../services/api';
import { TrendingUp, TrendingDown, Wallet, DollarSign } from 'lucide-react';
import Card from '../components/UI/Card';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const Dashboard: React.FC = () => {
  console.log('Dashboard: Component rendering');
  
  const { data: wallets, isLoading, error } = useQuery({
    queryKey: ['wallets'],
    queryFn: walletApi.getWallets,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  console.log('Dashboard: Query state:', { wallets, isLoading, error });

  if (isLoading) {
    console.log('Dashboard: Showing loading state');
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
        <p className="text-white ml-4">Loading wallet data...</p>
      </div>
    );
  }

  if (error) {
    console.error('Dashboard: Error state:', error);
    return (
      <div className="text-center py-12">
        <p className="text-red-400">Error loading portfolio data: {error.message}</p>
        <pre className="text-xs text-gray-400 mt-4">{JSON.stringify(error, null, 2)}</pre>
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

  // Calculate totals across all wallets
  const totalValue = wallets.reduce((sum, wallet) => sum + (wallet.totalValue || 0), 0);
  const totalTokens = wallets.reduce((sum, wallet) => sum + (wallet.totalValue || 0), 0); // Using totalValue as placeholder
  const totalProtocols = 0; // Will be calculated from protocols when needed

  // Mock daily return data - in real implementation, this would come from the API
  const dailyReturn = 2.34;
  const isPositive = dailyReturn >= 0;

  // Mock chart data
  const chartData = Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    value: totalValue * (0.95 + Math.random() * 0.1),
  }));

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Portfolio Dashboard</h1>
        <p className="text-gray-400">Overview of your DeFi portfolio performance</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 border-blue-700/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-300 text-sm font-medium">Total Portfolio Value</p>
              <p className="text-2xl font-bold text-white">${totalValue.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-blue-600 rounded-lg">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-green-900/50 to-green-800/30 border-green-700/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-300 text-sm font-medium">Tokens Value</p>
              <p className="text-2xl font-bold text-white">${totalTokens.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-green-600 rounded-lg">
              <Wallet className="w-6 h-6 text-white" />
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 border-purple-700/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-300 text-sm font-medium">DeFi Positions</p>
              <p className="text-2xl font-bold text-white">${totalProtocols.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-purple-600 rounded-lg">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
          </div>
        </Card>

        <Card className={`bg-gradient-to-br ${isPositive ? 'from-green-900/50 to-green-800/30 border-green-700/50' : 'from-red-900/50 to-red-800/30 border-red-700/50'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium ${isPositive ? 'text-green-300' : 'text-red-300'}`}>Daily Return</p>
              <p className="text-2xl font-bold text-white">{isPositive ? '+' : ''}{dailyReturn}%</p>
            </div>
            <div className={`p-3 rounded-lg ${isPositive ? 'bg-green-600' : 'bg-red-600'}`}>
              {isPositive ? <TrendingUp className="w-6 h-6 text-white" /> : <TrendingDown className="w-6 h-6 text-white" />}
            </div>
          </div>
        </Card>
      </div>

      {/* Portfolio Chart */}
      <Card>
        <h2 className="text-xl font-semibold text-white mb-6">Portfolio Performance</h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip 
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#F3F4F6'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="#3B82F6" 
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Top Holdings */}
      <Card>
        <h2 className="text-xl font-semibold text-white mb-6">Top Holdings</h2>
        <div className="space-y-4">
          {wallets.slice(0, 3).map((wallet) => (
            <div key={wallet.address} className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-medium text-sm">
                    {wallet.address.slice(2, 4).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-white font-medium">{wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}</p>
                  <p className="text-gray-400 text-sm">{wallet.tokens.length} tokens</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-white font-medium">${wallet.summary.total_usd_value.toLocaleString()}</p>
                <p className="text-gray-400 text-sm">
                  {((wallet.summary.total_usd_value / totalValue) * 100).toFixed(1)}% of total
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