import { useQuery } from '@tanstack/react-query';
import { walletApi } from '../services/api';

export const usePortfolio = (refetchInterval: number = 30000) => {
  return useQuery({
    queryKey: ['portfolio'],
    queryFn: walletApi.getWallets,
    refetchInterval,
    staleTime: 10000, // Consider data fresh for 10 seconds
  });
};