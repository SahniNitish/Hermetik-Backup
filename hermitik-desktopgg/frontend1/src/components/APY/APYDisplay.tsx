import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, Clock, Info } from 'lucide-react';

interface APYData {
  apy: string;
  rawAPY: number;
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];
  calculationMethod: string;
  positionValue?: number;
  rewardsValue?: number;
  rawDailyReturn?: number;
  isNewPosition?: boolean;
  days?: number;
}

interface APYDisplayProps {
  apyData: APYData | null;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
  loading?: boolean;
}

const APYDisplay: React.FC<APYDisplayProps> = ({ 
  apyData, 
  size = 'md',
  showDetails = false,
  loading = false 
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center">
        <div className="animate-pulse text-gray-400">
          <span className={`font-bold ${size === 'lg' ? 'text-xl' : size === 'md' ? 'text-lg' : 'text-base'}`}>
            --- %
          </span>
        </div>
        <span className="text-xs text-gray-500">Calculating...</span>
      </div>
    );
  }

  // No data state
  if (!apyData) {
    return (
      <div className="flex flex-col items-center">
        <span className={`text-gray-400 font-bold ${size === 'lg' ? 'text-xl' : size === 'md' ? 'text-lg' : 'text-base'}`}>
          N/A
        </span>
        <span className="text-xs text-gray-500">No data</span>
      </div>
    );
  }

  // Color coding based on APY ranges
  const getAPYColor = (rawAPY: number, confidence: string) => {
    if (rawAPY < 0) return 'text-red-500'; // Negative/error
    if (confidence === 'low' && rawAPY > 50) return 'text-red-400'; // Suspicious high
    if (rawAPY > 15) return 'text-green-400'; // Excellent yields
    if (rawAPY > 10) return 'text-green-500'; // Very good
    if (rawAPY > 5) return 'text-blue-400'; // Good, safe yields
    if (rawAPY > 1) return 'text-yellow-400'; // Moderate
    return 'text-gray-400'; // Low or calculating
  };

  // Background color for confidence
  const getConfidenceBackground = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'bg-green-900/20 border-green-500/30';
      case 'medium': return 'bg-blue-900/20 border-blue-500/30';
      case 'low': return 'bg-yellow-900/20 border-yellow-500/30';
      default: return 'bg-gray-800 border-gray-600';
    }
  };

  // Confidence badge
  const getConfidenceBadge = (confidence: string, isNewPosition: boolean) => {
    if (isNewPosition) {
      return { icon: Clock, text: 'Est.', color: 'text-yellow-400 bg-yellow-900/20' };
    }
    
    switch (confidence) {
      case 'high':
        return { icon: CheckCircle, text: 'High', color: 'text-green-400 bg-green-900/20' };
      case 'medium':
        return { icon: Info, text: 'Med', color: 'text-blue-400 bg-blue-900/20' };
      case 'low':
        return { icon: AlertTriangle, text: 'Low', color: 'text-yellow-400 bg-yellow-900/20' };
      default:
        return { icon: Info, text: 'N/A', color: 'text-gray-400 bg-gray-800' };
    }
  };

  // Trend indicator (mock for now - would need historical data)
  const getTrendIndicator = () => {
    // This would be calculated from historical APY data
    const trend = 'stable'; // 'up' | 'down' | 'stable' | 'volatile'
    
    switch (trend) {
      case 'up': return { icon: TrendingUp, color: 'text-green-400' };
      case 'down': return { icon: TrendingDown, color: 'text-red-400' };
      case 'volatile': return { icon: TrendingUp, color: 'text-blue-400' };
      default: return { icon: Minus, color: 'text-gray-400' };
    }
  };

  const apyColor = getAPYColor(apyData.rawAPY, apyData.confidence);
  const confidenceBadge = getConfidenceBadge(apyData.confidence, apyData.isNewPosition || false);
  const trendIndicator = getTrendIndicator();
  const TrendIcon = trendIndicator.icon;
  const ConfidenceIcon = confidenceBadge.icon;

  // Alert states
  const isHighlyWarning = apyData.rawAPY > 100 || apyData.warnings.length > 0;
  const containerClasses = `
    relative inline-flex flex-col items-center p-2 rounded-lg border transition-all duration-200
    ${getConfidenceBackground(apyData.confidence)}
    ${isHighlyWarning ? 'animate-pulse' : ''}
    ${showTooltip ? 'ring-2 ring-blue-400' : ''}
    cursor-pointer hover:scale-105
  `;

  return (
    <div 
      className={containerClasses}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={() => setShowTooltip(!showTooltip)}
    >
      {/* Main APY Display */}
      <div className="flex items-center space-x-2">
        <span className={`font-bold ${apyColor} ${
          size === 'lg' ? 'text-2xl' : 
          size === 'md' ? 'text-xl' : 
          'text-lg'
        }`}>
          {apyData.apy}
        </span>
        
        {/* Trend indicator */}
        <TrendIcon className={`w-4 h-4 ${trendIndicator.color}`} />
      </div>

      {/* Confidence Badge */}
      <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs ${confidenceBadge.color}`}>
        <ConfidenceIcon className="w-3 h-3" />
        <span>{confidenceBadge.text}</span>
      </div>

      {/* Calculation Period */}
      {apyData.days && (
        <span className="text-xs text-gray-500">
          {apyData.days === 1 ? '1d est.' : `${apyData.days}d avg`}
        </span>
      )}

      {/* Warning Indicators */}
      {apyData.warnings.length > 0 && (
        <div className="absolute -top-1 -right-1">
          <AlertTriangle className="w-4 h-4 text-orange-400 animate-bounce" />
        </div>
      )}

      {/* Detailed Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 shadow-xl min-w-64">
            <div className="text-sm text-white space-y-2">
              <div className="font-semibold border-b border-gray-600 pb-2">
                APY Breakdown
              </div>
              
              {apyData.positionValue && apyData.rewardsValue && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Position Value:</span>
                    <span>${apyData.positionValue.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Rewards Value:</span>
                    <span>${apyData.rewardsValue.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Daily Return:</span>
                    <span>{((apyData.rawDailyReturn || 0) * 100).toFixed(4)}%</span>
                  </div>
                </>
              )}
              
              <div className="flex justify-between">
                <span className="text-gray-400">Method:</span>
                <span className="capitalize">{apyData.calculationMethod.replace('_', ' ')}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-400">Confidence:</span>
                <span className={`capitalize ${
                  apyData.confidence === 'high' ? 'text-green-400' :
                  apyData.confidence === 'medium' ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {apyData.confidence}
                </span>
              </div>
              
              {apyData.warnings.length > 0 && (
                <div className="border-t border-gray-600 pt-2">
                  <div className="text-orange-300 font-semibold text-xs">⚠️ Warnings:</div>
                  {apyData.warnings.map((warning, idx) => (
                    <div key={idx} className="text-orange-300 text-xs ml-2">
                      • {warning}
                    </div>
                  ))}
                </div>
              )}
              
              <div className="text-xs text-gray-500 border-t border-gray-600 pt-2">
                Last updated: {new Date().toLocaleTimeString()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default APYDisplay;