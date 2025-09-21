import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useUserView } from './UserViewContext';

interface NAVData {
  netFlows: number;
  walletNetFlows: Record<string, number>;
  totalNetFlows: number;
  priorPreFeeNav: number;
  currentPreFeeNav: number;
  performance: number;
  version?: number;
}

interface VolatilityMetrics {
  annualizedVolatility: number;
  standardDeviation: number;
  monthlyReturns: number[];
  monthsOfData: number;
  lastCalculated: string;
}

interface MonthlyNavEntry {
  date: string;
  nav: number;
  monthlyReturn: number | null;
}

interface NAVContextType {
  navData: NAVData;
  volatilityMetrics: VolatilityMetrics | null;
  monthlyHistory: MonthlyNavEntry[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  updateNetFlows: (netFlows: number) => Promise<void>;
  updateWalletNetFlows: (walletAddress: string, netFlows: number) => Promise<void>;
  updateNAVData: (data: Partial<Omit<NAVData, 'version'>>) => Promise<void>;
  addMonthlyNav: (date: string, nav: number) => Promise<void>;
  refreshVolatility: () => Promise<void>;
  resetNAVData: () => Promise<void>;
}

const NAVContext = createContext<NAVContextType | undefined>(undefined);

export const useNAV = () => {
  const context = useContext(NAVContext);
  if (context === undefined) {
    throw new Error('useNAV must be used within a NAVProvider');
  }
  return context;
};

interface NAVProviderProps {
  children: ReactNode;
}

const API_BASE_URL = 'http://23.20.137.235:3001/api';

// API functions
const navAPI = {
  get: async (viewedUserId?: string): Promise<{
    navData: NAVData;
    volatilityMetrics: VolatilityMetrics;
    monthlyHistory: MonthlyNavEntry[];
  }> => {
    const token = localStorage.getItem('access_token');
    const params = viewedUserId ? { userId: viewedUserId } : {};
    console.log('🔥 NAV API: Fetching NAV data with params:', { viewedUserId, params });
    const response = await axios.get(`${API_BASE_URL}/nav`, {
      headers: { Authorization: `Bearer ${token}` },
      params
    });
    console.log('🔥 NAV API: NAV data response:', response.data);
    return response.data.data;
  },

  updateNetFlows: async (netFlows: number, viewedUserId?: string): Promise<NAVData> => {
    const token = localStorage.getItem('access_token');
    const data = viewedUserId ? { netFlows, userId: viewedUserId } : { netFlows };
    const response = await axios.post(`${API_BASE_URL}/nav/netflows`, 
      data,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data.data;
  },

  updateWalletNetFlows: async (walletAddress: string, netFlows: number, viewedUserId?: string): Promise<NAVData> => {
    const token = localStorage.getItem('access_token');
    const data = viewedUserId ? { walletAddress, netFlows, userId: viewedUserId } : { walletAddress, netFlows };
    const response = await axios.post(`${API_BASE_URL}/nav/wallet-netflows`, 
      data,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data.data;
  },

  updateValues: async (values: Partial<Omit<NAVData, 'version'>>): Promise<{
    navData: NAVData;
    volatilityMetrics: VolatilityMetrics;
  }> => {
    const token = localStorage.getItem('access_token');
    const response = await axios.post(`${API_BASE_URL}/nav/values`, 
      values,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data.data;
  },

  addMonthlyNav: async (date: string, nav: number): Promise<{
    monthlyHistory: MonthlyNavEntry[];
    volatilityMetrics: VolatilityMetrics;
  }> => {
    const token = localStorage.getItem('access_token');
    const response = await axios.post(`${API_BASE_URL}/nav/monthly`, 
      { date, nav },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data.data;
  },

  getVolatility: async (): Promise<VolatilityMetrics & {
    monthlyHistory: MonthlyNavEntry[];
    calculation: any;
  }> => {
    const token = localStorage.getItem('access_token');
    const response = await axios.get(`${API_BASE_URL}/nav/volatility`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data.data;
  },

  reset: async (): Promise<void> => {
    const token = localStorage.getItem('access_token');
    await axios.delete(`${API_BASE_URL}/nav/reset`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }
};

export const NAVProvider: React.FC<NAVProviderProps> = ({ children }) => {
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { viewedUser } = useUserView();

  // Query for NAV data - user-specific
  const { 
    data: navResponse, 
    isLoading, 
    error: queryError 
  } = useQuery({
    queryKey: ['navData', viewedUser?.id],
    queryFn: () => navAPI.get(viewedUser?.id),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    retry: 3,
    enabled: true, // Always enabled
    onSuccess: (data) => {
      console.log('🔥 NAVContext: NAV data fetched successfully:', data);
    },
    onError: (err: any) => {
      console.error('Failed to fetch NAV data:', err);
      setError(err.response?.data?.message || 'Failed to fetch NAV data');
    }
  });

  // Mutations
  const updateNetFlowsMutation = useMutation({
    mutationFn: ({ netFlows, viewedUserId }: { netFlows: number; viewedUserId?: string }) => 
      navAPI.updateNetFlows(netFlows, viewedUserId),
    onSuccess: (data) => {
      // Update the cached data
      queryClient.setQueryData(['navData'], (old: any) => ({
        ...old,
        navData: {
          ...old?.navData,
          netFlows: data.netFlows,
          version: data.version
        }
      }));
      
      // Invalidate wallet data cache since net flows affect dashboard
      queryClient.invalidateQueries(['walletData']);
      
      setError(null);
    },
    onError: (err: any) => {
      console.error('Failed to update net flows:', err);
      setError(err.response?.data?.message || 'Failed to update net flows');
    }
  });

  const updateWalletNetFlowsMutation = useMutation({
    mutationFn: ({ walletAddress, netFlows, viewedUserId }: { walletAddress: string; netFlows: number; viewedUserId?: string }) => 
      navAPI.updateWalletNetFlows(walletAddress, netFlows, viewedUserId),
    onSuccess: (data) => {
      // Update the cached data
      queryClient.setQueryData(['navData'], (old: any) => ({
        ...old,
        navData: {
          ...old?.navData,
          walletNetFlows: {
            ...old?.navData?.walletNetFlows,
            [data.walletAddress]: data.netFlows
          },
          totalNetFlows: data.totalNetFlows,
          version: data.version
        }
      }));
      
      // Invalidate wallet data cache since net flows affect dashboard
      queryClient.invalidateQueries(['walletData']);
      
      setError(null);
    },
    onError: (err: any) => {
      console.error('Failed to update wallet net flows:', err);
      setError(err.response?.data?.message || 'Failed to update wallet net flows');
    }
  });

  const updateValuesMutation = useMutation({
    mutationFn: navAPI.updateValues,
    onSuccess: (data) => {
      queryClient.setQueryData(['navData'], (old: any) => ({
        ...old,
        navData: data.navData,
        volatilityMetrics: data.volatilityMetrics
      }));
      setError(null);
    },
    onError: (err: any) => {
      console.error('Failed to update NAV values:', err);
      setError(err.response?.data?.message || 'Failed to update NAV values');
    }
  });

  const addMonthlyNavMutation = useMutation({
    mutationFn: ({ date, nav }: { date: string; nav: number }) => 
      navAPI.addMonthlyNav(date, nav),
    onSuccess: (data) => {
      queryClient.setQueryData(['navData'], (old: any) => ({
        ...old,
        monthlyHistory: data.monthlyHistory,
        volatilityMetrics: data.volatilityMetrics
      }));
      setError(null);
    },
    onError: (err: any) => {
      console.error('Failed to add monthly NAV:', err);
      setError(err.response?.data?.message || 'Failed to add monthly NAV');
    }
  });

  const resetMutation = useMutation({
    mutationFn: navAPI.reset,
    onSuccess: () => {
      queryClient.invalidateQueries(['navData']);
      setError(null);
    },
    onError: (err: any) => {
      console.error('Failed to reset NAV data:', err);
      setError(err.response?.data?.message || 'Failed to reset NAV data');
    }
  });

  // Context value
  const contextValue: NAVContextType = {
    navData: navResponse?.navData || {
      netFlows: 0,
      walletNetFlows: {},
      totalNetFlows: 0,
      priorPreFeeNav: 0,
      currentPreFeeNav: 0,
      performance: 0
    },
    volatilityMetrics: navResponse?.volatilityMetrics || null,
    monthlyHistory: navResponse?.monthlyHistory || [],
    isLoading,
    error: error || (queryError as any)?.response?.data?.message || null,

    // Actions
    updateNetFlows: async (netFlows: number) => {
      await updateNetFlowsMutation.mutateAsync({ netFlows, viewedUserId: viewedUser?.id });
    },

    updateWalletNetFlows: async (walletAddress: string, netFlows: number) => {
      await updateWalletNetFlowsMutation.mutateAsync({ walletAddress, netFlows, viewedUserId: viewedUser?.id });
    },

    updateNAVData: async (data: Partial<Omit<NAVData, 'version'>>) => {
      await updateValuesMutation.mutateAsync(data);
    },

    addMonthlyNav: async (date: string, nav: number) => {
      await addMonthlyNavMutation.mutateAsync({ date, nav });
    },

    refreshVolatility: async () => {
      const volatilityData = await navAPI.getVolatility();
      queryClient.setQueryData(['navData'], (old: any) => ({
        ...old,
        volatilityMetrics: {
          annualizedVolatility: volatilityData.annualizedVolatility,
          standardDeviation: volatilityData.standardDeviation,
          monthlyReturns: volatilityData.monthlyReturns,
          monthsOfData: volatilityData.monthsOfData,
          lastCalculated: volatilityData.lastCalculated
        },
        monthlyHistory: volatilityData.monthlyHistory
      }));
    },

    resetNAVData: async () => {
      await resetMutation.mutateAsync();
    }
  };

  // Effect to handle authentication changes
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      // Clear NAV data when logged out
      queryClient.removeQueries(['navData']);
    }
  }, [queryClient]);

  return (
    <NAVContext.Provider value={contextValue}>
      {children}
    </NAVContext.Provider>
  );
};

export default NAVProvider;
