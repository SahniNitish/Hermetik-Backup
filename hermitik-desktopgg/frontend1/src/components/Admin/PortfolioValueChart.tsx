import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface PortfolioValueChartProps {
  data: Array<{
    date: string;
    totalValue: number;
    ethWallets: number;
    stableWallets: number;
    hybridWallets: number;
  }>;
}

const PortfolioValueChart: React.FC<PortfolioValueChartProps> = ({ data }) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-lg">
          <p className="text-white font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white dark:bg-hermetik-secondary rounded-lg p-6 shadow-lg">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Portfolio Value Trends
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis 
            dataKey="date" 
            stroke="#9CA3AF"
            fontSize={12}
          />
          <YAxis 
            stroke="#9CA3AF"
            fontSize={12}
            tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="totalValue" 
            stroke="#F59E0B" 
            strokeWidth={3}
            name="Total Portfolio"
            dot={{ fill: '#F59E0B', strokeWidth: 2, r: 4 }}
          />
          <Line 
            type="monotone" 
            dataKey="ethWallets" 
            stroke="#EF4444" 
            strokeWidth={2}
            name="ETH Wallets"
            dot={{ fill: '#EF4444', strokeWidth: 2, r: 3 }}
          />
          <Line 
            type="monotone" 
            dataKey="stableWallets" 
            stroke="#3B82F6" 
            strokeWidth={2}
            name="Stable Wallets"
            dot={{ fill: '#3B82F6', strokeWidth: 2, r: 3 }}
          />
          <Line 
            type="monotone" 
            dataKey="hybridWallets" 
            stroke="#8B5CF6" 
            strokeWidth={2}
            name="Hybrid Wallets"
            dot={{ fill: '#8B5CF6', strokeWidth: 2, r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PortfolioValueChart;
