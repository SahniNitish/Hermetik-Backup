import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { walletApi, analyticsApi } from '../services/api';
import { Download, Calculator, RefreshCw, Lock, AlertCircle, ChevronDown, Calendar, Save } from 'lucide-react';
import { useUserView } from '../contexts/UserViewContext';
import Card from './UI/Card';
import Button from './UI/Button';
import LoadingSpinner from './UI/LoadingSpinner';

interface NAVCalculatorProps {
  className?: string;
}

interface CalculationParams {
  annualExpense: number;
  monthlyExpense: number;
  priorPreFeeNav: number;
  netFlows: number;
  hurdleRate: number;
  highWaterMark: number;
  performanceFeeRate: number;
  accruedPerformanceFeeRate: number;
}

interface MonthYear {
  month: number;
  year: number;
  monthName: string;
}

const NAVCalculator: React.FC<NAVCalculatorProps> = ({ className = '' }) => {
  const { viewedUser, isViewingAsAdmin } = useUserView();
  const [isCalculating, setIsCalculating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  // Current month/year selection
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  
  // Dropdown states
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [exportMonth, setExportMonth] = useState(currentDate.getMonth() + 1);
  const [exportYear, setExportYear] = useState(currentDate.getFullYear());
  
  // Calculation parameters - editable by admin
  const [params, setParams] = useState<CalculationParams>({
    annualExpense: 600,
    monthlyExpense: 50,
    priorPreFeeNav: 0,
    netFlows: 0,
    hurdleRate: 0,
    highWaterMark: 0,
    performanceFeeRate: 0.25,
    accruedPerformanceFeeRate: 0.25
  });

  // Portfolio values
  const [portfolioData, setPortfolioData] = useState({
    totalTokensValue: 0,
    totalPositionsValue: 0,
    totalRewards: 0
  });

  // Available months for dropdown
  const [availableMonths, setAvailableMonths] = useState<MonthYear[]>([]);

  // Check if user has access (admin viewing a user profile)
  const hasAccess = Boolean(isViewingAsAdmin && viewedUser);

  // Fetch current portfolio data
  const { data: wallets, isLoading: walletsLoading, refetch } = useQuery({
    queryKey: ['wallets', viewedUser?.id],
    queryFn: () => {
      if (viewedUser) {
        return walletApi.getUserWallets(viewedUser.id);
      }
      return walletApi.getWallets();
    },
    refetchInterval: 30000,
    enabled: hasAccess
  });

  // Load NAV settings for selected month/year
  const { data: navSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ['nav-settings', viewedUser?.id, selectedYear, selectedMonth],
    queryFn: async () => {
      if (!viewedUser) return null;
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/analytics/nav-settings/${viewedUser.id}/${selectedYear}/${selectedMonth}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to load NAV settings');
      return response.json();
    },
    enabled: hasAccess
  });

  // Load available months
  useEffect(() => {
    if (hasAccess && viewedUser) {
      loadAvailableMonths();
    }
  }, [hasAccess, viewedUser]);

  const loadAvailableMonths = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/analytics/nav-settings/${viewedUser.id}/available-months`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });
      if (response.ok) {
        const months = await response.json();
        setAvailableMonths(months);
      }
    } catch (error) {
      console.error('Error loading available months:', error);
    }
  };

  // Load saved settings when navSettings changes
  useEffect(() => {
    if (navSettings) {
      setParams(navSettings.feeSettings);
      if (navSettings.portfolioData) {
        setPortfolioData(navSettings.portfolioData);
      }
    }
  }, [navSettings]);

  // Calculate portfolio values when data changes
  useEffect(() => {
    if (wallets && wallets.length > 0) {
      calculatePortfolioValues();
    }
  }, [wallets]);

  const calculatePortfolioValues = () => {
    if (!wallets) return;

    const totalTokensValue = wallets.reduce((sum, wallet) => {
      const tokensValue = (wallet.tokens || []).reduce((tokenSum, token) => 
        tokenSum + (token.usd_value || 0), 0);
      return sum + tokensValue;
    }, 0);

    const totalPositionsValue = wallets.reduce((sum, wallet) => {
      const positionsValue = (wallet.protocols || []).reduce((protocolSum, protocol) => {
        const protocolValue = (protocol.positions || []).reduce((posSum, position) => {
          const positionTokensValue = (position.tokens || []).reduce((tokenSum, token) => 
            tokenSum + (token.usd_value || 0), 0);
          return posSum + positionTokensValue;
        }, 0);
        return protocolSum + protocolValue;
      }, 0);
      return sum + positionsValue;
    }, 0);

    const totalRewards = wallets.reduce((sum, wallet) => {
      const rewardsValue = (wallet.protocols || []).reduce((protocolSum, protocol) => {
        const protocolRewards = (protocol.positions || []).reduce((posSum, position) => {
          const rewardTokensValue = (position.rewards || []).reduce((rewardSum, reward) => 
            rewardSum + (reward.usd_value || 0), 0);
          return posSum + rewardTokensValue;
        }, 0);
        return protocolSum + protocolRewards;
      }, 0);
      return sum + rewardsValue;
    }, 0);

    setPortfolioData({
      totalTokensValue,
      totalPositionsValue,
      totalRewards
    });
  };

  // NAV Calculations
  const calculations = React.useMemo(() => {
    const investments = portfolioData.totalTokensValue + portfolioData.totalPositionsValue - portfolioData.totalRewards;
    const dividendsReceivable = portfolioData.totalRewards;
    const totalAssets = investments + dividendsReceivable;
    const accruedExpenses = params.monthlyExpense;
    const totalLiabilities = accruedExpenses;
    const preFeeNav = totalAssets - accruedExpenses;
    const performance = preFeeNav - params.priorPreFeeNav - params.netFlows;
    const performanceFee = performance > params.hurdleRate ? performance * params.performanceFeeRate : 0;
    const accruedPerformanceFees = dividendsReceivable * params.accruedPerformanceFeeRate;
    const netAssets = preFeeNav - performanceFee - accruedPerformanceFees;

    return {
      investments,
      dividendsReceivable,
      totalAssets,
      accruedExpenses,
      totalLiabilities,
      preFeeNav,
      performance,
      performanceFee,
      accruedPerformanceFees,
      netAssets
    };
  }, [portfolioData, params]);

  // Update parameters
  const updateParam = (key: keyof CalculationParams, value: number) => {
    setParams(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Save NAV settings
  const handleSave = async () => {
    if (!hasAccess) return;

    setIsSaving(true);
    setError('');
    setSuccessMessage('');

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/analytics/nav-settings/${viewedUser.id}/${selectedYear}/${selectedMonth}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({
          feeSettings: params,
          navCalculations: {
            ...calculations,
            priorPreFeeNav: params.priorPreFeeNav,
            netFlows: params.netFlows
          },
          portfolioData
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save NAV settings');
      }

      setSuccessMessage('NAV settings saved successfully!');
      loadAvailableMonths(); // Refresh available months
      
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      console.error('Save error:', err);
      setError(`Save failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Export current NAV report
  const handleExportCurrent = async () => {
    if (!hasAccess) return;

    setIsExporting(true);
    setError('');

    try {
      const queryParams = new URLSearchParams({
        userId: viewedUser.id,
        annualExpense: params.annualExpense.toString(),
        monthlyExpense: params.monthlyExpense.toString(),
        priorPreFeeNav: params.priorPreFeeNav.toString(),
        netFlows: params.netFlows.toString(),
        hurdleRate: params.hurdleRate.toString(),
        highWaterMark: params.highWaterMark.toString(),
        performanceFeeRate: params.performanceFeeRate.toString(),
        accruedPerformanceFeeRate: params.accruedPerformanceFeeRate.toString()
      });

      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/analytics/export/nav-calculator?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }

      const blob = await response.blob();
      
      if (!blob || blob.size === 0) {
        throw new Error('Received empty report from server');
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const filename = `${viewedUser.name.replace(/\s+/g, '_')}_Current_NAV_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
      link.download = filename;
      
      document.body.appendChild(link);
      link.click();
      
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 100);

    } catch (err: any) {
      console.error('Export error:', err);
      setError(`Export failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsExporting(false);
      setShowExportDropdown(false);
    }
  };

  // Export monthly NAV report
  const handleExportMonthly = async () => {
    if (!hasAccess) return;

    setIsExporting(true);
    setError('');

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/analytics/export/nav-monthly/${viewedUser.id}/${exportYear}/${exportMonth}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }

      const blob = await response.blob();
      
      if (!blob || blob.size === 0) {
        throw new Error('Received empty report from server');
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const filename = `${viewedUser.name.replace(/\s+/g, '_')}_NAV_Report_${monthNames[exportMonth - 1]}_${exportYear}.xlsx`;
      link.download = filename;
      
      document.body.appendChild(link);
      link.click();
      
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 100);

    } catch (err: any) {
      console.error('Export error:', err);
      setError(`Export failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsExporting(false);
      setShowExportDropdown(false);
    }
  };

  // Month/Year selection handlers
  const handleMonthYearChange = (month: number, year: number) => {
    setSelectedMonth(month);
    setSelectedYear(year);
  };

  // Generate years for dropdown (current year and 5 years back)
  const availableYears = Array.from({ length: 6 }, (_, i) => currentDate.getFullYear() - i);
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Access control - only admin viewing user profiles
  if (!hasAccess) {
    return (
      <div className={`${className}`}>
        <Card>
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <Lock className="w-16 h-16 text-gray-600 mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Access Restricted</h2>
            <p className="text-gray-400 mb-4">
              NAV Calculator is only available for administrators when viewing user portfolios.
            </p>
            <p className="text-sm text-gray-500">
              Please select a user from the Users page to access this feature.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (walletsLoading || settingsLoading) {
    return (
      <div className={`${className}`}>
        <Card>
          <div className="flex items-center justify-center p-8">
            <LoadingSpinner size="lg" />
            <p className="text-white ml-4">Loading portfolio data...</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Calculator className="w-8 h-8 text-blue-500" />
          <div>
            <h1 className="text-2xl font-bold text-white">NAV Report Calculator</h1>
            <p className="text-gray-400 text-sm">
              Generating NAV report for: <span className="text-white font-medium">{viewedUser?.name}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {/* Month/Year Selector */}
          <div className="flex items-center space-x-2 bg-gray-800 rounded-lg p-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <select
              value={selectedMonth}
              onChange={(e) => handleMonthYearChange(parseInt(e.target.value), selectedYear)}
              className="bg-transparent text-white text-sm border-none outline-none"
            >
              {monthNames.map((month, index) => (
                <option key={index} value={index + 1} className="bg-gray-800">
                  {month}
                </option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => handleMonthYearChange(selectedMonth, parseInt(e.target.value))}
              className="bg-transparent text-white text-sm border-none outline-none"
            >
              {availableYears.map(year => (
                <option key={year} value={year} className="bg-gray-800">
                  {year}
                </option>
              ))}
            </select>
          </div>

          <Button
            onClick={() => refetch()}
            disabled={isCalculating}
            variant="secondary"
            size="sm"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isCalculating ? 'animate-spin' : ''}`} />
            Refresh Data
          </Button>

          <Button
            onClick={handleSave}
            disabled={isSaving}
            variant="secondary"
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>

          {/* Smart Export Dropdown */}
          <div className="relative">
            <Button
              onClick={() => setShowExportDropdown(!showExportDropdown)}
              variant="primary"
              className="bg-green-600 hover:bg-green-700"
            >
              <Download className="w-4 h-4 mr-2" />
              Export NAV Report
              <ChevronDown className="w-4 h-4 ml-2" />
            </Button>

            {showExportDropdown && (
              <div className="absolute right-0 mt-2 w-80 bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-50">
                <div className="p-4">
                  {/* Current Export */}
                  <div className="border-b border-gray-600 pb-3 mb-3">
                    <h3 className="text-white font-medium mb-2">Current Report</h3>
                    <p className="text-gray-400 text-sm mb-3">
                      Export current live calculations
                    </p>
                    <Button
                      onClick={handleExportCurrent}
                      disabled={isExporting}
                      variant="primary"
                      size="sm"
                      className="w-full bg-green-600 hover:bg-green-700"
                    >
                      {isExporting ? 'Exporting...' : 'Export Current'}
                    </Button>
                  </div>

                  {/* Monthly Reports */}
                  <div>
                    <h3 className="text-white font-medium mb-2">Monthly Reports</h3>
                    <p className="text-gray-400 text-sm mb-3">
                      Export saved monthly NAV reports
                    </p>
                    
                    <div className="flex space-x-2 mb-3">
                      <select
                        value={exportMonth}
                        onChange={(e) => setExportMonth(parseInt(e.target.value))}
                        className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                      >
                        {monthNames.map((month, index) => (
                          <option key={index} value={index + 1}>
                            {month}
                          </option>
                        ))}
                      </select>
                      <select
                        value={exportYear}
                        onChange={(e) => setExportYear(parseInt(e.target.value))}
                        className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                      >
                        {availableYears.map(year => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </select>
                    </div>

                    <Button
                      onClick={handleExportMonthly}
                      disabled={isExporting}
                      variant="secondary"
                      size="sm"
                      className="w-full"
                    >
                      {isExporting ? 'Exporting...' : `Export ${monthNames[exportMonth - 1]} ${exportYear}`}
                    </Button>

                    {/* Available Months List */}
                    {availableMonths.length > 0 && (
                      <div className="mt-3">
                        <p className="text-gray-400 text-xs mb-2">Available months:</p>
                        <div className="max-h-20 overflow-y-auto text-xs text-gray-300">
                          {availableMonths.map((month, index) => (
                            <div key={index} className="py-1">
                              {month.monthName} {month.year}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="bg-green-900/50 border border-green-500 rounded-lg p-4 flex items-center">
          <div className="w-5 h-5 text-green-400 mr-3">✓</div>
          <p className="text-green-400 text-sm">{successMessage}</p>
        </div>
      )}

      {error && (
        <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 flex items-center">
          <AlertCircle className="w-5 h-5 text-red-400 mr-3" />
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Excel-Style NAV Report */}
      <Card>
        <div className="space-y-6">
          {/* Report Header */}
          <div className="border-b border-gray-700 pb-4">
            <h2 className="text-xl font-bold text-white mb-2">
              MONTHLY NAV REPORT - {monthNames[selectedMonth - 1]} {selectedYear}
            </h2>
            <div className="text-sm text-gray-400 space-y-1">
              <p><strong>VALUATION DATE:</strong> {monthNames[selectedMonth - 1]} {selectedYear}</p>
              <p>All values in USD as of 12:00 pm UTC on the Valuation date.</p>
              <p>For more information on valuation methodology please see the Investment Management Agreement.</p>
            </div>
          </div>

          {/* Excel-style Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-800">
                  <th className="border border-gray-600 p-3 text-left text-white font-bold w-1/4">Section</th>
                  <th className="border border-gray-600 p-3 text-left text-white font-bold w-1/2">Line Item</th>
                  <th className="border border-gray-600 p-3 text-right text-white font-bold w-1/4">Value</th>
                </tr>
              </thead>
              <tbody>
                {/* ASSETS Section */}
                <tr className="bg-blue-900/30">
                  <td colSpan={3} className="border border-gray-600 p-3 text-white font-bold text-center">
                    ASSETS
                  </td>
                </tr>
                <tr className="hover:bg-gray-800/50">
                  <td className="border border-gray-600 p-3 text-gray-400"></td>
                  <td className="border border-gray-600 p-3 text-white">Investments at fair value (securities)</td>
                  <td className="border border-gray-600 p-3 text-right text-green-400 font-mono">
                    ${calculations.investments.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr className="hover:bg-gray-800/50">
                  <td className="border border-gray-600 p-3 text-gray-400"></td>
                  <td className="border border-gray-600 p-3 text-white">Cash & cash equivalents</td>
                  <td className="border border-gray-600 p-3 text-right text-green-400 font-mono">
                    $0.00
                  </td>
                </tr>
                <tr className="hover:bg-gray-800/50">
                  <td className="border border-gray-600 p-3 text-gray-400"></td>
                  <td className="border border-gray-600 p-3 text-white">Dividends and interest receivable</td>
                  <td className="border border-gray-600 p-3 text-right text-green-400 font-mono">
                    ${calculations.dividendsReceivable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr className="hover:bg-gray-800/50">
                  <td className="border border-gray-600 p-3 text-gray-400"></td>
                  <td className="border border-gray-600 p-3 text-white">Receivables for investments sold</td>
                  <td className="border border-gray-600 p-3 text-right text-green-400 font-mono">$0.00</td>
                </tr>
                <tr className="hover:bg-gray-800/50">
                  <td className="border border-gray-600 p-3 text-gray-400"></td>
                  <td className="border border-gray-600 p-3 text-white">Other assets</td>
                  <td className="border border-gray-600 p-3 text-right text-green-400 font-mono">$0.00</td>
                </tr>
                <tr className="bg-green-900/30 font-bold">
                  <td className="border border-gray-600 p-3 text-white">Total Assets</td>
                  <td className="border border-gray-600 p-3 text-white"></td>
                  <td className="border border-gray-600 p-3 text-right text-green-400 font-mono text-lg">
                    ${calculations.totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>

                {/* Empty row */}
                <tr>
                  <td colSpan={3} className="p-2"></td>
                </tr>

                {/* LIABILITIES Section */}
                <tr className="bg-red-900/30">
                  <td colSpan={3} className="border border-gray-600 p-3 text-white font-bold text-center">
                    LIABILITIES
                  </td>
                </tr>
                <tr className="hover:bg-gray-800/50">
                  <td className="border border-gray-600 p-3 text-gray-400"></td>
                  <td className="border border-gray-600 p-3 text-white">Payables for investments purchased</td>
                  <td className="border border-gray-600 p-3 text-right text-red-400 font-mono">$0.00</td>
                </tr>
                <tr className="hover:bg-gray-800/50">
                  <td className="border border-gray-600 p-3 text-gray-400"></td>
                  <td className="border border-gray-600 p-3 text-white">Accrued management fees</td>
                  <td className="border border-gray-600 p-3 text-right text-red-400 font-mono">$0.00</td>
                </tr>
                <tr className="hover:bg-gray-800/50 bg-yellow-900/20">
                  <td className="border border-gray-600 p-3 text-gray-400"></td>
                  <td className="border border-gray-600 p-3 text-white">
                    Accrued fund expenses
                    <div className="text-xs text-gray-400 mt-1">
                      <input
                        type="number"
                        value={params.monthlyExpense || 0}
                        onChange={(e) => updateParam('monthlyExpense', parseFloat(e.target.value) || 0)}
                        className="w-20 bg-gray-700 border border-gray-500 rounded px-2 py-1 text-white text-xs"
                        placeholder="50"
                      />
                      /month
                    </div>
                  </td>
                  <td className="border border-gray-600 p-3 text-right text-red-400 font-mono">
                    ${calculations.accruedExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr className="hover:bg-gray-800/50">
                  <td className="border border-gray-600 p-3 text-gray-400"></td>
                  <td className="border border-gray-600 p-3 text-white">Distribution payable</td>
                  <td className="border border-gray-600 p-3 text-right text-red-400 font-mono">$0.00</td>
                </tr>
                <tr className="hover:bg-gray-800/50">
                  <td className="border border-gray-600 p-3 text-gray-400"></td>
                  <td className="border border-gray-600 p-3 text-white">Other liabilities</td>
                  <td className="border border-gray-600 p-3 text-right text-red-400 font-mono">$0.00</td>
                </tr>
                <tr className="bg-red-900/30 font-bold">
                  <td className="border border-gray-600 p-3 text-white">Total Liabilities</td>
                  <td className="border border-gray-600 p-3 text-white"></td>
                  <td className="border border-gray-600 p-3 text-right text-red-400 font-mono text-lg">
                    ${calculations.totalLiabilities.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>

                {/* Empty row */}
                <tr>
                  <td colSpan={3} className="p-2"></td>
                </tr>

                {/* NAV Calculations */}
                <tr className="bg-blue-900/40 font-bold">
                  <td className="border border-gray-600 p-3 text-white"></td>
                  <td className="border border-gray-600 p-3 text-white">Pre-Fee Ending NAV</td>
                  <td className="border border-gray-600 p-3 text-right text-blue-400 font-mono text-lg">
                    ${calculations.preFeeNav.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr className="bg-yellow-900/30 hover:bg-yellow-900/40">
                  <td className="border border-gray-600 p-3 text-gray-400"></td>
                  <td className="border border-gray-600 p-3 text-white">
                    Accrued performance fees
                    <div className="text-xs text-gray-400 mt-1">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="1"
                        value={params.accruedPerformanceFeeRate || 0}
                        onChange={(e) => updateParam('accruedPerformanceFeeRate', parseFloat(e.target.value) || 0)}
                        className="w-16 bg-gray-700 border border-gray-500 rounded px-2 py-1 text-white text-xs"
                        placeholder="0.25"
                      />
                      % of dividends
                    </div>
                  </td>
                  <td className="border border-gray-600 p-3 text-right text-yellow-400 font-mono">
                    ${calculations.accruedPerformanceFees.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr className="bg-purple-900/40 font-bold text-xl">
                  <td className="border border-gray-600 p-4 text-white"></td>
                  <td className="border border-gray-600 p-4 text-white">NET ASSETS</td>
                  <td className="border border-gray-600 p-4 text-right text-purple-400 font-mono">
                    ${calculations.netAssets.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>

                {/* Empty row */}
                <tr>
                  <td colSpan={3} className="p-3"></td>
                </tr>

                {/* PERFORMANCE FEE CALCULATION Section */}
                <tr className="bg-purple-900/30">
                  <td colSpan={3} className="border border-gray-600 p-3 text-white font-bold text-center">
                    PERFORMANCE FEE CALCULATION
                  </td>
                </tr>
                <tr className="bg-yellow-900/20 hover:bg-yellow-900/30">
                  <td className="border border-gray-600 p-3 text-gray-400"></td>
                  <td className="border border-gray-600 p-3 text-white">
                    Prior period Pre-Fee Ending NAV
                    <div className="text-xs text-gray-400 mt-1">
                      <input
                        type="number"
                        value={params.priorPreFeeNav || 0}
                        onChange={(e) => updateParam('priorPreFeeNav', parseFloat(e.target.value) || 0)}
                        className="w-24 bg-gray-700 border border-gray-500 rounded px-2 py-1 text-white text-xs"
                        placeholder="0"
                      />
                    </div>
                  </td>
                  <td className="border border-gray-600 p-3 text-right text-white font-mono">
                    ${(params.priorPreFeeNav || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr className="bg-yellow-900/20 hover:bg-yellow-900/30">
                  <td className="border border-gray-600 p-3 text-gray-400"></td>
                  <td className="border border-gray-600 p-3 text-white">
                    Net Flows
                    <div className="text-xs text-gray-400 mt-1">
                      <input
                        type="number"
                        value={params.netFlows || 0}
                        onChange={(e) => updateParam('netFlows', parseFloat(e.target.value) || 0)}
                        className="w-24 bg-gray-700 border border-gray-500 rounded px-2 py-1 text-white text-xs"
                        placeholder="0"
                      />
                    </div>
                  </td>
                  <td className="border border-gray-600 p-3 text-right text-white font-mono">
                    ${(params.netFlows || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr className="hover:bg-gray-800/50">
                  <td className="border border-gray-600 p-3 text-gray-400"></td>
                  <td className="border border-gray-600 p-3 text-white">Current period Pre-Fee Ending NAV</td>
                  <td className="border border-gray-600 p-3 text-right text-blue-400 font-mono">
                    ${calculations.preFeeNav.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr className="bg-green-900/30 hover:bg-green-900/40">
                  <td className="border border-gray-600 p-3 text-gray-400"></td>
                  <td className="border border-gray-600 p-3 text-white font-bold">Performance</td>
                  <td className="border border-gray-600 p-3 text-right text-green-400 font-mono font-bold">
                    ${calculations.performance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr className="bg-yellow-900/20 hover:bg-yellow-900/30">
                  <td className="border border-gray-600 p-3 text-gray-400"></td>
                  <td className="border border-gray-600 p-3 text-white">
                    Hurdle Rate
                    <div className="text-xs text-gray-400 mt-1">
                      <input
                        type="number"
                        value={params.hurdleRate || 0}
                        onChange={(e) => updateParam('hurdleRate', parseFloat(e.target.value) || 0)}
                        className="w-20 bg-gray-700 border border-gray-500 rounded px-2 py-1 text-white text-xs"
                        placeholder="0"
                      />
                    </div>
                  </td>
                  <td className="border border-gray-600 p-3 text-right text-white font-mono">
                    ${(params.hurdleRate || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr className="bg-yellow-900/20 hover:bg-yellow-900/30">
                  <td className="border border-gray-600 p-3 text-gray-400"></td>
                  <td className="border border-gray-600 p-3 text-white">
                    High Water Mark
                    <div className="text-xs text-gray-400 mt-1">
                      <input
                        type="number"
                        value={params.highWaterMark || 0}
                        onChange={(e) => updateParam('highWaterMark', parseFloat(e.target.value) || 0)}
                        className="w-20 bg-gray-700 border border-gray-500 rounded px-2 py-1 text-white text-xs"
                        placeholder="0"
                      />
                    </div>
                  </td>
                  <td className="border border-gray-600 p-3 text-right text-white font-mono">
                    ${(params.highWaterMark || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr className="bg-red-900/30 hover:bg-red-900/40">
                  <td className="border border-gray-600 p-3 text-gray-400"></td>
                  <td className="border border-gray-600 p-3 text-white">
                    Performance Fee
                    <div className="text-xs text-gray-400 mt-1">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="1"
                        value={params.performanceFeeRate || 0}
                        onChange={(e) => updateParam('performanceFeeRate', parseFloat(e.target.value) || 0)}
                        className="w-16 bg-gray-700 border border-gray-500 rounded px-2 py-1 text-white text-xs"
                        placeholder="0.25"
                      />
                      % of excess performance
                    </div>
                  </td>
                  <td className="border border-gray-600 p-3 text-right text-red-400 font-mono">
                    ${calculations.performanceFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr className="bg-yellow-900/30 hover:bg-yellow-900/40">
                  <td className="border border-gray-600 p-3 text-gray-400"></td>
                  <td className="border border-gray-600 p-3 text-white">Accrued Performance Fees</td>
                  <td className="border border-gray-600 p-3 text-right text-yellow-400 font-mono">
                    ${calculations.accruedPerformanceFees.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {/* Portfolio Data Summary */}
      <Card>
        <h3 className="text-lg font-semibold text-white mb-4 border-b border-gray-700 pb-2">
          Current Portfolio Breakdown
        </h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="bg-gray-800 p-3 rounded">
            <p className="text-gray-400">Token Holdings</p>
            <p className="text-green-400 font-mono text-lg">
              ${portfolioData.totalTokensValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-gray-800 p-3 rounded">
            <p className="text-gray-400">DeFi Positions</p>
            <p className="text-purple-400 font-mono text-lg">
              ${portfolioData.totalPositionsValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-gray-800 p-3 rounded">
            <p className="text-gray-400">Unclaimed Rewards</p>
            <p className="text-yellow-400 font-mono text-lg">
              ${portfolioData.totalRewards.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </Card>

      {/* Close dropdown when clicking outside */}
      {showExportDropdown && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowExportDropdown(false)}
        />
      )}
    </div>
  );
};

export default NAVCalculator;