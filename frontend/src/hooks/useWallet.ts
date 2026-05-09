import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';

const API = '/wallets';

export interface WalletDto {
  id: string;
  balanceCents: string | number;
  currency: string;
}

export function useWallet() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  const { data: wallet, isLoading } = useQuery({
    queryKey: ['wallet'],
    queryFn: async () => {
      const res = await fetch(`${API}/me`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('Failed to fetch wallet');
      return res.json() as Promise<WalletDto>;
    },
    retry: false,
    refetchInterval: 15_000,
  });

  const createWallet = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ initialBalanceCents: '100000', currency: 'BRL' }),
      });
      if (!res.ok) throw new Error('Failed to create wallet');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wallet'] }),
  });

  // Auto-create wallet on first login if it doesn't exist yet
  useEffect(() => {
    if (wallet === null && !createWallet.isPending && !createWallet.isSuccess) {
      createWallet.mutate();
    }
  }, [wallet]);

  return { wallet, isLoading, isCreating: createWallet.isPending };
}
