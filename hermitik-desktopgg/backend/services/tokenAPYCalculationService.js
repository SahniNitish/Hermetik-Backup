const DailySnapshot = require('../models/DailySnapshot');

/**
 * Token APY Calculation Service
 * Calculates APY for individual tokens based on price changes over time
 */
class TokenAPYCalculationService {

  /**
   * Calculate APY for all tokens for a user
   */
  static async calculateAllTokenAPYs(userId, targetDate = new Date()) {
    console.log(`📊 Calculating Token APYs for user: ${userId}`);
    
    try {
      // Get user's snapshots
      const snapshots = await DailySnapshot.find({
        userId,
        date: { $lte: targetDate }
      }).sort({ date: -1 }).limit(100);

      if (snapshots.length === 0) {
        console.log('❌ No snapshots found for token APY calculation');
        return {};
      }

      console.log(`📈 Found ${snapshots.length} snapshots for token APY calculation`);

      // Group tokens by symbol and calculate APY
      const tokenAPYs = {};
      
      // Get current snapshot
      const currentSnapshot = snapshots[0];
      if (!currentSnapshot.tokens || currentSnapshot.tokens.length === 0) {
        console.log('❌ Current snapshot has no tokens');
        return {};
      }

      // Calculate APY for each token
      for (const currentToken of currentSnapshot.tokens) {
        const tokenSymbol = currentToken.symbol;
        
        console.log(`🪙 Calculating APY for token: ${tokenSymbol}`);
        
        const apyData = await this.calculateTokenAPYFromSnapshots(
          userId,
          tokenSymbol,
          currentToken,
          snapshots,
          targetDate
        );
        
        if (apyData && Object.keys(apyData).length > 0) {
          tokenAPYs[tokenSymbol] = apyData;
          console.log(`✅ APY calculated for ${tokenSymbol}`);
        }
      }

      console.log(`📊 Total tokens with APY data: ${Object.keys(tokenAPYs).length}`);
      return tokenAPYs;

    } catch (error) {
      console.error('❌ Error calculating token APYs:', error);
      return {};
    }
  }

  /**
   * Calculate APY for a specific token using snapshot history
   */
  static async calculateTokenAPYFromSnapshots(userId, tokenSymbol, currentToken, snapshots, targetDate) {
    const results = {
      daily: null,
      weekly: null,
      monthly: null,
      allTime: null,
      tokenInfo: {
        symbol: currentToken.symbol,
        name: currentToken.name,
        amount: currentToken.amount,
        currentPrice: currentToken.price,
        currentValue: currentToken.usdValue
      }
    };

    try {
      const currentPrice = currentToken.price || 0;
      const currentDate = snapshots[0].date;

      if (currentPrice <= 0) {
        console.log(`⚠️ Token ${tokenSymbol} has no price data`);
        return results;
      }

      // Define periods to calculate
      const periods = [
        { name: 'daily', days: 1 },
        { name: 'weekly', days: 7 },
        { name: 'monthly', days: 30 }
      ];

      // Calculate APY for each period
      for (const period of periods) {
        const targetHistoricalDate = new Date(currentDate);
        targetHistoricalDate.setDate(targetHistoricalDate.getDate() - period.days);

        // Find closest historical snapshot
        const historicalSnapshot = this.findClosestSnapshot(snapshots, targetHistoricalDate);
        
        if (historicalSnapshot) {
          // Find same token in historical snapshot
          const historicalToken = historicalSnapshot.tokens?.find(token => 
            token.symbol === tokenSymbol
          );

          if (historicalToken && historicalToken.price > 0) {
            const actualDays = Math.max(1, Math.ceil((currentDate - historicalSnapshot.date) / (1000 * 60 * 60 * 24)));
            const historicalPrice = historicalToken.price;

            // Calculate price return and APY
            const priceReturn = (currentPrice / historicalPrice) - 1;
            const annualizationFactor = 365 / actualDays;
            const annualizedReturn = Math.pow(1 + priceReturn, annualizationFactor) - 1;
            const apy = annualizedReturn * 100;

            // Assess confidence
            const { confidence, warnings } = this.assessTokenAPYConfidence(apy, priceReturn * 100, actualDays);

            results[period.name] = {
              apy: Math.round(apy * 100) / 100,
              priceReturn: Math.round(priceReturn * 10000) / 100,
              days: actualDays,
              confidence,
              warnings,
              calculationMethod: 'token_price_based_apy',
              currentPrice: currentPrice,
              historicalPrice: historicalPrice,
              periodStart: historicalSnapshot.date,
              priceChange: currentPrice - historicalPrice,
              priceChangePercent: Math.round(priceReturn * 10000) / 100
            };

            console.log(`📈 ${period.name} APY for ${tokenSymbol}: ${apy.toFixed(2)}% (price: $${historicalPrice} → $${currentPrice})`);
          }
        }
      }

      // Calculate all-time APY if we have enough history
      if (snapshots.length > 1) {
        const oldestSnapshot = snapshots[snapshots.length - 1];
        const oldestToken = oldestSnapshot.tokens?.find(token => 
          token.symbol === tokenSymbol
        );

        if (oldestToken && oldestToken.price > 0) {
          const daysHeld = Math.max(1, (currentDate - oldestSnapshot.date) / (1000 * 60 * 60 * 24));
          const totalPriceReturn = (currentPrice / oldestToken.price) - 1;
          const annualizedReturn = Math.pow(1 + totalPriceReturn, 365 / daysHeld) - 1;
          const apy = annualizedReturn * 100;

          const { confidence, warnings } = this.assessTokenAPYConfidence(apy, totalPriceReturn * 100, Math.ceil(daysHeld));

          results.allTime = {
            apy: Math.round(apy * 100) / 100,
            priceReturn: Math.round(totalPriceReturn * 10000) / 100,
            days: Math.ceil(daysHeld),
            confidence,
            warnings,
            calculationMethod: 'all_time_token_apy',
            currentPrice: currentPrice,
            firstPrice: oldestToken.price,
            firstRecorded: oldestSnapshot.date,
            totalPriceChange: currentPrice - oldestToken.price
          };
        }
      }

      return results;

    } catch (error) {
      console.error(`❌ Error calculating APY for token ${tokenSymbol}:`, error);
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
   * Assess token APY confidence
   */
  static assessTokenAPYConfidence(apy, priceReturn, days = 1) {
    let confidence = 'high';
    let warnings = [];

    const MAX_REASONABLE_TOKEN_APY = 50000; // 500x in a year is extreme but possible for crypto
    const MIN_REASONABLE_TOKEN_APY = -99;

    if (apy > MAX_REASONABLE_TOKEN_APY) {
      confidence = 'low';
      warnings.push(`Extreme token APY of ${apy.toFixed(2)}% - verify price data accuracy`);
    } else if (apy < MIN_REASONABLE_TOKEN_APY) {
      confidence = 'medium';
      warnings.push(`Large token loss of ${apy.toFixed(2)}% - normal crypto volatility`);
    }

    if (days < 7 && Math.abs(apy) > 1000) {
      confidence = 'low';
      warnings.push(`Short period (${days} days) with high APY may not be representative of long-term performance`);
    }

    if (Math.abs(priceReturn) > 500) {
      confidence = 'low';
      warnings.push(`Extreme price movement of ${priceReturn.toFixed(2)}% - verify data quality`);
    }

    return { confidence, warnings };
  }

  /**
   * Format token APY data for display
   */
  static formatTokenAPYForDisplay(tokenAPYs) {
    const formatted = {};
    
    Object.keys(tokenAPYs).forEach(symbol => {
      const apy = tokenAPYs[symbol];
      formatted[symbol] = {
        ...apy,
        displayName: apy.tokenInfo?.name || symbol,
        bestPeriodAPY: this.getBestPeriodAPY(apy),
        riskLevel: this.assessTokenRiskLevel(apy)
      };
    });
    
    return formatted;
  }

  /**
   * Get the best period APY for display
   */
  static getBestPeriodAPY(apyData) {
    const periods = ['monthly', 'weekly', 'daily'];
    
    for (const period of periods) {
      if (apyData[period] && apyData[period].apy !== null && apyData[period].confidence !== 'low') {
        return {
          period,
          apy: apyData[period].apy,
          confidence: apyData[period].confidence
        };
      }
    }
    
    return null;
  }

  /**
   * Assess token risk level based on APY volatility
   */
  static assessTokenRiskLevel(apyData) {
    const periods = ['daily', 'weekly', 'monthly'];
    const apyValues = periods
      .filter(p => apyData[p] && apyData[p].apy !== null)
      .map(p => Math.abs(apyData[p].apy));

    if (apyValues.length === 0) return 'unknown';

    const maxAPY = Math.max(...apyValues);
    const avgAPY = apyValues.reduce((sum, apy) => sum + apy, 0) / apyValues.length;

    if (maxAPY > 1000 || avgAPY > 500) return 'high';
    if (maxAPY > 100 || avgAPY > 50) return 'medium';
    return 'low';
  }
}

module.exports = TokenAPYCalculationService;