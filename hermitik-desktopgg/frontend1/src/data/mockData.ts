export interface MockUser {
  id: string;
  username: string;
  email: string;
  password: string;
  created_at: string;
  role?: string;
}

export interface MockWallet {
  address: string;
  tokens: Array<{
    symbol: string;
    name: string;
    amount: number;
    price: number;
    usd_value: number;
    chain: string;
    logo_url: string;
  }>;
  protocols: Array<{
    protocol_id: string;
    name: string;
    chain: string;
    net_usd_value: number;
    daily_apy?: number;
    logo_url?: string;
    positions: Array<{
      position_name: string;
      tokens: Array<{
        symbol: string;
        amount: number;
        usd_value: number;
      }>;
      rewards: Array<{
        symbol: string;
        amount: number;
        usd_value: number;
      }>;
    }>;
  }>;
  summary: {
    total_usd_value: number;
    token_usd_value: number;
    protocol_usd_value: number;
  };
}

// Test Users (matching database users)
export const mockUsers: MockUser[] = [
  {
    id: '1',
    username: 'Admin User',
    email: 'admin@example.com',
    password: 'admin123',
    created_at: '2025-07-13T15:17:13.284Z',
    role: 'admin'
  },
  {
    id: '2',
    username: 'New Test User',
    email: 'newtest@example.com',
    password: 'testpass123',
    created_at: '2025-07-15T23:24:14.044Z',
    role: 'admin'
  },
  {
    id: '3',
    username: 'Test Admin',
    email: 'admin@test.com',
    password: 'testadmin123',
    created_at: '2025-07-23T19:18:37.592Z',
    role: 'admin'
  },
  {
    id: '4',
    username: 'Test User',
    email: 'test@example.com',
    password: 'testuser123',
    created_at: '2025-08-01T00:05:08.051Z',
    role: 'admin'
  },
  {
    id: '5',
    username: 'Brian Robertson',
    email: 'brianrobertson@example.com',
    password: 'brian123',
    created_at: '2025-08-01T00:16:40.878Z',
    role: 'user'
  },
  {
    id: '6',
    username: 'Gary Baron',
    email: 'garybaron@example.com',
    password: 'gary123',
    created_at: '2025-08-01T00:17:31.636Z',
    role: 'user'
  },
  {
    id: '7',
    username: 'Lars Kluge',
    email: 'larskluge@example.com',
    password: 'lars123',
    created_at: '2025-08-01T00:18:30.062Z',
    role: 'user'
  },
  {
    id: '8',
    username: 'Hermetik',
    email: 'hermetik@example.com',
    password: 'hermetik123',
    created_at: '2025-08-04T22:37:48.080Z',
    role: 'user'
  }
];

// Mock Portfolio Data
export const mockWallets: MockWallet[] = [
  {
    address: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b1',
    tokens: [
      {
        symbol: 'ETH',
        name: 'Ethereum',
        amount: 12.5,
        price: 2340.50,
        usd_value: 29256.25,
        chain: 'ethereum',
        logo_url: 'https://cryptologos.cc/logos/ethereum-eth-logo.png'
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        amount: 15000,
        price: 1.00,
        usd_value: 15000,
        chain: 'ethereum',
        logo_url: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png'
      },
      {
        symbol: 'WBTC',
        name: 'Wrapped Bitcoin',
        amount: 0.75,
        price: 43200,
        usd_value: 32400,
        chain: 'ethereum',
        logo_url: 'https://cryptologos.cc/logos/wrapped-bitcoin-wbtc-logo.png'
      },
      {
        symbol: 'UNI',
        name: 'Uniswap',
        amount: 500,
        price: 8.45,
        usd_value: 4225,
        chain: 'ethereum',
        logo_url: 'https://cryptologos.cc/logos/uniswap-uni-logo.png'
      },
      {
        symbol: 'MATIC',
        name: 'Polygon',
        amount: 8000,
        price: 0.85,
        usd_value: 6800,
        chain: 'polygon',
        logo_url: 'https://cryptologos.cc/logos/polygon-matic-logo.png'
      }
    ],
    protocols: [
      {
        protocol_id: 'uniswap_v3',
        name: 'Uniswap V3',
        chain: 'ethereum',
        net_usd_value: 25000,
        daily_apy: 12.5,
        positions: [
          {
            position_name: 'ETH/USDC LP',
            tokens: [
              { symbol: 'ETH', amount: 5.2, usd_value: 12168 },
              { symbol: 'USDC', amount: 12832, usd_value: 12832 }
            ],
            rewards: [
              { symbol: 'UNI', amount: 15.5, usd_value: 130.98 }
            ]
          }
        ]
      },
      {
        protocol_id: 'aave_v3',
        name: 'Aave V3',
        chain: 'ethereum',
        net_usd_value: 18500,
        daily_apy: 4.2,
        positions: [
          {
            position_name: 'USDC Lending',
            tokens: [
              { symbol: 'aUSDC', amount: 18500, usd_value: 18500 }
            ],
            rewards: [
              { symbol: 'AAVE', amount: 2.1, usd_value: 168 }
            ]
          }
        ]
      },
      {
        protocol_id: 'compound_v3',
        name: 'Compound V3',
        chain: 'ethereum',
        net_usd_value: 8200,
        daily_apy: 3.8,
        positions: [
          {
            position_name: 'ETH Collateral',
            tokens: [
              { symbol: 'cETH', amount: 3.5, usd_value: 8200 }
            ],
            rewards: [
              { symbol: 'COMP', amount: 0.8, usd_value: 48 }
            ]
          }
        ]
      }
    ],
    summary: {
      total_usd_value: 139381.25,
      token_usd_value: 87681.25,
      protocol_usd_value: 51700
    }
  },
  {
    address: '0x8ba1f109551bD432803012645Hac136c22C85B',
    tokens: [
      {
        symbol: 'BNB',
        name: 'BNB',
        amount: 25,
        price: 310.50,
        usd_value: 7762.50,
        chain: 'bsc',
        logo_url: 'https://cryptologos.cc/logos/bnb-bnb-logo.png'
      },
      {
        symbol: 'CAKE',
        name: 'PancakeSwap',
        amount: 1200,
        price: 2.15,
        usd_value: 2580,
        chain: 'bsc',
        logo_url: 'https://cryptologos.cc/logos/pancakeswap-cake-logo.png'
      },
      {
        symbol: 'BUSD',
        name: 'Binance USD',
        amount: 5000,
        price: 1.00,
        usd_value: 5000,
        chain: 'bsc',
        logo_url: 'https://cryptologos.cc/logos/binance-usd-busd-logo.png'
      }
    ],
    protocols: [
      {
        protocol_id: 'pancakeswap_v3',
        name: 'PancakeSwap V3',
        chain: 'bsc',
        net_usd_value: 12000,
        daily_apy: 18.5,
        positions: [
          {
            position_name: 'BNB/BUSD LP',
            tokens: [
              { symbol: 'BNB', amount: 15, usd_value: 4657.50 },
              { symbol: 'BUSD', amount: 7342.50, usd_value: 7342.50 }
            ],
            rewards: [
              { symbol: 'CAKE', amount: 25, usd_value: 53.75 }
            ]
          }
        ]
      },
      {
        protocol_id: 'venus',
        name: 'Venus Protocol',
        chain: 'bsc',
        net_usd_value: 6500,
        daily_apy: 8.2,
        positions: [
          {
            position_name: 'BUSD Lending',
            tokens: [
              { symbol: 'vBUSD', amount: 6500, usd_value: 6500 }
            ],
            rewards: [
              { symbol: 'XVS', amount: 12, usd_value: 84 }
            ]
          }
        ]
      }
    ],
    summary: {
      total_usd_value: 33842.50,
      token_usd_value: 15342.50,
      protocol_usd_value: 18500
    }
  },
  {
    address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
    tokens: [
      {
        symbol: 'ARB',
        name: 'Arbitrum',
        amount: 2500,
        price: 1.25,
        usd_value: 3125,
        chain: 'arbitrum',
        logo_url: 'https://cryptologos.cc/logos/arbitrum-arb-logo.png'
      },
      {
        symbol: 'GMX',
        name: 'GMX',
        amount: 50,
        price: 45.80,
        usd_value: 2290,
        chain: 'arbitrum',
        logo_url: 'https://cryptologos.cc/logos/gmx-gmx-logo.png'
      },
      {
        symbol: 'USDC.e',
        name: 'USD Coin (Bridged)',
        amount: 8000,
        price: 1.00,
        usd_value: 8000,
        chain: 'arbitrum',
        logo_url: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png'
      }
    ],
    protocols: [
      {
        protocol_id: 'gmx_v2',
        name: 'GMX V2',
        chain: 'arbitrum',
        net_usd_value: 15000,
        daily_apy: 22.3,
        positions: [
          {
            position_name: 'GLP Staking',
            tokens: [
              { symbol: 'GLP', amount: 15000, usd_value: 15000 }
            ],
            rewards: [
              { symbol: 'ETH', amount: 0.05, usd_value: 117.03 },
              { symbol: 'esGMX', amount: 8.5, usd_value: 389.30 }
            ]
          }
        ]
      },
      {
        protocol_id: 'radiant',
        name: 'Radiant Capital',
        chain: 'arbitrum',
        net_usd_value: 7200,
        daily_apy: 15.8,
        positions: [
          {
            position_name: 'USDC Lending',
            tokens: [
              { symbol: 'rUSDC', amount: 7200, usd_value: 7200 }
            ],
            rewards: [
              { symbol: 'RDNT', amount: 150, usd_value: 45 }
            ]
          }
        ]
      }
    ],
    summary: {
      total_usd_value: 35615,
      token_usd_value: 13415,
      protocol_usd_value: 22200
    }
  },
  {
    address: '0xb046086f7b6d74a3498d2b994904233ad3246ddc',
    tokens: [
      {
        symbol: 'USDC',
        name: 'USD Coin',
        amount: 8000,
        price: 1.00,
        usd_value: 8000,
        chain: 'ethereum',
        logo_url: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png'
      },
      {
        symbol: 'COMP',
        name: 'Compound',
        amount: 50,
        price: 65.80,
        usd_value: 3290,
        chain: 'ethereum',
        logo_url: 'https://cryptologos.cc/logos/compound-comp-logo.png'
      }
    ],
    protocols: [
      {
        protocol_id: 'compound_v3',
        name: 'Compound V3',
        chain: 'ethereum',
        net_usd_value: 12500,
        daily_apy: 3.8,
        positions: [
          {
            position_name: 'USDC Lending',
            tokens: [
              { symbol: 'cUSDC', amount: 12500, usd_value: 12500 }
            ],
            rewards: [
              { symbol: 'COMP', amount: 0.8, usd_value: 52.64 }
            ]
          }
        ]
      }
    ],
    summary: {
      total_usd_value: 23790,
      token_usd_value: 11290,
      protocol_usd_value: 12500
    }
  },
  {
    address: '0x99b3c496751c5c49a58e99cd0f8bd7242fd6284f',
    tokens: [
      {
        symbol: 'MATIC',
        name: 'Polygon',
        amount: 8000,
        price: 0.85,
        usd_value: 6800,
        chain: 'polygon',
        logo_url: 'https://cryptologos.cc/logos/polygon-matic-logo.png'
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        amount: 5000,
        price: 1.00,
        usd_value: 5000,
        chain: 'polygon',
        logo_url: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png'
      }
    ],
    protocols: [
      {
        protocol_id: 'quickswap',
        name: 'QuickSwap',
        chain: 'polygon',
        net_usd_value: 18500,
        daily_apy: 15.2,
        positions: [
          {
            position_name: 'MATIC/USDC LP',
            tokens: [
              { symbol: 'MATIC', amount: 10000, usd_value: 8500 },
              { symbol: 'USDC', amount: 10000, usd_value: 10000 }
            ],
            rewards: [
              { symbol: 'QUICK', amount: 125, usd_value: 87.50 }
            ]
          }
        ]
      }
    ],
    summary: {
      total_usd_value: 30300,
      token_usd_value: 11800,
      protocol_usd_value: 18500
    }
  },
  {
    address: '0xbfa2ef4cab56ace20a4e11bb6080a09d126bf5cd',
    tokens: [
      {
        symbol: 'WBTC',
        name: 'Wrapped Bitcoin',
        amount: 0.8,
        price: 45000,
        usd_value: 36000,
        chain: 'ethereum',
        logo_url: 'https://cryptologos.cc/logos/wrapped-bitcoin-wbtc-logo.png'
      },
      {
        symbol: 'ETH',
        name: 'Ethereum',
        amount: 5.2,
        price: 2340.50,
        usd_value: 12170.60,
        chain: 'ethereum',
        logo_url: 'https://cryptologos.cc/logos/ethereum-eth-logo.png'
      }
    ],
    protocols: [
      {
        protocol_id: 'uniswap_v3',
        name: 'Uniswap V3',
        chain: 'ethereum',
        net_usd_value: 28000,
        daily_apy: 12.5,
        positions: [
          {
            position_name: 'WBTC/ETH LP',
            tokens: [
              { symbol: 'WBTC', amount: 0.3, usd_value: 13500 },
              { symbol: 'ETH', amount: 6.2, usd_value: 14500 }
            ],
            rewards: [
              { symbol: 'UNI', amount: 25, usd_value: 211.25 }
            ]
          }
        ]
      }
    ],
    summary: {
      total_usd_value: 76170.60,
      token_usd_value: 48170.60,
      protocol_usd_value: 28000
    }
  },
  {
    address: '0xE71Aa6f45A22Fa1e4C9fB29960248f4A3d4af918',
    tokens: [
      {
        symbol: 'LINK',
        name: 'Chainlink',
        amount: 1500,
        price: 14.50,
        usd_value: 21750,
        chain: 'ethereum',
        logo_url: 'https://cryptologos.cc/logos/chainlink-link-logo.png'
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        amount: 8000,
        price: 1.00,
        usd_value: 8000,
        chain: 'ethereum',
        logo_url: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png'
      }
    ],
    protocols: [
      {
        protocol_id: 'aave_v3',
        name: 'Aave V3',
        chain: 'ethereum',
        net_usd_value: 22000,
        daily_apy: 4.2,
        positions: [
          {
            position_name: 'LINK Collateral',
            tokens: [
              { symbol: 'aLINK', amount: 1000, usd_value: 14500 }
            ],
            rewards: [
              { symbol: 'AAVE', amount: 3.2, usd_value: 256 }
            ]
          },
          {
            position_name: 'USDC Lending',
            tokens: [
              { symbol: 'aUSDC', amount: 7500, usd_value: 7500 }
            ],
            rewards: [
              { symbol: 'AAVE', amount: 1.8, usd_value: 144 }
            ]
          }
        ]
      }
    ],
    summary: {
      total_usd_value: 51750,
      token_usd_value: 29750,
      protocol_usd_value: 22000
    }
  },
  {
    address: '0x6e1cfdbd65676c9588e4aee278008ff48b986074',
    tokens: [
      {
        symbol: 'AAVE',
        name: 'Aave',
        amount: 200,
        price: 85.50,
        usd_value: 17100,
        chain: 'ethereum',
        logo_url: 'https://cryptologos.cc/logos/aave-aave-logo.png'
      },
      {
        symbol: 'DAI',
        name: 'Dai Stablecoin',
        amount: 15000,
        price: 1.00,
        usd_value: 15000,
        chain: 'ethereum',
        logo_url: 'https://cryptologos.cc/logos/multi-collateral-dai-dai-logo.png'
      }
    ],
    protocols: [
      {
        protocol_id: 'aave_v3',
        name: 'Aave V3',
        chain: 'ethereum',
        net_usd_value: 35000,
        daily_apy: 5.8,
        positions: [
          {
            position_name: 'AAVE Staking',
            tokens: [
              { symbol: 'stkAAVE', amount: 150, usd_value: 12825 }
            ],
            rewards: [
              { symbol: 'AAVE', amount: 2.5, usd_value: 213.75 }
            ]
          },
          {
            position_name: 'DAI Lending',
            tokens: [
              { symbol: 'aDAI', amount: 22000, usd_value: 22000 }
            ],
            rewards: [
              { symbol: 'AAVE', amount: 1.2, usd_value: 102.60 }
            ]
          }
        ]
      }
    ],
    summary: {
      total_usd_value: 67100,
      token_usd_value: 32100,
      protocol_usd_value: 35000
    }
  },
  {
    address: '0x2F6C914A6DfA61893FF86e05A30Ce0Dc6065fFF1',
    tokens: [
      {
        symbol: 'UNI',
        name: 'Uniswap',
        amount: 800,
        price: 8.45,
        usd_value: 6760,
        chain: 'ethereum',
        logo_url: 'https://cryptologos.cc/logos/uniswap-uni-logo.png'
      },
      {
        symbol: 'ETH',
        name: 'Ethereum',
        amount: 8.5,
        price: 2340.50,
        usd_value: 19894.25,
        chain: 'ethereum',
        logo_url: 'https://cryptologos.cc/logos/ethereum-eth-logo.png'
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        amount: 12000,
        price: 1.00,
        usd_value: 12000,
        chain: 'ethereum',
        logo_url: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png'
      }
    ],
    protocols: [
      {
        protocol_id: 'uniswap_v3',
        name: 'Uniswap V3',
        chain: 'ethereum',
        net_usd_value: 25000,
        daily_apy: 14.8,
        positions: [
          {
            position_name: 'ETH/USDC LP',
            tokens: [
              { symbol: 'ETH', amount: 6.2, usd_value: 14511 },
              { symbol: 'USDC', amount: 10489, usd_value: 10489 }
            ],
            rewards: [
              { symbol: 'UNI', amount: 18.5, usd_value: 156.33 }
            ]
          }
        ]
      },
      {
        protocol_id: 'compound_v3',
        name: 'Compound V3',
        chain: 'ethereum',
        net_usd_value: 8500,
        daily_apy: 4.1,
        positions: [
          {
            position_name: 'USDC Lending',
            tokens: [
              { symbol: 'cUSDC', amount: 8500, usd_value: 8500 }
            ],
            rewards: [
              { symbol: 'COMP', amount: 1.2, usd_value: 78.96 }
            ]
          }
        ]
      }
    ],
    summary: {
      total_usd_value: 72154.25,
      token_usd_value: 38654.25,
      protocol_usd_value: 33500
    }
  }
];

// Mock Performance Metrics
export const mockPerformanceMetrics = {
  total_return: 15.67,
  daily_return: 2.34,
  monthly_return: 8.92,
  volatility: 18.45,
  sharpe_ratio: 1.85,
  max_drawdown: -12.34
};

// Mock Portfolio History (30 days)
export const mockPortfolioHistory = Array.from({ length: 30 }, (_, i) => {
  const date = new Date();
  date.setDate(date.getDate() - (29 - i));
  
  const baseValue = 208838.75; // Total portfolio value
  const volatility = 0.05; // 5% daily volatility
  const trend = 0.001; // Slight upward trend
  
  const randomChange = (Math.random() - 0.5) * volatility;
  const trendChange = trend * i;
  const value = baseValue * (1 + trendChange + randomChange);
  
  const previousValue = i > 0 ? baseValue * (1 + trend * (i - 1) + (Math.random() - 0.5) * volatility) : baseValue;
  const daily_return = ((value - previousValue) / previousValue) * 100;
  
  return {
    date: date.toISOString().split('T')[0],
    value: Math.round(value),
    daily_return: Number(daily_return.toFixed(2))
  };
});

// User wallet mapping (using correct database addresses)
export const userWallets: { [userId: string]: string[] } = {
  '1': ['0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b1'], // Admin User
  '2': [], // New Test User - no wallets
  '3': [], // Test Admin - no wallets  
  '4': [], // Test User
  '5': ['0xbfa2ef4cab56ace20a4e11bb6080a09d126bf5cd', '0xE71Aa6f45A22Fa1e4C9fB29960248f4A3d4af918'], // Brian Robertson (both wallets)
  '6': ['0xb046086f7b6d74a3498d2b994904233ad3246ddc'], // Gary Baron
  '7': ['0x99b3c496751c5c49a58e99cd0f8bd7242fd6284f'], // Lars Kluge
  '8': ['0x6e1cfdbd65676c9588e4aee278008ff48b986074', '0x2F6C914A6DfA61893FF86e05A30Ce0Dc6065fFF1'] // Hermetik (both wallets)
};

// Helper function to get wallets for a user
export const getWalletsForUser = (userId: string): any[] => {
  const walletAddresses = userWallets[userId] || [];
  const userMockWallets = mockWallets.filter(wallet => walletAddresses.includes(wallet.address));
  
  // Transform MockWallet to Wallet interface
  const transformedWallets = userMockWallets.map(mockWallet => ({
    id: mockWallet.address,
    address: mockWallet.address,
    name: `Wallet ${mockWallet.address.slice(0, 6)}...${mockWallet.address.slice(-4)}`,
    tokens: mockWallet.tokens || [],
    protocols: mockWallet.protocols || [],
    totalValue: mockWallet.summary?.total_usd_value || 0,
    chainDistribution: (mockWallet.tokens || []).reduce((acc: any, token: any) => {
      const chain = token.chain || 'unknown';
      acc[chain] = (acc[chain] || 0) + (token.usd_value || 0);
      return acc;
    }, {}),
    protocolDistribution: (mockWallet.protocols || []).reduce((acc: any, protocol: any) => {
      const name = protocol.name || 'Unknown';
      acc[name] = (acc[name] || 0) + (protocol.net_usd_value || 0);
      return acc;
    }, {}),
    performance: {
      daily: 0,
      weekly: 0,
      monthly: 0,
      yearly: 0
    }
  }));
  
  return transformedWallets;
};

// Helper function to find user by credentials
export const findUserByCredentials = (usernameOrEmail: string, password: string): MockUser | null => {
  return mockUsers.find(user => 
    (user.username === usernameOrEmail || user.email === usernameOrEmail) && 
    user.password === password
  ) || null;
};

// Helper function to find user by ID
export const findUserById = (id: string): MockUser | null => {
  return mockUsers.find(user => user.id === id) || null;
};