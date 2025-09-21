import axios from 'axios';
import { AuthResponse, User, Wallet, PerformanceMetrics, HistoryPoint } from '../types';
import { 
  mockAuthApi, 
  mockWalletApi, 
  mockAnalyticsApi, 
  mockAdminApi 
} from './mockApi';

// Use environment variable or fallback to proxy
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API === 'true' || false;

// Force mock mode for demo purposes
console.log('🔧 API Configuration:', { USE_MOCK_API, API_BASE_URL });

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token') || localStorage.getItem('mock_access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('mock_access_token');
      localStorage.removeItem('mock_current_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Real API implementations
const realAuthApi = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    console.log('API: Attempting login for:', email);
    const response = await api.post('/auth/login', { email, password });
    console.log('API: Raw login response:', response.data);
    
    // Transform backend response to match frontend expectations
    // Handle new standardized API response format
    const apiData = response.data.success ? response.data.data : response.data;
    const transformed = {
      access_token: apiData.token,
      user: {
        id: apiData.user.id,
        username: apiData.user.name,
        email: apiData.user.email,
        role: apiData.user.role
      }
    };
    console.log('API: Transformed login response:', transformed);
    return transformed;
  },

  signup: async (name: string, email: string, password: string): Promise<AuthResponse> => {
    await api.post('/auth/signup', { name, email, password });
    // After successful signup, automatically log the user in
    const loginResponse = await realAuthApi.login(email, password);
    return loginResponse;
  },

  getProfile: async (): Promise<User> => {
    console.log('API: Fetching user profile...');
    const response = await api.get('/auth/profile');
    console.log('API: Raw profile response:', response.data);
    
    // Transform backend response to match frontend expectations
    // Handle new standardized API response format
    const apiData = response.data.success ? response.data.data : response.data;
    const user = apiData.user || apiData;
    const transformed = {
      id: user._id || user.id,
      username: user.name,
      email: user.email,
      role: user.role
    };
    console.log('API: Transformed profile response:', transformed);
    return transformed;
  },

  addWallet: async (address: string): Promise<{ message: string }> => {
    const response = await api.post('/auth/add-wallet', { wallet: address });
    return response.data;
  },

  getAllUsers: async (): Promise<{ message: string; users: any[] }> => {
    const response = await api.get('/auth/all-users');
    return response.data;
  },

  createUser: async (userData: { name: string; email: string; password: string; role: string; wallets?: string[] }): Promise<{ message: string; user: any }> => {
    // Create the user with wallets included in the payload
    const response = await api.post('/auth/create-user', {
      name: userData.name,
      email: userData.email,
      password: userData.password,
      role: userData.role,
      wallets: userData.wallets || [] // Include wallets in the request
    });

    return response.data;
  },

  deleteUser: async (userId: string): Promise<{ message: string; deletedUser: unknown }> => {
    const response = await api.delete(`/auth/delete-user/${userId}`);
    return response.data;
  },
};

const realWalletApi = {
  getWallets: async (): Promise<Wallet[]> => {
    try {
      const response = await api.get('/wallet/wallets');
      console.log('Raw wallet response:', response.data);
      
      // Debug: Log protocols and positions data specifically
      if (response.data.portfolios) {
        response.data.portfolios.forEach((portfolio: any, index: number) => {
          console.log(`\n=== PORTFOLIO ${index + 1} (${portfolio.address}) ===`);
          console.log(`Protocols count: ${portfolio.protocols?.length || 0}`);
          
          portfolio.protocols?.forEach((protocol: any, protocolIndex: number) => {
            console.log(`  Protocol ${protocolIndex + 1}: ${protocol.name}`);
            console.log(`    Net USD Value: $${protocol.net_usd_value}`);
            console.log(`    Positions count: ${protocol.positions?.length || 0}`);
            
            protocol.positions?.forEach((position: any, positionIndex: number) => {
              console.log(`      Position ${positionIndex + 1}: ${position.position_name}`);
              console.log(`        Tokens: ${position.tokens?.length || 0}`);
              console.log(`        Rewards: ${position.rewards?.length || 0}`);
              
              position.tokens?.forEach((token: any) => {
                console.log(`          Token: ${token.symbol} - ${token.amount} ($${token.usd_value})`);
              });
              
              position.rewards?.forEach((reward: any) => {
                console.log(`          Reward: ${reward.symbol} - ${reward.amount} ($${reward.usd_value})`);
              });
            });
          });
        });
      }
      
      // Transform backend response to match frontend expectations
      // Handle new standardized API response format
      const apiData = response.data.success ? response.data.data : response.data;
      const portfolios = apiData.portfolios || [];
      const wallets = portfolios.map((portfolio: any) => ({
        id: portfolio.address,
        address: portfolio.address,
        name: `Wallet ${portfolio.address.slice(0, 6)}...${portfolio.address.slice(-4)}`,
        tokens: portfolio.tokens || [],
        protocols: portfolio.protocols || [],
        totalValue: portfolio.summary?.total_usd_value || 0,
        chainDistribution: (portfolio.tokens || []).reduce((acc: any, token: any) => {
          const chain = token.chain || 'unknown';
          acc[chain] = (acc[chain] || 0) + (token.usd_value || 0);
          return acc;
        }, {}),
        protocolDistribution: (portfolio.protocols || []).reduce((acc: any, protocol: any) => {
          const name = protocol.name || 'Unknown';
          acc[name] = (acc[name] || 0) + (protocol.net_usd_value || 0);
          return acc;
        }, {}),
        performance: {
          daily: 0, // Backend doesn't provide this yet
          weekly: 0,
          monthly: 0,
          yearly: 0
        }
      }));
      
      console.log('Transformed wallets:', wallets);
      return wallets;
    } catch (error) {
      console.error('Error fetching wallets:', error);
      throw error;
    }
  },

  getUserWallets: async (userId: string): Promise<Wallet[]> => {
    try {
      const response = await api.get(`/wallet/wallets?userId=${userId}`);
      console.log('Raw user wallet response:', response.data);
      
      // Transform backend response to match frontend expectations
      // Handle new standardized API response format
      const apiData = response.data.success ? response.data.data : response.data;
      const portfolios = apiData.portfolios || [];
      const wallets = portfolios.map((portfolio: any) => ({
        id: portfolio.address,
        address: portfolio.address,
        name: `Wallet ${portfolio.address.slice(0, 6)}...${portfolio.address.slice(-4)}`,
        tokens: portfolio.tokens || [],
        protocols: portfolio.protocols || [],
        totalValue: portfolio.summary?.total_usd_value || 0,
        chainDistribution: (portfolio.tokens || []).reduce((acc: any, token: any) => {
          const chain = token.chain || 'unknown';
          acc[chain] = (acc[chain] || 0) + (token.usd_value || 0);
          return acc;
        }, {}),
        protocolDistribution: (portfolio.protocols || []).reduce((acc: any, protocol: any) => {
          const name = protocol.name || 'Unknown';
          acc[name] = (acc[name] || 0) + (protocol.net_usd_value || 0);
          return acc;
        }, {}),
        performance: {
          daily: 0, // Backend doesn't provide this yet
          weekly: 0,
          monthly: 0,
          yearly: 0
        }
      }));
      
      console.log('Transformed user wallets:', wallets);
      return wallets;
    } catch (error) {
      console.error('Error fetching user wallets:', error);
      throw error;
    }
  },
};

const realAnalyticsApi = {
  getPortfolioHistory: async (days: number = 30): Promise<HistoryPoint[]> => {
    const response = await api.get(`/analytics/portfolio/history?days=${days}`);
    return response.data;
  },

  getPerformanceMetrics: async (period: number = 30): Promise<PerformanceMetrics> => {
    const response = await api.get(`/analytics/portfolio/performance?period=${period}`);
    return response.data;
  },

  getPositionAPYs: async (period: number = 30, userId?: string): Promise<any> => {
    console.log(`🔥 API: Fetching position APYs from real backend for ${period} days${userId ? ` for user ${userId}` : ''}...`);
    const params = new URLSearchParams();
    params.append('period', period.toString());
    if (userId) {
      params.append('userId', userId);
    }
    const response = await api.get(`/analytics/positions/apy?${params.toString()}`);
    console.log('🔥 API: APY response received:', response.data);
    return response.data;
  },

  getPnLSinceLastReport: async (reportType: 'daily' | 'weekly' | 'monthly' = 'daily'): Promise<any> => {
    console.log(`🔥 API: Fetching PnL Since Last Report (${reportType})...`);
    const response = await api.get(`/analytics/portfolio/pnl?reportType=${reportType}`);
    console.log('🔥 API: PnL response received:', response.data);
    return response.data;
  },

  exportExcel: async (): Promise<Blob> => {
    const response = await api.get('/analytics/export/excel', {
      responseType: 'blob',
    });
    return response.data;
  },
  
  exportMonthlyNav: async (month?: number, year?: number, wallet?: string, userId?: string): Promise<Blob> => {
    const params = new URLSearchParams();
    if (month !== undefined) params.append('month', month.toString());
    if (year !== undefined) params.append('year', year.toString());
    if (wallet) params.append('wallet', wallet);
    if (userId) params.append('userId', userId);
    
    const response = await api.get(`/analytics/export/monthly-nav?${params.toString()}`, {
      responseType: 'blob',
    });
    return response.data;
  },

  // Admin functions to export data for specific users
  exportUserExcel: async (userId: string, wallet?: string): Promise<Blob> => {
    console.log('API: exportUserExcel called with userId:', userId);
    const params = new URLSearchParams();
    params.append('userId', userId);
    if (wallet) params.append('wallet', wallet);
    
    console.log('API: Making request to:', `/analytics/export/excel?${params.toString()}`);
    const response = await api.get(`/analytics/export/excel?${params.toString()}`, {
      responseType: 'blob',
    });
    console.log('API: Response received, blob size:', response.data.size);
    return response.data;
  },

  exportUserMonthlyNav: async (userId: string, month?: number, year?: number, wallet?: string): Promise<Blob> => {
    const params = new URLSearchParams();
    params.append('userId', userId);
    if (month !== undefined) params.append('month', month.toString());
    if (year !== undefined) params.append('year', year.toString());
    if (wallet) params.append('wallet', wallet);
    
    const response = await api.get(`/analytics/export/monthly-nav?${params.toString()}`, {
      responseType: 'blob',
    });
    return response.data;
  },
};

const realAdminApi = {
  collectData: async (): Promise<{ message: string; status: string }> => {
    const response = await api.post('/admin/collect-data');
    // Handle new standardized API response format
    const apiData = response.data.success ? response.data.data : response.data;
    return {
      message: response.data.message || 'Snapshots collected successfully',
      status: 'success',
      ...apiData
    };
  },

  getCollectionStatus: async (): Promise<{ running: boolean; status: string }> => {
    const response = await api.get('/admin/collect-data/status');
    // Handle new standardized API response format
    const apiData = response.data.success ? response.data.data : response.data;
    return apiData;
  },
};

// Export the appropriate API based on environment
export const authApi = USE_MOCK_API ? mockAuthApi : realAuthApi;
export const walletApi = USE_MOCK_API ? mockWalletApi : realWalletApi;
export const analyticsApi = USE_MOCK_API ? mockAnalyticsApi : realAnalyticsApi;
export const adminApi = USE_MOCK_API ? mockAdminApi : realAdminApi;

// Debug logging
console.log('🔧 API Exports:', { 
  authApi: USE_MOCK_API ? 'MOCK' : 'REAL',
  walletApi: USE_MOCK_API ? 'MOCK' : 'REAL',
  analyticsApi: USE_MOCK_API ? 'MOCK' : 'REAL',
  adminApi: USE_MOCK_API ? 'MOCK' : 'REAL'
});

export default api;