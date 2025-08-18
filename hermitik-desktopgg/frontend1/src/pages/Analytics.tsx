import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi, walletApi } from '../services/api';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import AdminViewBanner from '../components/Admin/AdminViewBanner';
import { useUserView } from '../contexts/UserViewContext';
import { TrendingUp, BarChart3, PieChart } from 'lucide-react';
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
  Line
} from 'recharts';

const Analytics: React.FC = () => {
  const [selectedPeriod, setSelectedPeriod] = useState(30);

  // Hermetik color palette for charts
  const COLORS = ['#00321d', '#B2A534', '#004d2e', '#c9b945', '#006b3a', '#d4c157', '#008147', '#e0cd6a'];

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

  // Calculate chain distribution (for future use)
  // const chainDistribution: Record<string, number> = {};
  // wallets.forEach(wallet => {
  //   if (wallet.chainDistribution) {
  //     Object.entries(wallet.chainDistribution).forEach(([chain, value]) => {
  //       chainDistribution[chain] = (chainDistribution[chain] || 0) + value;
  //     });
  //   }
  // });

  // Calculate protocol distribution
  const protocolDistribution: Record<string, number> = {};
  wallets.forEach(wallet => {
    if (wallet.protocols) {
      wallet.protocols.forEach(protocol => {
        protocolDistribution[protocol.name] = (protocolDistribution[protocol.name] || 0) + protocol.net_usd_value;
      });
    }
  });

  // Prepare data for charts (chain data commented out since we don't use it currently)
  // const chainChartData = Object.entries(chainDistribution).map(([name, value]) => ({
  //   name: name.charAt(0).toUpperCase() + name.slice(1),
  //   value,
  //   percentage: ((value / totalValue) * 100).toFixed(1)
  // }));

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
        <h1 className="text-3xl font-bold text-white font-heading">Analytics</h1>
        
        {/* Period Selector */}
        <div className="flex space-x-2">
          {[7, 30, 90].map((period) => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedPeriod === period
                  ? 'bg-hermetik-green text-white'
                  : 'bg-hermetik-secondary text-gray-400 hover:bg-hermetik-green/20'
              }`}
            >
              {period}D
            </button>
          ))}
        </div>
      </div>

      {/* Portfolio Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card-hermetik p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400 font-heading">Total Tokens</p>
              <p className="text-2xl font-bold text-white">{totalTokens}</p>
            </div>
            <PieChart className="w-8 h-8 text-hermetik-gold" />
          </div>
        </div>

        <div className="card-hermetik p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400 font-heading">Active Wallets</p>
              <p className="text-2xl font-bold text-white">{wallets.length}</p>
            </div>
            <BarChart3 className="w-8 h-8 text-hermetik-green" />
          </div>
        </div>
      </div>

      {/* Analytics Charts - Hermetik Specification */}
      <div className="space-y-6">
        {/* APY Breakdown by Position with Timeframe */}
        <div className="card-hermetik p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white font-heading">APY Breakdown by Position</h2>
            <div className="flex space-x-2">
              {['1D', '7D', '30D'].map((timeframe) => (
                <button
                  key={timeframe}
                  className="px-3 py-1 rounded text-xs font-medium bg-hermetik-green/20 text-hermetik-gold hover:bg-hermetik-green/30 transition-colors"
                >
                  {timeframe}
                </button>
              ))}
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={protocolPerformanceData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333333" />
                <XAxis 
                  dataKey="name" 
                  stroke="#B2A534"
                  tick={{ fill: '#B2A534', fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis 
                  stroke="#B2A534"
                  tick={{ fill: '#B2A534' }}
                  tickFormatter={(value) => `${value.toFixed(1)}%`}
                />
                <Tooltip 
                  formatter={(value: any) => [`${value.toFixed(2)}%`, 'APY']}
                  labelFormatter={(label) => `Position: ${label}`}
                  contentStyle={{
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #00321d',
                    borderRadius: '0.5rem',
                    color: '#FFFFFF'
                  }}
                />
                <Bar 
                  dataKey="apy" 
                  fill="#00321d" 
                  radius={[4, 4, 0, 0]}
                  stroke="#B2A534"
                  strokeWidth={1}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Allocation Pie Chart for Positions/Rewards */}
        <div className="card-hermetik p-6">
          <h2 className="text-xl font-semibold text-white font-heading mb-6">Portfolio Allocation</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Position Allocation */}
            <div>
              <h3 className="text-lg font-medium text-hermetik-gold mb-4 font-heading">By Position</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={protocolChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percentage }) => `${percentage}%`}
                    >
                      {protocolChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: any) => [`$${value.toLocaleString()}`, 'Value']}
                      labelFormatter={(label) => `Position: ${label}`}
                      contentStyle={{
                        backgroundColor: '#1a1a1a',
                        border: '1px solid #00321d',
                        borderRadius: '0.5rem',
                        color: '#FFFFFF'
                      }}
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Token Allocation */}
            <div>
              <h3 className="text-lg font-medium text-hermetik-gold mb-4 font-heading">By Token</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={tokenData.slice(0, 8)}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percentage }) => `${percentage}%`}
                    >
                      {tokenData.slice(0, 8).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: any) => [`$${value.toLocaleString()}`, 'Value']}
                      labelFormatter={(label) => `Token: ${label}`}
                      contentStyle={{
                        backgroundColor: '#1a1a1a',
                        border: '1px solid #00321d',
                        borderRadius: '0.5rem',
                        color: '#FFFFFF'
                      }}
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Performance: NAV Over Time */}
      <div className="card-hermetik p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white font-heading">Performance: NAV Over Time</h2>
          <div className="flex space-x-2">
            {[7, 30, 90].map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  selectedPeriod === period
                    ? 'bg-hermetik-green text-white'
                    : 'bg-hermetik-green/20 text-hermetik-gold hover:bg-hermetik-green/30'
                }`}
              >
                {period}D
              </button>
            ))}
          </div>
        </div>
        <div className="h-80">
          {historyLoading ? (
            <div className="flex items-center justify-center h-full">
              <LoadingSpinner size="md" />
              <p className="text-gray-400 ml-2">Loading NAV history...</p>
            </div>
          ) : historyData && historyData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333333" />
                <XAxis 
                  dataKey="date"
                  stroke="#B2A534"
                  tick={{ fill: '#B2A534' }}
                  tickFormatter={(value) => new Date(value).toLocaleDateString()}
                />
                <YAxis 
                  stroke="#B2A534"
                  tick={{ fill: '#B2A534' }}
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
                />
                <Tooltip 
                  formatter={(value: any) => [`$${value.toLocaleString()}`, 'NAV']}
                  labelFormatter={(label) => `Date: ${new Date(label).toLocaleDateString()}`}
                  contentStyle={{
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #00321d',
                    borderRadius: '0.5rem',
                    color: '#FFFFFF'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#B2A534" 
                  strokeWidth={3}
                  dot={{ fill: '#00321d', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: '#B2A534', strokeWidth: 2, fill: '#00321d' }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <TrendingUp className="w-16 h-16 text-hermetik-gold mx-auto mb-4" />
                <p className="text-gray-400">No NAV history available</p>
                <p className="text-sm text-gray-500 mt-2">NAV performance chart will appear here once historical data is collected</p>
              </div>
            </div>
          )}
        </div>
      </div>



    </div>
  );
};

export default Analytics;