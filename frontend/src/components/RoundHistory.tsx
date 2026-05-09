import { useQuery } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { useRef, useState, useEffect } from 'react';

interface Round {
  id: string;
  crashPoint: string;
  status: string;
}

interface Props {
  onVerify?: () => void;
}

function crashColor(cp: number): { bg: string; text: string; glow: string } {
  if (cp >= 10) return { bg: '#0a1f10', text: '#00ff88', glow: '#00ff8844' };
  if (cp >= 3)  return { bg: '#0d1a10', text: '#4ade80', glow: '#4ade8033' };
  if (cp >= 2)  return { bg: '#1a1f0a', text: '#ffd700', glow: '#ffd70033' };
  if (cp >= 1.5) return { bg: '#1f180a', text: '#f97316', glow: '#f9731633' };
  return { bg: '#1f0a0a', text: '#ff3b3b', glow: '#ff3b3b33' };
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
    <div
      ref={containerRef}
      className="rounded-2xl p-4 h-full"
      style={{ background: '#0d1421', border: '1px solid #1e2d3d' }}
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: '#4a5568' }}>
          Histórico de rodadas
        </h2>
        {onVerify && (
          <button
            onClick={onVerify}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
            style={{ color: '#00ff88', border: '1px solid #00ff8840', background: 'transparent', cursor: 'pointer' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#00ff8815'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <ShieldCheck size={11} />
            <span>Verificar</span>
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <span key={i} className="anim-skeleton inline-block h-6 rounded-lg" style={{ width: i % 3 === 0 ? 52 : 44 }} />
          ))}
        </div>
      ) : rounds.length === 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <span key={i} className="anim-skeleton inline-block h-6 rounded-lg" style={{ width: 44 }} />
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5 overflow-hidden" style={{ maxHeight: `calc(100% - ${HEADER_H}px)` }}>
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
