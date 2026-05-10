import { useQuery } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { useRef, useState, useEffect } from 'react';
import './RoundHistory.css';

interface Round {
  id: string;
  crashPoint: string;
  status: string;
}

interface Props {
  onVerify?: () => void;
}

function crashLevelClass(cp: number): string {
  if (cp >= 10) return 'round-pill--x10';
  if (cp >= 3) return 'round-pill--x3';
  if (cp >= 2) return 'round-pill--x2';
  if (cp >= 1.5) return 'round-pill--x15';
  return 'round-pill--low';
}

// Badge dimensions (px): width including gap, height including gap
const BADGE_W = 58;  // ~52px badge + 6px gap
const BADGE_H = 32;  // ~26px badge + 6px gap
const HEADER_H = 44; // title row height
const PADDING  = 32; // p-4 top + bottom (16*2)

export default function RoundHistory({ onVerify }: Props) {
  const { getToken } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const [limit, setLimit] = useState(20);

  // Recalculate how many badges fit whenever the container is resized
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const calc = () => {
      const innerW = el.clientWidth - PADDING;
      const innerH = el.clientHeight - HEADER_H - PADDING;
      const cols = Math.max(1, Math.floor(innerW / BADGE_W));
      const rows = Math.max(1, Math.floor(innerH / BADGE_H));
      setLimit(cols * rows);
    };
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['round-history', limit],
    queryFn: async () => {
      const token = getToken();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`/games/rounds/history?limit=${limit}`, { headers });
      if (!res.ok) throw new Error('Failed');
      return res.json() as Promise<{ data: Round[]; total: number }>;
    },
    refetchInterval: 8000,
    enabled: limit > 0,
  });

  const rounds = data?.data ?? [];
  const skeletonCount = limit || 20;

  return (
    <div ref={containerRef} className="card h-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="section-title">Histórico de rodadas</h2>
        {onVerify && (
          <button
            onClick={onVerify}
            className="round-verify-btn"
          >
            <ShieldCheck size={11} />
            <span>Verificar</span>
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <span key={i} className={`anim-skeleton inline-block h-6 rounded-lg ${i % 3 === 0 ? 'round-skeleton-wide' : 'round-skeleton-base'}`} />
          ))}
        </div>
      ) : rounds.length === 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <span key={i} className="anim-skeleton inline-block h-6 rounded-lg round-skeleton-base" />
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5 overflow-hidden round-list">
          {rounds.map((r) => {
            const cp = Number(r.crashPoint);
            return (
              <div
                key={r.id}
                className={`text-xs font-bold px-2 py-1 rounded-lg tabular-nums round-pill ${crashLevelClass(cp)}`}
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
