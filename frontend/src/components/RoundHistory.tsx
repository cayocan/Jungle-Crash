import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';

interface Round {
  id: string;
  crashPoint: string;
  status: string;
  endsAt: string | null;
}

export default function RoundHistory() {
  const { getToken } = useAuth();

  const { data } = useQuery({
    queryKey: ['round-history'],
    queryFn: async () => {
      const res = await fetch('/games/rounds/history?limit=10', {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Failed to fetch history');
      return res.json() as Promise<{ rounds: Round[] }>;
    },
    refetchInterval: 5000,
  });

  const rounds = data?.rounds ?? [];

  return (
    <div style={{ background: '#1a1a1a', borderRadius: '0.75rem', padding: '1rem' }}>
      <h2 style={{ marginTop: 0, marginBottom: '0.5rem', fontSize: '0.875rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Histórico
      </h2>
      <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
        {rounds.length === 0 ? (
          <p style={{ color: '#555', fontSize: '0.875rem' }}>Sem histórico ainda</p>
        ) : (
          rounds.map((r) => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', borderBottom: '1px solid #222', fontSize: '0.875rem' }}>
              <span style={{ color: '#888', fontSize: '0.75rem' }}>{r.id.slice(0, 8)}…</span>
              <span style={{ color: Number(r.crashPoint) >= 2 ? '#22c55e' : '#ef4444', fontWeight: 'bold' }}>
                {Number(r.crashPoint).toFixed(2)}x
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
