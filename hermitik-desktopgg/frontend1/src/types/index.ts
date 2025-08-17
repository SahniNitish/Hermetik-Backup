export interface User {
  id: string;
  username: string;
  email: string;
  role?: string;
  created_at?: string;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}

export interface Token {
  symbol: string;
  name: string;
  amount: number;
  price: number;
  usd_value: number;
  chain: string;
  logo_url: string;
  percentage_of_portfolio?: number;
}

export interface Position {
  position_name: string;
  chain?: string;
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
}

export interface Protocol {
  protocol_id: string;
  name: string;
  chain: string;
  net_usd_value: number;
  positions: Position[];
  logo_url?: string;
  daily_apy?: number;
}

export interface PortfolioSummary {
  total_usd_value: number;
  token_usd_value: number;
  protocol_usd_value: number;
}

export interface Wallet {
  id: string;
  address: string;
  name: string;
  tokens: Token[];
  protocols: Protocol[];
  totalValue: number;
  chainDistribution: Record<string, number>;
  protocolDistribution: Record<string, number>;
  performance: {
    daily: number;
    weekly: number;
    monthly: number;
    yearly: number;
  };
}

export interface PerformanceMetrics {
  total_return: number;
  daily_return: number;
  monthly_return: number;
  volatility: number;
  sharpe_ratio: number;
  max_drawdown: number;
}

export interface HistoryPoint {
  date: string;
  value: number;
  daily_return: number;
}

export interface ApiError {
  message: string;
  status?: number;
}