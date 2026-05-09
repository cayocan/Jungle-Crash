import { useGameStore } from '../store/gameStore';
import type { LiveBet } from '../store/gameStore';

function BetRow({ bet }: { bet: LiveBet }) {
  const cashed = bet.cashedOut;
  return (
    <div
      className="flex items-center justify-between py-2 px-3 rounded-lg text-sm transition-all anim-fade-in"
      style={{
        background: cashed ? '#0d1f14' : 'transparent',
        border: cashed ? '1px solid #1a3320' : '1px solid transparent',
        marginBottom: '4px',
      }}
    >
      {/* Player ID */}
      <span className="font-mono text-xs" style={{ color: '#4a5568' }}>
        {bet.userId.slice(0, 8)}…
      </span>

      {/* Bet amount */}
      <span style={{ color: '#9ca3af' }}>
        R$ {(bet.amountCents / 100).toFixed(2)}
      </span>

      {/* Status */}
      {cashed ? (
        <span className="flex items-center gap-1 text-xs font-bold" style={{ color: '#00ff88' }}>
          💰 {Number(bet.cashoutMultiplier).toFixed(2)}x
          <span style={{ color: '#6b7280' }}>(R$ {((bet.cashoutCents ?? 0) / 100).toFixed(2)})</span>
        </span>
      ) : (
        <span className="text-xs font-semibold" style={{ color: '#ffd700' }}>
          🎲 jogando
        </span>
      )}
    </div>
  );
}

export default function BetHistory() {
  const { liveBets } = useGameStore();

  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: '#0d1421', border: '1px solid #1e2d3d' }}
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: '#4a5568' }}>
          Apostas ao vivo
        </h2>
        <span
          className="text-xs px-2 py-0.5 rounded-full font-mono"
          style={{ background: '#1e2d3d', color: '#6b7280' }}
        >
          {liveBets.length}
        </span>
      </div>

      <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
        {liveBets.length === 0 ? (
          <p className="text-sm text-center py-6" style={{ color: '#374151' }}>
            Nenhuma aposta ainda
          </p>
        ) : (
          [...liveBets].reverse().map((bet, i) => <BetRow key={bet.betId ?? i} bet={bet} />)
        )}
      </div>
    </div>
  );
}
