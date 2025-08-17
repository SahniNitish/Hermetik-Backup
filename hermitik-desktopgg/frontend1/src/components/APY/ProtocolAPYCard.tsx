import React from 'react';
import { BarChart3, DollarSign, TrendingUp, AlertCircle } from 'lucide-react';
import APYDisplay from './APYDisplay';

interface ProtocolAPYData {
  protocolName: string;
  totalValue: number;
  avgAPY: number | null;
  positionCount: number;
  highestAPY: number | null;
  lowestAPY: number | null;
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];
  positions: Array<{
    name: string;
    apy: number;
    confidence: string;
  }>;
}

interface ProtocolAPYCardProps {
  data: ProtocolAPYData;
  onClick?: () => void;
}

const ProtocolAPYCard: React.FC<ProtocolAPYCardProps> = ({ data, onClick }) => {
  // Color coding for protocol-level APY
  const getProtocolAPYColor = (apy: number | null) => {
    if (!apy || apy < 0) return 'text-gray-400';
    if (apy > 15) return 'text-green-400';
    if (apy > 10) return 'text-green-500';
    if (apy > 5) return 'text-blue-400';
    if (apy > 1) return 'text-yellow-400';
    return 'text-gray-400';
  };

  // Background gradient based on performance
  const getCardBackground = (apy: number | null, confidence: string) => {
    if (!apy) return 'bg-gray-800/50';
    if (confidence === 'low') return 'bg-gradient-to-br from-yellow-900/20 to-orange-900/20';
    if (apy > 15) return 'bg-gradient-to-br from-green-900/30 to-emerald-900/20';
    if (apy > 10) return 'bg-gradient-to-br from-green-900/20 to-blue-900/20';
    if (apy > 5) return 'bg-gradient-to-br from-blue-900/20 to-indigo-900/20';
    return 'bg-gray-800/30';
  };

  const apyColor = getProtocolAPYColor(data.avgAPY);
  const cardBg = getCardBackground(data.avgAPY, data.confidence);

  return (
    <div 
      className={`
        relative p-6 rounded-xl border border-gray-700 hover:border-gray-600 
        transition-all duration-300 cursor-pointer group
        ${cardBg}
        hover:shadow-lg hover:shadow-blue-500/10
      `}
      onClick={onClick}
    >
      {/* Protocol Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-900/30 rounded-lg">
            <BarChart3 className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white group-hover:text-blue-400 transition-colors">
              {data.protocolName}
            </h3>
            <p className="text-sm text-gray-400">
              {data.positionCount} position{data.positionCount !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Warning indicator */}
        {data.warnings.length > 0 && (
          <AlertCircle className="w-5 h-5 text-orange-400 animate-pulse" />
        )}
      </div>

      {/* Main Metrics Row */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Total Value */}
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <DollarSign className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-400">Total Value</span>
          </div>
          <p className="text-xl font-bold text-white">
            ${data.totalValue.toLocaleString()}
          </p>
        </div>

        {/* Average APY - Primary Focus */}
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-400">Avg APY</span>
          </div>
          <div className="flex items-center space-x-2">
            {data.avgAPY !== null ? (
              <span className={`text-2xl font-bold ${apyColor}`}>
                {data.avgAPY >= 0 ? '+' : ''}{data.avgAPY.toFixed(2)}%
              </span>
            ) : (
              <span className="text-2xl font-bold text-gray-400">N/A</span>
            )}
            
            {/* Confidence indicator */}
            <div className={`
              px-2 py-1 rounded-full text-xs font-medium
              ${data.confidence === 'high' ? 'bg-green-900/30 text-green-400' :
                data.confidence === 'medium' ? 'bg-yellow-900/30 text-yellow-400' :
                'bg-red-900/30 text-red-400'}
            `}>
              {data.confidence.toUpperCase()}
            </div>
          </div>
        </div>
      </div>

      {/* APY Range */}
      {data.highestAPY !== null && data.lowestAPY !== null && (
        <div className="mb-4 p-3 bg-gray-900/50 rounded-lg">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-400">APY Range:</span>
            <div className="flex items-center space-x-2">
              <span className="text-red-300">
                {data.lowestAPY.toFixed(1)}%
              </span>
              <span className="text-gray-500">to</span>
              <span className="text-green-300">
                {data.highestAPY.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Individual Position APYs */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-300">Position APYs:</h4>
        <div className="grid grid-cols-1 gap-2">
          {data.positions.slice(0, 3).map((position, idx) => (
            <div key={idx} className="flex justify-between items-center py-1">
              <span className="text-sm text-gray-400 truncate">
                {position.name}
              </span>
              <APYDisplay 
                apyData={{
                  apy: `${position.apy >= 0 ? '+' : ''}${position.apy.toFixed(2)}%`,
                  rawAPY: position.apy,
                  confidence: position.confidence as 'high' | 'medium' | 'low',
                  warnings: [],
                  calculationMethod: 'compound_formula'
                }}
                size="sm"
              />
            </div>
          ))}
          
          {data.positions.length > 3 && (
            <div className="text-xs text-gray-500 text-center pt-2">
              +{data.positions.length - 3} more positions
            </div>
          )}
        </div>
      </div>

      {/* Warnings */}
      {data.warnings.length > 0 && (
        <div className="mt-4 p-3 bg-orange-900/20 border border-orange-500/30 rounded-lg">
          <div className="text-xs text-orange-300">
            <p className="font-semibold">⚠️ Warnings:</p>
            {data.warnings.slice(0, 2).map((warning, idx) => (
              <p key={idx} className="ml-2">• {warning}</p>
            ))}
            {data.warnings.length > 2 && (
              <p className="ml-2 text-orange-400">+{data.warnings.length - 2} more</p>
            )}
          </div>
        </div>
      )}

      {/* Hover effect overlay */}
      <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl pointer-events-none" />
    </div>
  );
};

export default ProtocolAPYCard;