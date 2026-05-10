import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trophy } from 'lucide-react';
import './Leaderboard.css';

type Period = '24' | '168';

interface LeaderboardEntry {
  rank: number;
  userId: string;
  bestGainCents: string;
  bestAmountCents: string;
  bestCashoutCents: string;
  bestMultiplier: number;
}

interface LeaderboardResponse {
  period: string;
  updatedAt: string;
  data: LeaderboardEntry[];
}

function normalizeLeaderboard(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  const byUser = new Map<string, LeaderboardEntry>();

  for (const entry of entries) {
    const gain = Number(entry.bestGainCents);
    if (!Number.isFinite(gain) || gain <= 0) continue;

    const current = byUser.get(entry.userId);
    if (!current || Number(current.bestGainCents) < gain) {
      byUser.set(entry.userId, entry);
    }
  }

  return [...byUser.values()]
    .sort((a, b) => Number(b.bestGainCents) - Number(a.bestGainCents))
    .map((entry, i) => ({ ...entry, rank: i + 1 }));
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

  const rows = normalizeLeaderboard(data?.data ?? []);

  return (
    <div className="card space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="section-title flex items-center gap-1.5">
          <Trophy size={14} className="text-gold" />
          Maiores ganhos
        </h2>
        <div className="tab-group">
          {(['24', '168'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`tab-btn${period === p ? ' is-active' : ''}`}
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
            <div key={i} className="anim-skeleton lb-skeleton-row" />
          ))}
        </div>
      ) : !rows.length ? (
        <p className="text-xs text-center py-4 text-subtle">
          Nenhum ganho neste período.
        </p>
      ) : (
        <div className="space-y-1">
          {rows.map((entry) => {
            const gain = Number(entry.bestGainCents) / 100;
            const multiplier = entry.bestMultiplier;
            return (
              <div
                  key={entry.userId}
                  className={`flex items-center gap-3 px-2 py-2 rounded-lg ${entry.rank <= 3 ? 'lb-row--podium' : ''}`}
                >
                {/* Rank */}
                <span className="text-sm w-6 text-center shrink-0">
                  {entry.rank <= 3 ? MEDAL[entry.rank - 1] : (
                    <span className="text-muted">{entry.rank}</span>
                  )}
                </span>

                {/* User ID (truncated) */}
                <span className="flex-1 text-xs font-mono truncate user-id">
                  {entry.userId.slice(0, 8)}…
                </span>

                {/* Best multiplier */}
                <span className="text-xs font-bold tabular-nums mult">
                  {multiplier.toFixed(2)}x
                </span>

                {/* Best single-round gain */}
                <span className="text-sm font-bold text-right tabular-nums profit">
                  R$ {gain.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
