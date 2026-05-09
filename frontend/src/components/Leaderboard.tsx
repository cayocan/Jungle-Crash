import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trophy } from 'lucide-react';

type Period = '24' | '168';

interface LeaderboardEntry {
  rank: number;
  userId: string;
  profitCents: string;
  totalBets: number;
}

interface LeaderboardResponse {
  period: string;
  updatedAt: string;
  data: LeaderboardEntry[];
}

async function fetchLeaderboard(period: Period): Promise<LeaderboardResponse> {
  const res = await fetch(`/games/leaderboard?period=${period}&limit=10`);
  if (!res.ok) throw new Error('Failed to fetch leaderboard');
  return res.json() as Promise<LeaderboardResponse>;
}

const MEDAL = ['🥇', '🥈', '🥉'];

export default function Leaderboard() {
  const [period, setPeriod] = useState<Period>('24');

  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard', period],
    queryFn: () => fetchLeaderboard(period),
    refetchInterval: 30_000,
  });

  const cardStyle = {
    background: '#0d1421',
    border: '1px solid #1e2d3d',
    borderRadius: '1rem',
    padding: '1.25rem',
  };

  return (
    <div style={cardStyle} className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-widest flex items-center gap-1.5" style={{ color: '#6b7280' }}>
          <Trophy size={14} style={{ color: '#ffd700' }} />
          Leaderboard
        </h2>
        <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #1e2d3d' }}>
          {(['24', '168'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="text-xs px-3 py-1 transition-colors"
              style={{
                background: period === p ? '#1e2d3d' : 'transparent',
                color: period === p ? '#f0f0f0' : '#4a5568',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {p === '24' ? '24h' : '7d'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="anim-skeleton" style={{ height: 32, borderRadius: 6 }} />
          ))}
        </div>
      ) : !data?.data.length ? (
        <p className="text-xs text-center py-4" style={{ color: '#374151' }}>
          Nenhuma aposta liquidada neste período.
        </p>
      ) : (
        <div className="space-y-1">
          {data.data.map((entry) => {
            const profit = Number(entry.profitCents) / 100;
            const isPositive = profit >= 0;
            return (
              <div
                key={entry.userId}
                className="flex items-center gap-3 px-2 py-2 rounded-lg"
                style={{ background: entry.rank <= 3 ? '#0a1520' : 'transparent' }}
              >
                {/* Rank */}
                <span className="text-sm w-6 text-center shrink-0">
                  {entry.rank <= 3 ? MEDAL[entry.rank - 1] : (
                    <span style={{ color: '#4a5568' }}>{entry.rank}</span>
                  )}
                </span>

                {/* User ID (truncated) */}
                <span className="flex-1 text-xs font-mono truncate" style={{ color: '#9ca3af' }}>
                  {entry.userId.slice(0, 8)}…
                </span>

                {/* Bets count */}
                <span className="text-xs" style={{ color: '#4a5568' }}>
                  {entry.totalBets}x
                </span>

                {/* Profit */}
                <span
                  className="text-sm font-bold text-right"
                  style={{ color: isPositive ? '#00ff88' : '#ff3b3b', minWidth: 80 }}
                >
                  {isPositive ? '+' : ''}R$ {profit.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
