import { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';

const W = 800;
const H = 300;
const PAD = { top: 28, right: 20, bottom: 44, left: 56 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

function yScale(v: number, minY: number, maxY: number): number {
  if (maxY === minY) return PAD.top + PLOT_H;
  return PAD.top + PLOT_H - ((v - minY) / (maxY - minY)) * PLOT_H;
}

function xScale(i: number, total: number): number {
  if (total <= 1) return PAD.left;
  return PAD.left + (i / (total - 1)) * PLOT_W;
}

const Y_TICKS = [1, 1.5, 2, 3, 5, 10];

export default function CrashGraph() {
  const { multiplierHistory, status, crashPoint, multiplier, serverSeedHash, bettingEndsAt } = useGameStore();

  const crashed = status === 'crashed';
  const running = status === 'running';
  const betting = status === 'betting';

  // Countdown timer during betting phase
  const [countdown, setCountdown] = useState<number | null>(null);
  useEffect(() => {
    if (!betting || !bettingEndsAt) { setCountdown(null); return; }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((bettingEndsAt - Date.now()) / 1000));
      setCountdown(remaining);
    };
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [betting, bettingEndsAt]);

  // Crash flash: show for ~600ms after crash
  const [showCrashFlash, setShowCrashFlash] = useState(false);
  useEffect(() => {
    if (!crashed) return;
    setShowCrashFlash(true);
    const id = setTimeout(() => setShowCrashFlash(false), 600);
    return () => clearTimeout(id);
  }, [crashed]);

  const lastMult = multiplierHistory[multiplierHistory.length - 1] ?? multiplier;
  const maxY = Math.max(2.0, lastMult * 1.15);
  const minY = 1.0;

  const ticks = Y_TICKS.filter((t) => t <= maxY);

  // Build SVG path
  let pathD = '';
  let fillD = '';
  if (multiplierHistory.length >= 2) {
    const pts = multiplierHistory.map((v, i) => ({
      x: xScale(i, multiplierHistory.length),
      y: yScale(v, minY, maxY),
    }));
    pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const lastPt = pts[pts.length - 1];
    fillD = pathD + ` L${lastPt.x.toFixed(1)},${(PAD.top + PLOT_H).toFixed(1)} L${PAD.left},${(PAD.top + PLOT_H).toFixed(1)} Z`;
  } else if (multiplierHistory.length === 1) {
    const y = yScale(multiplierHistory[0], minY, maxY);
    pathD = `M${PAD.left},${y.toFixed(1)} L${(PAD.left + PLOT_W * 0.05).toFixed(1)},${y.toFixed(1)}`;
  }

  const lastX = multiplierHistory.length > 0
    ? xScale(multiplierHistory.length - 1, multiplierHistory.length)
    : PAD.left;
  const lastY = multiplierHistory.length > 0
    ? yScale(multiplierHistory[multiplierHistory.length - 1], minY, maxY)
    : yScale(1, minY, maxY);

  const lineColor = crashed ? '#ff3b3b' : '#00ff88';
  const gradId = crashed ? 'g-crash' : 'g-run';

  // Display multiplier
  const displayVal = crashed && crashPoint != null
    ? Number(crashPoint).toFixed(2)
    : multiplier.toFixed(2);

  // Status text
  let statusText = '';
  let statusColor = '#ffd700';
  if (betting) {
    statusText = countdown !== null && countdown > 0
      ? `Apostas fecham em ${countdown}s`
      : '🚀 Lançando…';
    statusColor = '#ffd700';
  } else if (crashed) {
    statusText = '💥 CRASHED';
    statusColor = '#ff3b3b';
  }

  return (
    <div className="relative rounded-2xl overflow-hidden" style={{ background: '#0a1020', border: '1px solid #1e2d3d' }}>
      {/* Red crash flash overlay */}
      {showCrashFlash && (
        <div
          className="absolute inset-0 pointer-events-none z-10"
          style={{ background: 'rgba(255,59,59,0.18)', animation: 'fade-in 0.05s ease' }}
        />
      )}
      {/* Seed hash badge */}
      {serverSeedHash && (
        <div
          className="absolute top-2 left-3 text-[10px] font-mono px-2 py-0.5 rounded"
          style={{ color: '#4a5568', background: '#0d1421aa', letterSpacing: '0.03em' }}
        >
          #{serverSeedHash.slice(0, 24)}…
        </div>
      )}

      {/* Central multiplier overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
        <div
          className={`font-black tabular-nums leading-none transition-all duration-150 ${running ? 'anim-neon-pulse' : ''} ${crashed ? 'anim-crash-shake' : ''}`}
          style={{
            fontSize: 'clamp(2.5rem, 8vw, 5rem)',
            color: lineColor,
            textShadow: `0 0 30px ${lineColor}66`,
            letterSpacing: '-0.02em',
          }}
        >
          {displayVal}x
        </div>
        {statusText && (
          <div
            className="mt-2 text-xs font-bold tracking-widest uppercase"
            style={{ color: statusColor }}
          >
            {statusText}
          </div>
        )}
      </div>

      {/* SVG graph */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', display: 'block', minHeight: '200px' }}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0.02" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Grid — horizontal Y ticks */}
        {ticks.map((tick) => {
          const y = yScale(tick, minY, maxY);
          return (
            <g key={tick}>
              <line
                x1={PAD.left} y1={y}
                x2={W - PAD.right} y2={y}
                stroke="#1e2d3d" strokeWidth="1"
              />
              <text
                x={PAD.left - 8} y={y + 4}
                fill="#374151" fontSize="11" textAnchor="end" fontFamily="monospace"
              >
                {tick >= 10 ? `${tick}x` : `${tick.toFixed(1)}x`}
              </text>
            </g>
          );
        })}

        {/* X axis base line */}
        <line
          x1={PAD.left} y1={PAD.top + PLOT_H}
          x2={W - PAD.right} y2={PAD.top + PLOT_H}
          stroke="#1e2d3d" strokeWidth="1"
        />

        {/* Area fill */}
        {fillD && <path d={fillD} fill={`url(#${gradId})`} />}

        {/* Curve line */}
        {pathD && (
          <path
            d={pathD}
            fill="none"
            stroke={lineColor}
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
            filter="url(#glow)"
          />
        )}

        {/* Live dot at tip */}
        {multiplierHistory.length > 0 && (
          <circle
            cx={lastX} cy={lastY} r={crashed ? 8 : 5}
            fill={lineColor}
            opacity={crashed ? 1 : 0.9}
            filter="url(#glow)"
          />
        )}
      </svg>
    </div>
  );
}
