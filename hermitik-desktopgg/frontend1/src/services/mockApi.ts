import { 
  mockUsers, 
  mockWallets, 
  mockPerformanceMetrics, 
  mockPortfolioHistory,
  getWalletsForUser,
  findUserByCredentials,
  findUserById,
  userWallets
} from '../data/mockData';
import { AuthResponse, User, Wallet, PerformanceMetrics, HistoryPoint } from '../types';

// Simulate API delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Mock localStorage for tokens
const MOCK_TOKEN_KEY = 'mock_access_token';
const MOCK_USER_KEY = 'mock_current_user';

export const mockAuthApi = {
  login: async (username: string, password: string): Promise<AuthResponse> => {
    console.log('🎭 MOCK API: Login attempt for:', username);
    await delay(800); // Simulate network delay
    
    const user = findUserByCredentials(username, password);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const token = `mock_token_${user.id}_${Date.now()}`;
    localStorage.setItem(MOCK_TOKEN_KEY, token);
    localStorage.setItem(MOCK_USER_KEY, JSON.stringify(user));

    return {
      access_token: token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        created_at: user.created_at,
        role: user.role
      }
    };
  },

  signup: async (username: string, email: string, password: string): Promise<AuthResponse> => {
    await delay(1000);
    
    // Check if user already exists
    const existingUser = mockUsers.find(u => u.username === username || u.email === email);
    if (existingUser) {
      throw new Error('User already exists');
    }

    // Create new user
    const newUser = {
      id: String(mockUsers.length + 1),
      username,
      email,
      password,
      created_at: new Date().toISOString()
    };

    mockUsers.push(newUser);
    userWallets[newUser.id] = []; // Initialize empty wallet list

    const token = `mock_token_${newUser.id}_${Date.now()}`;
    localStorage.setItem(MOCK_TOKEN_KEY, token);
    localStorage.setItem(MOCK_USER_KEY, JSON.stringify(newUser));

    return {
      access_token: token,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        created_at: newUser.created_at
      }
    };
  },

  getProfile: async (): Promise<User> => {
    await delay(300);
    
    const token = localStorage.getItem(MOCK_TOKEN_KEY);
    if (!token) {
      throw new Error('No token found');
    }

    const userStr = localStorage.getItem(MOCK_USER_KEY);
    if (!userStr) {
      throw new Error('No user found');
    }

    const user = JSON.parse(userStr);
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      created_at: user.created_at
    };
  },

  addWallet: async (address: string): Promise<{ message: string }> => {
    await delay(500);
    
    const userStr = localStorage.getItem(MOCK_USER_KEY);
    if (!userStr) {
      throw new Error('User not found');
    }

    const user = JSON.parse(userStr);
    
    // Check if wallet already exists for this user
    if (userWallets[user.id]?.includes(address)) {
      throw new Error('Wallet already added');
    }

    // Add wallet to user's wallet list
    if (!userWallets[user.id]) {
      userWallets[user.id] = [];
    }
    userWallets[user.id].push(address);

    // If this is a new wallet address, create mock data for it
    if (!mockWallets.find(w => w.address === address)) {
      
      // Calculate values
      ({
        address,
        tokens: [
          {
            symbol: 'ETH',
            name: 'Ethereum',
            amount: Math.random() * 5,
            price: 2340.50,
            usd_value: 0,
            chain: 'ethereum',
            logo_url: 'https://cryptologos.cc/logos/ethereum-eth-logo.png'
          }
        ],
        protocols: [],
        summary: {
          total_usd_value: 0,
          token_usd_value: 0,
          protocol_usd_value: 0
        }
      }).tokens[0].usd_value = ({
        address,
        tokens: [
          {
            symbol: 'ETH',
            name: 'Ethereum',
            amount: Math.random() * 5,
            price: 2340.50,
            usd_value: 0,
            chain: 'ethereum',
            logo_url: 'https://cryptologos.cc/logos/ethereum-eth-logo.png'
          }
        ],
        protocols: [],
        summary: {
          total_usd_value: 0,
          token_usd_value: 0,
          protocol_usd_value: 0
        }
      }).tokens[0].amount * ({
        address,
        tokens: [
          {
            symbol: 'ETH',
            name: 'Ethereum',
            amount: Math.random() * 5,
            price: 2340.50,
            usd_value: 0,
            chain: 'ethereum',
            logo_url: 'https://cryptologos.cc/logos/ethereum-eth-logo.png'
          }
        ],
        protocols: [],
        summary: {
          total_usd_value: 0,
          token_usd_value: 0,
          protocol_usd_value: 0
        }
      }).tokens[0].price;
      ({
        address,
        tokens: [
          {
            symbol: 'ETH',
            name: 'Ethereum',
            amount: Math.random() * 5,
            price: 2340.50,
            usd_value: 0,
            chain: 'ethereum',
            logo_url: 'https://cryptologos.cc/logos/ethereum-eth-logo.png'
          }
        ],
        protocols: [],
        summary: {
          total_usd_value: 0,
          token_usd_value: 0,
          protocol_usd_value: 0
        }
      }).summary.token_usd_value = ({
        address,
        tokens: [
          {
            symbol: 'ETH',
            name: 'Ethereum',
            amount: Math.random() * 5,
            price: 2340.50,
            usd_value: 0,
            chain: 'ethereum',
            logo_url: 'https://cryptologos.cc/logos/ethereum-eth-logo.png'
          }
        ],
        protocols: [],
        summary: {
          total_usd_value: 0,
          token_usd_value: 0,
          protocol_usd_value: 0
        }
      }).tokens[0].usd_value;
      ({
        address,
        tokens: [
          {
            symbol: 'ETH',
            name: 'Ethereum',
            amount: Math.random() * 5,
            price: 2340.50,
            usd_value: 0,
            chain: 'ethereum',
            logo_url: 'https://cryptologos.cc/logos/ethereum-eth-logo.png'
          }
        ],
        protocols: [],
        summary: {
          total_usd_value: 0,
          token_usd_value: 0,
          protocol_usd_value: 0
        }
      }).summary.total_usd_value = ({
        address,
        tokens: [
          {
            symbol: 'ETH',
            name: 'Ethereum',
            amount: Math.random() * 5,
            price: 2340.50,
            usd_value: 0,
            chain: 'ethereum',
            logo_url: 'https://cryptologos.cc/logos/ethereum-eth-logo.png'
          }
        ],
        protocols: [],
        summary: {
          total_usd_value: 0,
          token_usd_value: 0,
          protocol_usd_value: 0
        }
      }).summary.token_usd_value;
      
      mockWallets.push({
          address,
          tokens: [
            {
              symbol: 'ETH',
              name: 'Ethereum',
              amount: Math.random() * 5,
              price: 2340.50,
              usd_value: 0,
              chain: 'ethereum',
              logo_url: 'https://cryptologos.cc/logos/ethereum-eth-logo.png'
            }
          ],
          protocols: [],
          summary: {
            total_usd_value: 0,
            token_usd_value: 0,
            protocol_usd_value: 0
          }
        });
    }

    return { message: 'Wallet added successfully' };
  },

  getAllUsers: async (): Promise<{ message: string; users: any[] }> => {
    await delay(500);
    
    // Transform mockUsers to match backend response format
    const transformedUsers = mockUsers.map(user => ({
      id: user.id,
      name: user.username, // Backend uses "name", frontend shows as "name" 
      email: user.email,
      role: user.role || 'user',
      createdAt: user.created_at,
      updatedAt: user.created_at,
      wallets: userWallets[user.id] || []
    }));

    return {
      message: 'All users retrieved successfully',
      users: transformedUsers
    };
  },

  createUser: async (userData: { name: string; email: string; password: string; role: string; wallets?: string[] }): Promise<{ message: string; user: any }> => {
    await delay(800);
    
    // Check if email already exists
    const existingUser = mockUsers.find(user => user.email === userData.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Create new user ID
    const newId = (mockUsers.length + 1).toString();
    
    // Add user to mock data
    const newUser = {
      id: newId,
      username: userData.name,
      email: userData.email,
      password: userData.password,
      created_at: new Date().toISOString(),
      role: userData.role || 'user'
    };
    
    mockUsers.push(newUser);

    // Add wallet addresses if provided
    if (userData.wallets && userData.wallets.length > 0) {
      userWallets[newId] = userData.wallets;
    }

    return {
      message: 'User created successfully',
      user: {
        id: newId,
        name: userData.name,
        email: userData.email,
        role: userData.role || 'user',
        createdAt: newUser.created_at,
        updatedAt: newUser.created_at,
        wallets: userData.wallets || []
      }
    };
  },

  deleteUser: async (userId: string): Promise<{ message: string; deletedUser: unknown }> => {
    await delay(800);
    
    // Find user to delete
    const userIndex = mockUsers.findIndex(user => user.id === userId);
    if (userIndex === -1) {
      throw new Error('User not found');
    }
    
    const userToDelete = mockUsers[userIndex];
    
    // Prevent deleting admin accounts
    if (userToDelete.role === 'admin') {
      throw new Error('Cannot delete admin accounts');
    }
    
    // Remove user from array
    mockUsers.splice(userIndex, 1);
    
    // Clean up user wallets
    delete userWallets[userId];
    
    return {
      message: 'User deleted successfully',
      deletedUser: {
        id: userToDelete.id,
        name: userToDelete.username,
        email: userToDelete.email,
        role: userToDelete.role
      }
    };
  }
};

export const mockWalletApi = {
  getWallets: async (): Promise<Wallet[]> => {
    await delay(600);
    
    const userStr = localStorage.getItem(MOCK_USER_KEY);
    if (!userStr) {
      throw new Error('User not found');
    }

    const user = JSON.parse(userStr);
    return getWalletsForUser(user.id);
  },

  getUserWallets: async (userId: string): Promise<Wallet[]> => {
    await delay(600);
    return getWalletsForUser(userId);
  }
};

export const mockAnalyticsApi = {
  getPortfolioHistory: async (days: number = 30): Promise<HistoryPoint[]> => {
    await delay(400);
    
    // Return last N days of history
    return mockPortfolioHistory.slice(-days);
  },

  getPerformanceMetrics: async (period: number = 30): Promise<PerformanceMetrics> => {
    await delay(350);
    
    // Adjust metrics based on period
    const periodMultiplier = period / 30;
    return {
      ...mockPerformanceMetrics,
      total_return: mockPerformanceMetrics.total_return * periodMultiplier,
      monthly_return: mockPerformanceMetrics.monthly_return * (period / 30),
      volatility: mockPerformanceMetrics.volatility * Math.sqrt(periodMultiplier)
    };
  },

  getPositionAPYs: async (period: number = 30, userId?: string): Promise<any> => {
    await delay(400);
    
    // Mock APY data for positions
    return {
      success: true,
      data: {
        positions: {
          'uniswap_v3_eth_base_uniswap3': {
            apy: 12.5,
            currentValue: 2500,
            unclaimedRewards: 8.5,
            calculationMethod: 'rewards_based_apy',
            confidence: 'medium',
            days: 7
          },
          'convex_frax_convex_base_convex': {
            apy: 8.2,
            currentValue: 1800,
            unclaimedRewards: 3.2,
            calculationMethod: 'rewards_based_apy',
            confidence: 'high',
            days: 14
          }
        }
      }
    };
  },

  getPnLSinceLastReport: async (reportType: 'daily' | 'weekly' | 'monthly' = 'daily'): Promise<any> => {
    await delay(300);
    
    // Mock PnL data
    return {
      success: true,
      data: {
        pnlAmount: 1250.50,
        pnlPercentage: 2.34,
        currentValue: 54875.50,
        previousValue: 53625.00,
        reportType,
        hasData: true,
        currentDate: new Date().toISOString(),
        previousDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      }
    };
  },

  exportExcel: async (): Promise<Blob> => {
    await delay(1500);
    
    // Create a simple CSV content as mock Excel export
    const csvContent = `Portfolio Export - ${new Date().toISOString().split('T')[0]}
    
Wallet Address,Token Symbol,Token Name,Amount,Price,USD Value,Chain
${mockWallets.map(wallet => 
  wallet.tokens.map(token => 
    `${wallet.address},${token.symbol},${token.name},${token.amount},${token.price},${token.usd_value},${token.chain}`
  ).join('\n')
).join('\n')}

Protocol Positions:
Wallet Address,Protocol Name,Chain,Position Name,USD Value
${mockWallets.map(wallet =>
  wallet.protocols.map(protocol =>
    protocol.positions.map(position =>
      `${wallet.address},${protocol.name},${protocol.chain},${position.position_name},${protocol.net_usd_value}`
    ).join('\n')
  ).join('\n')
).join('\n')}`;

    return new Blob([csvContent], { type: 'text/csv' });
  },

  exportMonthlyNav: async (month?: number, year?: number, wallet?: string, userId?: string): Promise<Blob> => {
    await delay(1500);
    
    // Create mock NAV report content in proper Excel CSV format
    const currentDate = new Date();
    const targetMonth = month !== undefined ? month : currentDate.getMonth();
    const targetYear = year !== undefined ? year : currentDate.getFullYear();
    const valuationDate = new Date(targetYear, targetMonth + 1, 0).toLocaleDateString('en-US');
    
    // Excel-compatible CSV format with proper structure
    const navContent = `VALUATION DATE\t${valuationDate}\t
All values in USD as of 12:00 pm UTC on the Valuation date.\t\t
For more information on valuation methodology please see the Investment Management Agreement.\t\t
\t\t
\t\t
Section\tLine Item\tValue
ASSETS\t\t
\tInvestments at fair value (securities)\t$12,289.34
\tCash & cash equivalents\t$-
\tDividends and interest receivable\t$203.19
\tReceivables for investments sold\t$-
\tOther assets\t$-
Total Assets\t\t$12,492.53
LIABILITIES\t\t
\tPayables for investments purchased\t$-
\tAccrued management fees\t$-
\tAccrued fund expenses\t$46.15
\tDistribution payable\t$-
\tOther liabilities\t$-
Total Liabilities\t\t$46.15
\tPre-Fee Ending NAV\t$12,446.37
\tAccrued performance fees\t$70.66
NET ASSETS\t\t$12,375.71
\t\t
\t\t
PERFORMANCE FEE CALCULATION\t\t
Prior period Pre-Fee Ending NAV\t$12,313.79\t
Net Flows\t$-\t
Current period Pre-Fee Ending NAV\t$12,446.37\t
Performance\t$132.59\t
Hurdle Rate\t$28.42\t
High Water Mark\t$12,313.79\t
Performance Fee\t33.1471222\t
\t\t
hurdle rate is 12% annualy , performance fees is 25 % of the profit\t\t`;

    // Return as blob with Excel MIME type
    return new Blob([navContent], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
  },

  // Admin functions (same as regular functions for mock)
  exportUserExcel: async (userId: string, wallet?: string): Promise<Blob> => {
    return mockAnalyticsApi.exportExcel();
  },

  exportUserMonthlyNav: async (userId: string, month?: number, year?: number, wallet?: string): Promise<Blob> => {
    return mockAnalyticsApi.exportMonthlyNav(month, year, wallet, userId);
  }
};

export const mockAdminApi = {
  collectData: async (): Promise<{ message: string; status: string }> => {
    await delay(2000); // Simulate longer operation
    
    return {
      message: 'Data collection completed successfully',
      status: 'success'
    };
  }
};