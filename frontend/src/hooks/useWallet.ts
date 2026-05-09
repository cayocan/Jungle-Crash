import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';

const API = '/wallets';

export function useWallet() {
  const { getToken } = useAuth();

  const { data: wallet, refetch } = useQuery({
    queryKey: ['wallet'],
    queryFn: async () => {
      const res = await fetch(`${API}/me`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('Failed to fetch wallet');
      return res.json() as Promise<{ balanceCents: number; currency: string }>;
    },
    retry: false,
  });

  const queryClient = useQueryClient();

  const createWallet = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ initialBalanceCents: 100000 }),
      });
      if (!res.ok) throw new Error('Failed to create wallet');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wallet'] }),
  });

  return { wallet, refetch, createWallet };
}
