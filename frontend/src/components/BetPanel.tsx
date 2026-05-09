import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useGameStore } from '../store/gameStore';
import { useQueryClient } from '@tanstack/react-query';

const API = '/games';

export default function BetPanel() {
  const { getToken } = useAuth();
  const { status } = useGameStore();
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState('1000');
  const [loading, setLoading] = useState(false);
  const [hasBet, setHasBet] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canBet = status === 'OPEN' && !hasBet;
  const canCashout = status === 'RUNNING' && hasBet;

  async function placeBet() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API}/bet`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountCents: String(amount) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.message ?? 'Erro ao apostar');
      } else {
        setHasBet(true);
      }
    } finally {
      setLoading(false);
    }
  }

  async function cashout() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API}/bet/cashout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.message ?? 'Erro ao fazer cashout');
      } else {
        setHasBet(false);
        queryClient.invalidateQueries({ queryKey: ['wallet'] });
      }
    } finally {
      setLoading(false);
    }
  }

  // Reset bet state when a new round starts
  if (status === 'PENDING' && hasBet) setHasBet(false);

  return (
    <div style={{ background: '#1a1a1a', borderRadius: '0.75rem', padding: '1.25rem' }}>
      <h2 style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: '1rem', color: '#ccc' }}>Apostar</h2>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="number"
          min={100}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={!canBet || loading}
          placeholder="Centavos"
          style={{ flex: 1, minWidth: '120px', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', border: '1px solid #333', background: '#111', color: '#fff', fontSize: '1rem' }}
        />
        <button
          onClick={placeBet}
          disabled={!canBet || loading}
          style={{ padding: '0.5rem 1.5rem', borderRadius: '0.375rem', border: 'none', background: canBet ? '#22c55e' : '#333', color: '#fff', cursor: canBet ? 'pointer' : 'not-allowed', fontSize: '1rem' }}
        >
          {loading && canBet ? '...' : 'Apostar'}
        </button>
        <button
          onClick={cashout}
          disabled={!canCashout || loading}
          style={{ padding: '0.5rem 1.5rem', borderRadius: '0.375rem', border: 'none', background: canCashout ? '#f59e0b' : '#333', color: '#fff', cursor: canCashout ? 'pointer' : 'not-allowed', fontSize: '1rem' }}
        >
          {loading && canCashout ? '...' : 'Cashout'}
        </button>
      </div>
      {error && <p style={{ color: '#ef4444', marginTop: '0.5rem', fontSize: '0.875rem' }}>{error}</p>}
    </div>
  );
}
