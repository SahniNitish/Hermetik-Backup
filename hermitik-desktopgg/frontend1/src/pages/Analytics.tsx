import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi, walletApi } from '../services/api';
import Card from '../components/UI/Card';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import AdminViewBanner from '../components/Admin/AdminViewBanner';
import { useUserView } from '../contexts/UserViewContext';
import { TrendingUp, TrendingDown, BarChart3, PieChart } from 'lucide-react';
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  Treemap
} from 'recharts';

const Analytics: React.FC = () => {
  const [selectedPeriod, setSelectedPeriod] = useState(30);

  // Color palette for charts
  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316'];

  const { viewedUser } = useUserView();

  // For now, let's use wallet data to show some analytics
  const { data: wallets, isLoading } = useQuery({
    queryKey: ['wallets', viewedUser?.id],
    queryFn: () => {
      // If admin is viewing as a user, fetch that user's wallets
      if (viewedUser) {
        return walletApi.getUserWallets(viewedUser.id);
      }
      return walletApi.getWallets();
    },
  });

  // Fetch historical portfolio data
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['portfolio-history', selectedPeriod],
    queryFn: () => analyticsApi.getPortfolioHistory(selectedPeriod),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
        <p className="text-white ml-4">Loading analytics...</p>
      </div>
    );
  }

  if (!wallets || wallets.length === 0) {
    return (
      <div className="text-center py-12">
        <BarChart3 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">No data available</h2>
        <p className="text-gray-400">Add wallets to see analytics</p>
      </div>
    );
  }

  const totalValue = wallets.reduce((sum, wallet) => sum + (wallet.totalValue || 0), 0);
  const totalTokens = wallets.reduce((sum, wallet) => sum + (wallet.tokens?.length || 0), 0);

  // Calculate chain distribution
  const chainDistribution: Record<string, number> = {};
  wallets.forEach(wallet => {
    if (wallet.chainDistribution) {
      Object.entries(wallet.chainDistribution).forEach(([chain, value]) => {
        chainDistribution[chain] = (chainDistribution[chain] || 0) + value;
      });
    }
  });

  // Calculate protocol distribution
  const protocolDistribution: Record<string, number> = {};
  wallets.forEach(wallet => {
    if (wallet.protocols) {
      wallet.protocols.forEach(protocol => {
        protocolDistribution[protocol.name] = (protocolDistribution[protocol.name] || 0) + protocol.net_usd_value;
      });
    }
  });

  // Prepare data for charts
  const chainChartData = Object.entries(chainDistribution).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
    percentage: ((value / totalValue) * 100).toFixed(1)
  }));

  const protocolChartData = Object.entries(protocolDistribution)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 8)
    .map(([name, value]) => ({
      name,
      value,
      percentage: ((value / totalValue) * 100).toFixed(1)
    }));

  // Token allocation data
  const tokenData = wallets.flatMap(wallet => 
    wallet.tokens?.map(token => ({
      name: token.symbol,
      value: token.usd_value,
      size: token.usd_value,
      percentage: ((token.usd_value / totalValue) * 100).toFixed(1)
    })) || []
  ).sort((a, b) => b.value - a.value).slice(0, 10);

  // Protocol performance data (APY and value)
  const protocolPerformanceData = wallets.flatMap(wallet => 
    wallet.protocols?.map(protocol => ({
      name: protocol.name,
      apy: protocol.daily_apy || 0,
      value: protocol.net_usd_value,
      chain: protocol.chain
    })) || []
  ).sort((a, b) => b.apy - a.apy).slice(0, 8);

  return (
    <div className="space-y-6">
      <AdminViewBanner />
      
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Analytics</h1>
        
        {/* Period Selector */}
        <div className="flex space-x-2">
          {[7, 30, 90].map((period) => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedPeriod === period
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {period}D
            </button>
          ))}
        </div>
      </div>

      {/* Portfolio Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total Portfolio Value</p>
              <p className="text-2xl font-bold text-white">
                ${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-500" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total Tokens</p>
              <p className="text-2xl font-bold text-white">{totalTokens}</p>
            </div>
            <PieChart className="w-8 h-8 text-blue-500" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Active Wallets</p>
              <p className="text-2xl font-bold text-white">{wallets.length}</p>
            </div>
            <BarChart3 className="w-8 h-8 text-purple-500" />
          </div>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chain Distribution Pie Chart */}
        <Card>
          <h2 className="text-xl font-semibold text-white mb-6">Chain Distribution</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Pie
                  data={chainChartData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percentage }) => `${name}: ${percentage}%`}
                >
                  {chainChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: any) => [`$${value.toLocaleString()}`, 'Value']}
                  labelFormatter={(label) => `Chain: ${label}`}
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: '1px solid #374151',
                    borderRadius: '0.5rem',
                    color: '#FFFFFF'
                  }}
                />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Protocol Distribution Pie Chart */}
        <Card>
          <h2 className="text-xl font-semibold text-white mb-6">Top Protocols</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Pie
                  data={protocolChartData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percentage }) => `${name}: ${percentage}%`}
                >
                  {protocolChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: any) => [`$${value.toLocaleString()}`, 'Value']}
                  labelFormatter={(label) => `Protocol: ${label}`}
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: '1px solid #374151',
                    borderRadius: '0.5rem',
                    color: '#FFFFFF'
                  }}
                />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Token Allocation Bar Chart */}
      <Card>
        <h2 className="text-xl font-semibold text-white mb-6">Top Token Holdings</h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={tokenData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="name" 
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF' }}
              />
              <YAxis 
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF' }}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
              />
              <Tooltip 
                formatter={(value: any) => [`$${value.toLocaleString()}`, 'Value']}
                labelFormatter={(label) => `Token: ${label}`}
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '0.5rem',
                  color: '#FFFFFF'
                }}
              />
              <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Historical Portfolio Performance */}
      <Card>
        <h2 className="text-xl font-semibold text-white mb-6">Portfolio Performance</h2>
        <div className="h-80">
          {historyLoading ? (
            <div className="flex items-center justify-center h-full">
              <LoadingSpinner size="md" />
              <p className="text-gray-400 ml-2">Loading history...</p>
            </div>
          ) : historyData && historyData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="date"
                  stroke="#9CA3AF"
                  tick={{ fill: '#9CA3AF' }}
                  tickFormatter={(value) => new Date(value).toLocaleDateString()}
                />
                <YAxis 
                  stroke="#9CA3AF"
                  tick={{ fill: '#9CA3AF' }}
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
                />
                <Tooltip 
                  formatter={(value: any) => [`$${value.toLocaleString()}`, 'Portfolio Value']}
                  labelFormatter={(label) => `Date: ${new Date(label).toLocaleDateString()}`}
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: '1px solid #374151',
                    borderRadius: '0.5rem',
                    color: '#FFFFFF'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#10B981" 
                  strokeWidth={2}
                  dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: '#10B981', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <TrendingUp className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No historical data available</p>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Protocol Performance Comparison */}
      <Card>
        <h2 className="text-xl font-semibold text-white mb-6">Protocol APY Performance</h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={protocolPerformanceData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="name" 
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF', fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis 
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF' }}
                tickFormatter={(value) => `${value.toFixed(1)}%`}
              />
              <Tooltip 
                formatter={(value: any, name: string) => {
                  if (name === 'apy') return [`${value.toFixed(2)}%`, 'Daily APY'];
                  return [`$${value.toLocaleString()}`, 'Value'];
                }}
                labelFormatter={(label) => `Protocol: ${label}`}
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '0.5rem',
                  color: '#FFFFFF'
                }}
              />
              <Bar dataKey="apy" fill="#10B981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Token Allocation Treemap */}
      <Card>
        <h2 className="text-xl font-semibold text-white mb-6">Token Allocation Breakdown</h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <Treemap
              data={tokenData}
              dataKey="size"
              nameKey="name"
              fill="#3B82F6"
              stroke="#1F2937"
              strokeWidth={2}
            >
              <Tooltip 
                formatter={(value: any) => [`$${value.toLocaleString()}`, 'Value']}
                labelFormatter={(label, payload) => {
                  const item = payload?.[0]?.payload;
                  return `${label} (${item?.percentage}%)`;
                }}
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '0.5rem',
                  color: '#FFFFFF'
                }}
              />
            </Treemap>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Wallet Performance */}
      <Card>
        <h2 className="text-xl font-semibold text-white mb-6">Wallet Performance</h2>
        <div className="space-y-4">
          {wallets.map((wallet) => (
            <div
              key={wallet.id}
              className="flex items-center justify-between p-4 bg-gray-800 rounded-lg"
            >
              <div>
                <p className="font-medium text-white">{wallet.name}</p>
                <p className="text-sm text-gray-400">{wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-white">
                  ${wallet.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
                <div className="flex items-center space-x-1">
                  <TrendingUp className="w-4 h-4 text-green-400" />
                  <p className="text-sm text-green-400">+2.3%</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

    </div>
  );
};

export default Analytics;