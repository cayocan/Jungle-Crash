import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';

interface Round {
  id: string;
  crashPoint: string;
  status: string;
}

function crashColor(cp: number): { bg: string; text: string; glow: string } {
  if (cp >= 10) return { bg: '#0a1f10', text: '#00ff88', glow: '#00ff8844' };
  if (cp >= 3)  return { bg: '#0d1a10', text: '#4ade80', glow: '#4ade8033' };
  if (cp >= 2)  return { bg: '#1a1f0a', text: '#ffd700', glow: '#ffd70033' };
  if (cp >= 1.5) return { bg: '#1f180a', text: '#f97316', glow: '#f9731633' };
  return { bg: '#1f0a0a', text: '#ff3b3b', glow: '#ff3b3b33' };
}

export default function RoundHistory() {
  const { getToken } = useAuth();

  const { data } = useQuery({
    queryKey: ['round-history'],
    queryFn: async () => {
      const token = getToken();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch('/games/rounds/history?limit=20', { headers });
      if (!res.ok) throw new Error('Failed');
      return res.json() as Promise<{ rounds: Round[] }>;
    },
    refetchInterval: 8000,
  });

  const rounds = data?.rounds ?? [];

  return (
    <div
      className="rounded-2xl p-4 h-full"
      style={{ background: '#0d1421', border: '1px solid #1e2d3d' }}
    >
      <h2 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#4a5568' }}>
        Histórico de rodadas
      </h2>

      {rounds.length === 0 ? (
        <div className="flex flex-wrap gap-1.5 justify-start">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-6 w-14 rounded" style={{ background: '#1e2d3d', animation: 'pulse 2s ease infinite' }} />
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {rounds.map((r) => {
            const cp = Number(r.crashPoint);
            const { bg, text, glow } = crashColor(cp);
            return (
              <div
                key={r.id}
                className="text-xs font-bold px-2 py-1 rounded-lg tabular-nums"
                style={{
                  background: bg,
                  color: text,
                  border: `1px solid ${glow}`,
                  boxShadow: `0 0 6px ${glow}`,
                  letterSpacing: '-0.02em',
                }}
                title={`Round ${r.id.slice(0, 8)}`}
              >
                {cp.toFixed(2)}x
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
