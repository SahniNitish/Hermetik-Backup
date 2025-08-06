import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '../services/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import Card from '../components/UI/Card';
import LoadingSpinner from '../components/UI/LoadingSpinner';

const Analytics: React.FC = () => {
  const [selectedPeriod, setSelectedPeriod] = useState(30);

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['portfolio-history', selectedPeriod],
    queryFn: () => analyticsApi.getPortfolioHistory(selectedPeriod),
  });

  const { data: performanceData, isLoading: performanceLoading } = useQuery({
    queryKey: ['portfolio-performance', selectedPeriod],
    queryFn: () => analyticsApi.getPerformanceMetrics(selectedPeriod),
  });

  const isLoading = historyLoading || performanceLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const periods = [
    { label: '7D', value: 7 },
    { label: '30D', value: 30 },
    { label: '90D', value: 90 },
    { label: '1Y', value: 365 },
  ];

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Analytics</h1>
        <p className="text-gray-400">Comprehensive portfolio performance analysis</p>
      </div>

      {/* Period Selection */}
      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Time Period</h2>
          <div className="flex space-x-2">
            {periods.map((period) => (
              <button
                key={period.value}
                onClick={() => setSelectedPeriod(period.value)}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  selectedPeriod === period.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Performance Metrics */}
      {performanceData && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <Card className="bg-gradient-to-br from-green-900/50 to-green-800/30 border-green-700/50">
            <div className="text-center">
              <p className="text-green-300 text-sm font-medium mb-1">Total Return</p>
              <p className="text-3xl font-bold text-white">
                {performanceData.total_return >= 0 ? '+' : ''}
                {performanceData.total_return.toFixed(2)}%
              </p>
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 border-blue-700/50">
            <div className="text-center">
              <p className="text-blue-300 text-sm font-medium mb-1">Volatility</p>
              <p className="text-3xl font-bold text-white">{performanceData.volatility.toFixed(2)}%</p>
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 border-purple-700/50">
            <div className="text-center">
              <p className="text-purple-300 text-sm font-medium mb-1">Sharpe Ratio</p>
              <p className="text-3xl font-bold text-white">{performanceData.sharpe_ratio.toFixed(2)}</p>
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-yellow-900/50 to-yellow-800/30 border-yellow-700/50">
            <div className="text-center">
              <p className="text-yellow-300 text-sm font-medium mb-1">Daily Return</p>
              <p className="text-3xl font-bold text-white">
                {performanceData.daily_return >= 0 ? '+' : ''}
                {performanceData.daily_return.toFixed(2)}%
              </p>
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-red-900/50 to-red-800/30 border-red-700/50">
            <div className="text-center">
              <p className="text-red-300 text-sm font-medium mb-1">Max Drawdown</p>
              <p className="text-3xl font-bold text-white">{performanceData.max_drawdown.toFixed(2)}%</p>
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-teal-900/50 to-teal-800/30 border-teal-700/50">
            <div className="text-center">
              <p className="text-teal-300 text-sm font-medium mb-1">Monthly Return</p>
              <p className="text-3xl font-bold text-white">
                {performanceData.monthly_return >= 0 ? '+' : ''}
                {performanceData.monthly_return.toFixed(2)}%
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* Portfolio Value Chart */}
      <Card>
        <h2 className="text-xl font-semibold text-white mb-6">Portfolio Value Over Time</h2>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={historyData}>
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
                formatter={(value: number) => [`$${value.toLocaleString()}`, 'Portfolio Value']}
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

      {/* Daily Returns Chart */}
      <Card>
        <h2 className="text-xl font-semibold text-white mb-6">Daily Returns</h2>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={historyData}>
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
                formatter={(value: number) => [`${value.toFixed(2)}%`, 'Daily Return']}
              />
              <Bar 
                dataKey="daily_return"
                fill={(data) => data >= 0 ? '#10B981' : '#EF4444'}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
};

export default Analytics;