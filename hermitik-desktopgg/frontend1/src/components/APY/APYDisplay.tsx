import React, { useState } from 'react';
import { TrendingUp, TrendingDown, BarChart3, AlertTriangle, CheckCircle, Clock, Info } from 'lucide-react';

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
  validationFlags?: {
    outliers?: {
      isStatisticalOutlier: boolean;
      outlierMethods: string[];
      severity: string;
    };
    historical?: {
      hasHistoricalData: boolean;
      isHistoricalAnomaly: boolean;
      historicalDeviation: number;
    };
    market?: {
      isMarketOutlier: boolean;
      marketContext: string;
      expectedRange: { description: string };
    };
  };
}

interface APYDisplayProps {
  apyData: APYData | null;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
  loading?: boolean;
  className?: string;
}

const APYDisplay: React.FC<APYDisplayProps> = ({ 
  apyData, 
  size = 'md',
  showDetails = false,
  loading = false,
  className = ''
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  /**
   * Enhanced APY color coding logic following comprehensive guide
   */
  const getAPYColor = (rawAPY: number | null, confidence: string = 'medium') => {
    if (rawAPY === null || rawAPY === undefined) return 'text-gray-500';
    
    // Confidence-based color intensity adjustments
    const isLowConfidence = confidence === 'low';
    const isMediumConfidence = confidence === 'medium';
    
    // Color mapping based on APY performance tiers
    if (rawAPY >= 15) {
      return isLowConfidence ? 'text-green-600' : isMediumConfidence ? 'text-green-400' : 'text-green-300'; // Excellent (15%+)
    }
    if (rawAPY >= 10) {
      return isLowConfidence ? 'text-green-600' : isMediumConfidence ? 'text-green-500' : 'text-green-400'; // Very Good (10-15%)
    }
    if (rawAPY >= 5) {
      return isLowConfidence ? 'text-green-700' : isMediumConfidence ? 'text-green-600' : 'text-green-500'; // Good (5-10%)
    }
    if (rawAPY >= 1) {
      return isLowConfidence ? 'text-blue-600' : isMediumConfidence ? 'text-blue-500' : 'text-blue-400'; // Moderate (1-5%)
    }
    if (rawAPY >= 0) {
      return isLowConfidence ? 'text-yellow-600' : isMediumConfidence ? 'text-yellow-500' : 'text-yellow-400'; // Break-even (0-1%)
    }
    if (rawAPY >= -5) {
      return isLowConfidence ? 'text-orange-600' : isMediumConfidence ? 'text-orange-500' : 'text-orange-400'; // Small Loss (0 to -5%)
    }
    
    return isLowConfidence ? 'text-red-600' : isMediumConfidence ? 'text-red-500' : 'text-red-400'; // Significant Loss (-5%+)
  };

  /**
   * Format APY value with proper prefix and confidence indicators
   */
  const formatAPY = (apy: number | null, isNewPosition: boolean = false) => {
    if (apy === null || apy === undefined) return 'Calculating...';
    
    const prefix = apy >= 0 ? '+' : '';
    const formattedValue = `${prefix}${apy.toFixed(2)}%`;
    
    if (isNewPosition) {
      return `${formattedValue} (Est.)`;
    }
    
    return formattedValue;
  };

  // Loading state
  if (loading) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <BarChart3 className="w-4 h-4 text-gray-400 animate-pulse" />
        <span className={`text-gray-400 ${
          size === 'lg' ? 'text-xl' : size === 'md' ? 'text-lg' : 'text-base'
        }`}>
          Calculating...
        </span>
      </div>
    );
  }

  // No data state
  if (!apyData) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <BarChart3 className="w-4 h-4 text-gray-500" />
        <span className={`text-gray-500 ${
          size === 'lg' ? 'text-xl' : size === 'md' ? 'text-lg' : 'text-base'
        }`}>
          No APY data
        </span>
      </div>
    );
  }

  /**
   * Get confidence badge styling and icon
   */
  const getConfidenceBadge = (confidence: string, isNewPosition: boolean) => {
    if (isNewPosition) {
      return { 
        icon: Clock, 
        text: 'EST', 
        color: 'bg-blue-900/30 text-blue-400 border-blue-500/30',
        description: 'Estimated from current rewards'
      };
    }
    
    switch (confidence) {
      case 'high':
        return { 
          icon: CheckCircle, 
          text: 'HIGH', 
          color: 'bg-green-900/30 text-green-400 border-green-500/30',
          description: 'High confidence - reliable data'
        };
      case 'medium':
        return { 
          icon: Info, 
          text: 'MED', 
          color: 'bg-yellow-900/30 text-yellow-400 border-yellow-500/30',
          description: 'Medium confidence - some uncertainty'
        };
      case 'low':
        return { 
          icon: AlertTriangle, 
          text: 'LOW', 
          color: 'bg-red-900/30 text-red-400 border-red-500/30',
          description: 'Low confidence - verify manually'
        };
      default:
        return { 
          icon: Info, 
          text: 'UNK', 
          color: 'bg-gray-900/30 text-gray-400 border-gray-500/30',
          description: 'Unknown confidence level'
        };
    }
  };

  /**
   * Get trend indicator based on APY direction
   */
  const getTrendIndicator = (rawAPY: number) => {
    if (rawAPY >= 0) {
      return { icon: TrendingUp, color: getAPYColor(rawAPY, apyData.confidence) };
    } else {
      return { icon: TrendingDown, color: getAPYColor(rawAPY, apyData.confidence) };
    }
  };

  /**
   * Check for critical alerts that need attention
   */
  const getCriticalAlerts = () => {
    const alerts = [];
    
    // Check for statistical outliers
    if (apyData.validationFlags?.outliers?.isStatisticalOutlier) {
      alerts.push({
        type: 'outlier',
        severity: apyData.validationFlags.outliers.severity,
        message: `Statistical outlier detected (${apyData.validationFlags.outliers.outlierMethods.join(', ')})`
      });
    }
    
    // Check for historical anomalies
    if (apyData.validationFlags?.historical?.isHistoricalAnomaly) {
      alerts.push({
        type: 'anomaly',
        severity: 'medium',
        message: `${apyData.validationFlags.historical.historicalDeviation.toFixed(1)}% deviation from historical average`
      });
    }
    
    // Check for market outliers
    if (apyData.validationFlags?.market?.isMarketOutlier) {
      alerts.push({
        type: 'market',
        severity: 'low',
        message: `Outside expected range for ${apyData.validationFlags.market.expectedRange.description}`
      });
    }
    
    return alerts;
  };

  const apyColor = getAPYColor(apyData.rawAPY, apyData.confidence);
  const confidenceBadge = getConfidenceBadge(apyData.confidence, apyData.isNewPosition || false);
  const trendIndicator = getTrendIndicator(apyData.rawAPY);
  const criticalAlerts = getCriticalAlerts();
  const TrendIcon = trendIndicator.icon;
  const ConfidenceIcon = confidenceBadge.icon;

  // Determine if this requires special attention
  const hasAlerts = criticalAlerts.length > 0 || apyData.warnings.length > 0;
  const isExtreme = Math.abs(apyData.rawAPY) > 100;

  return (
    <div className={`relative ${className}`}>
      {/* Compact Display Mode */}
      {size === 'sm' ? (
        <div className="flex items-center space-x-2">
          <span className={`font-semibold ${apyColor}`}>
            {formatAPY(apyData.rawAPY, apyData.isNewPosition)}
          </span>
          <span className={`px-1 py-0.5 rounded text-xs font-medium border ${confidenceBadge.color}`}>
            {confidenceBadge.text}
          </span>
          {hasAlerts && (
            <AlertTriangle className="w-3 h-3 text-orange-400" />
          )}
        </div>
      ) : (
        /* Detailed Display Mode */
        <div 
          className={`
            bg-gray-800/50 border border-gray-700 rounded-lg p-3 transition-all duration-200 cursor-pointer
            hover:bg-gray-800/70 hover:border-gray-600 hover:scale-105
            ${hasAlerts ? 'ring-1 ring-orange-400/50' : ''}
            ${isExtreme ? 'animate-pulse' : ''}
            ${showTooltip ? 'ring-2 ring-blue-400/50' : ''}
          `}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          onClick={() => setShowTooltip(!showTooltip)}
        >
          {/* Main APY Display */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-400">APY</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className={`font-bold ${apyColor} ${
                size === 'lg' ? 'text-xl' : 'text-lg'
              }`}>
                {formatAPY(apyData.rawAPY, apyData.isNewPosition)}
              </span>
              <TrendIcon className={`w-4 h-4 ${trendIndicator.color}`} />
            </div>
          </div>

          {/* Confidence and Metadata */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className={`inline-flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium border ${confidenceBadge.color}`}>
                <ConfidenceIcon className="w-3 h-3" />
                <span>{confidenceBadge.text}</span>
              </span>
              {apyData.isNewPosition && (
                <span className="text-blue-400 text-xs" title="Estimated from current rewards">
                  New*
                </span>
              )}
            </div>
            {apyData.days && (
              <span className="text-xs text-gray-500">
                {apyData.days === 1 ? '1d est.' : `${apyData.days}d avg`}
              </span>
            )}
          </div>

          {/* Critical Alerts */}
          {criticalAlerts.length > 0 && (
            <div className="mt-2 space-y-1">
              {criticalAlerts.slice(0, 2).map((alert, idx) => (
                <div key={idx} className="bg-orange-900/20 border border-orange-500/30 rounded px-2 py-1">
                  <div className="flex items-center text-xs text-orange-300">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    <span className="truncate">{alert.message}</span>
                  </div>
                </div>
              ))}
              {criticalAlerts.length > 2 && (
                <div className="text-xs text-orange-400 text-center">
                  +{criticalAlerts.length - 2} more alerts
                </div>
              )}
            </div>
          )}

          {/* Enhanced Tooltip */}
          {showTooltip && (
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50">
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 shadow-xl min-w-80">
                <div className="text-sm text-white space-y-3">
                  {/* Header */}
                  <div className="font-semibold border-b border-gray-600 pb-2 flex items-center">
                    <BarChart3 className="w-4 h-4 mr-2" />
                    APY Analysis
                  </div>
                  
                  {/* APY Breakdown */}
                  {apyData.positionValue && apyData.rewardsValue && (
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-gray-300">Financial Breakdown</div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Position:</span>
                          <span>${apyData.positionValue.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Rewards:</span>
                          <span>${apyData.rewardsValue.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Daily Return:</span>
                          <span>{((apyData.rawDailyReturn || 0) * 100).toFixed(4)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Method:</span>
                          <span className="capitalize">{apyData.calculationMethod.replace(/_/g, ' ')}</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Confidence Analysis */}
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-gray-300">Data Quality</div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-xs">Confidence:</span>
                      <span className={`text-xs font-medium ${
                        apyData.confidence === 'high' ? 'text-green-400' :
                        apyData.confidence === 'medium' ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {confidenceBadge.description}
                      </span>
                    </div>
                  </div>

                  {/* Validation Flags */}
                  {criticalAlerts.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-orange-300">⚠️ Validation Alerts</div>
                      {criticalAlerts.map((alert, idx) => (
                        <div key={idx} className="text-orange-300 text-xs">
                          • {alert.message}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* General Warnings */}
                  {apyData.warnings.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-yellow-300">⚠️ Warnings</div>
                      {apyData.warnings.map((warning, idx) => (
                        <div key={idx} className="text-yellow-300 text-xs">
                          • {warning}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="text-xs text-gray-500 border-t border-gray-600 pt-2">
                    Click to pin • Hover for details
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default APYDisplay;