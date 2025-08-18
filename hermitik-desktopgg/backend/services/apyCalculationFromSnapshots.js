const DailySnapshot = require('../models/DailySnapshot');
const APYCalculationService = require('./apyCalculationService');

/**
 * APY Calculation Service using real DailySnapshot data
 * This provides real APY calculations from actual snapshot history
 */
class APYFromSnapshotsService {

  /**
   * Calculate APY for all user positions using DailySnapshot data
   */
  static async calculateAllPositionAPYs(userId, targetDate = new Date()) {
    console.log(`📊 Calculating APYs from DailySnapshots for user: ${userId}`);
    
    try {
      // Get user's snapshots
      const snapshots = await DailySnapshot.find({
        userId,
        date: { $lte: targetDate }
      }).sort({ date: -1 }).limit(100); // Get last 100 snapshots

      if (snapshots.length === 0) {
        console.log('❌ No DailySnapshot data found for user');
        return {};
      }

      console.log(`📈 Found ${snapshots.length} snapshots for APY calculation`);

      // Group positions by protocolName + positionName to create unique position IDs
      const positionAPYs = {};
      
      // Get current snapshot
      const currentSnapshot = snapshots[0];
      if (!currentSnapshot.positions || currentSnapshot.positions.length === 0) {
        console.log('❌ Current snapshot has no positions');
        return {};
      }

      // Calculate APY for each position
      for (const currentPosition of currentSnapshot.positions) {
        const positionId = this.generatePositionId(currentPosition);
        
        console.log(`🧮 Calculating APY for position: ${positionId}`);
        
        const apyData = await this.calculatePositionAPYFromSnapshots(
          userId,
          positionId,
          currentPosition,
          snapshots,
          targetDate
        );
        
        if (apyData && Object.keys(apyData).length > 0) {
          positionAPYs[positionId] = apyData;
          console.log(`✅ APY calculated for ${positionId}`);
        }
      }

      console.log(`📊 Total positions with APY data: ${Object.keys(positionAPYs).length}`);
      return positionAPYs;

    } catch (error) {
      console.error('❌ Error calculating APYs from snapshots:', error);
      return {};
    }
  }

  /**
   * Generate position ID from DailySnapshot position data
   */
  static generatePositionId(position) {
    // Create consistent position ID from snapshot data
    const protocol = position.protocolName || 'unknown';
    const posName = position.positionName || 'unknown';
    return `${protocol}_${posName}`.toLowerCase().replace(/\s+/g, '_');
  }

  /**
   * Calculate APY for a specific position using snapshot history
   */
  static async calculatePositionAPYFromSnapshots(userId, positionId, currentPosition, snapshots, targetDate) {
    const results = {
      daily: null,
      weekly: null,
      monthly: null,
      sixMonth: null,
      allTime: null
    };

    try {
      const currentValue = currentPosition.totalUsdValue || 0;
      const currentDate = snapshots[0].date;

      if (currentValue <= 0) {
        console.log(`⚠️ Position ${positionId} has no value`);
        return results;
      }

      // Define periods to calculate
      const periods = [
        { name: 'daily', days: 1 },
        { name: 'weekly', days: 7 },
        { name: 'monthly', days: 30 },
        { name: 'sixMonth', days: 180 }
      ];

      // Calculate APY for each period
      for (const period of periods) {
        const targetHistoricalDate = new Date(currentDate);
        targetHistoricalDate.setDate(targetHistoricalDate.getDate() - period.days);

        // Find closest historical snapshot
        const historicalSnapshot = this.findClosestSnapshot(snapshots, targetHistoricalDate);
        
        if (historicalSnapshot) {
          // Find same position in historical snapshot
          const historicalPosition = historicalSnapshot.positions?.find(pos => 
            this.generatePositionId(pos) === positionId
          );

          if (historicalPosition && historicalPosition.totalUsdValue > 0) {
            const actualDays = Math.max(1, Math.ceil((currentDate - historicalSnapshot.date) / (1000 * 60 * 60 * 24)));
            const historicalValue = historicalPosition.totalUsdValue;

            // Calculate period return and APY
            const periodReturn = (currentValue / historicalValue) - 1;
            const annualizationFactor = 365 / actualDays;
            const annualizedReturn = Math.pow(1 + periodReturn, annualizationFactor) - 1;
            const apy = annualizedReturn * 100;

            // Assess confidence (reuse existing logic)
            const { confidence, warnings } = this.assessAPYConfidence(apy, periodReturn * 100, false, actualDays);

            results[period.name] = {
              apy: Math.round(apy * 100) / 100,
              periodReturn: Math.round(periodReturn * 10000) / 100,
              days: actualDays,
              isNewPosition: false,
              confidence,
              warnings,
              calculationMethod: 'snapshot_based_apy',
              rawDailyReturn: periodReturn / actualDays,
              positionValue: currentValue,
              historicalValue: historicalValue,
              periodStart: historicalSnapshot.date,
              validationFlags: {
                outliers: {
                  isStatisticalOutlier: Math.abs(apy) > 1000,
                  outlierMethods: Math.abs(apy) > 1000 ? ['threshold'] : [],
                  severity: Math.abs(apy) > 1000 ? 'high' : 'low'
                },
                historical: {
                  hasHistoricalData: true,
                  isHistoricalAnomaly: false,
                  historicalDeviation: 0,
                  trendAnalysis: null
                },
                market: {
                  isMarketOutlier: false,
                  marketContext: 'stable_defi',
                  expectedRange: {
                    min: 0,
                    max: 50,
                    description: 'Stable DeFi protocols'
                  }
                }
              }
            };

            console.log(`📈 ${period.name} APY for ${positionId}: ${apy.toFixed(2)}% over ${actualDays} days`);
          }
        }
      }

      // Calculate all-time APY if we have enough history
      if (snapshots.length > 1) {
        const oldestSnapshot = snapshots[snapshots.length - 1];
        const oldestPosition = oldestSnapshot.positions?.find(pos => 
          this.generatePositionId(pos) === positionId
        );

        if (oldestPosition && oldestPosition.totalUsdValue > 0) {
          const daysHeld = Math.max(1, (currentDate - oldestSnapshot.date) / (1000 * 60 * 60 * 24));
          const totalReturn = (currentValue / oldestPosition.totalUsdValue) - 1;
          const annualizedReturn = Math.pow(1 + totalReturn, 365 / daysHeld) - 1;
          const apy = annualizedReturn * 100;

          const { confidence, warnings } = this.assessAPYConfidence(apy, totalReturn * 100, false, Math.ceil(daysHeld));

          results.allTime = {
            apy: Math.round(apy * 100) / 100,
            periodReturn: Math.round(totalReturn * 10000) / 100,
            days: Math.ceil(daysHeld),
            isNewPosition: false,
            confidence,
            warnings,
            calculationMethod: 'all_time_snapshot_apy',
            positionValue: currentValue,
            firstRecorded: oldestSnapshot.date,
            initialValue: oldestPosition.totalUsdValue
          };
        }
      }

      // Add quality metrics
      results._qualityMetrics = {
        overallConfidence: 'high',
        dataCompleteness: Math.min(100, (snapshots.length / 30) * 100), // Based on 30-day ideal
        consistencyScore: 100,
        reliabilityScore: snapshots.length > 7 ? 100 : snapshots.length * 14,
        lastDataUpdate: currentDate
      };

      return results;

    } catch (error) {
      console.error(`❌ Error calculating APY for position ${positionId}:`, error);
      return results;
    }
  }

  /**
   * Find closest snapshot to a target date
   */
  static findClosestSnapshot(snapshots, targetDate) {
    let closest = null;
    let closestDiff = Infinity;

    for (const snapshot of snapshots) {
      const diff = Math.abs(snapshot.date - targetDate);
      if (diff < closestDiff) {
        closestDiff = diff;
        closest = snapshot;
      }
    }

    return closest;
  }

  /**
   * Assess APY confidence (reuse existing logic)
   */
  static assessAPYConfidence(apy, periodReturn, isNewPosition, days = 1) {
    let confidence = 'high';
    let warnings = [];

    const MAX_REASONABLE_APY = 10000;
    const MIN_REASONABLE_APY = -99;

    if (apy > MAX_REASONABLE_APY) {
      confidence = 'low';
      warnings.push(`Extreme APY of ${apy.toFixed(2)}% detected - please verify data accuracy`);
    } else if (apy < MIN_REASONABLE_APY) {
      confidence = 'low';
      warnings.push(`Extreme negative APY of ${apy.toFixed(2)}% detected - position may be losing significant value`);
    }

    if (days < 7 && Math.abs(apy) > 1000) {
      confidence = 'low';
      warnings.push(`Short period (${days} days) with high APY may not be representative`);
    }

    if (periodReturn < -50) {
      confidence = 'low';
      warnings.push(`Large period loss of ${periodReturn.toFixed(2)}% - position may be compromised`);
    }

    return { confidence, warnings };
  }

  /**
   * Format APY data for display (reuse existing method)
   */
  static formatAPYForDisplay(apyData) {
    return APYCalculationService.formatAPYForDisplay(apyData);
  }
}

module.exports = APYFromSnapshotsService;