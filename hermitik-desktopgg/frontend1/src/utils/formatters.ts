export const formatCurrency = (amount: number, decimals: number = 2): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
};

export const formatPercentage = (value: number, decimals: number = 2): string => {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
};

export const formatNumber = (value: number, decimals: number = 2): string => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

export const truncateAddress = (address: string, start: number = 6, end: number = 4): string => {
  if (address.length <= start + end) return address;
  return `${address.slice(0, start)}...${address.slice(-end)}`;
};

export const getChainColor = (chain: string): string => {
  const colors: { [key: string]: string } = {
    'ethereum': '#627EEA',
    'polygon': '#8247E5',
    'bsc': '#F3BA2F',
    'arbitrum': '#28A0F0',
    'optimism': '#FF0420',
    'base': '#0052FF',
  };
  return colors[chain.toLowerCase()] || '#6B7280';
};