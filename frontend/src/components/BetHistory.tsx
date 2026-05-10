import { useGameStore } from '../store/gameStore';
import type { LiveBet } from '../store/gameStore';
import './BetHistory.css';

function BetRow({ bet }: { bet: LiveBet }) {
  const cashed = bet.cashedOut;
  return (
    <div className={`bet-row ${cashed ? 'bet-row--cashed' : ''} anim-fade-in`}>
      {/* Player ID */}
      <span className="font-mono text-xs user-id">
        {bet.userId.slice(0, 8)}…
      </span>

      {/* Bet amount */}
      <span className="amount">R$ {(bet.amountCents / 100).toFixed(2)}</span>

      {/* Status */}
      {cashed ? (
        <span className="flex items-center gap-1 text-xs font-bold status-cashed">
          💰 {Number(bet.cashoutMultiplier).toFixed(2)}x
          <span className="text-dim">(R$ {((bet.cashoutCents ?? 0) / 100).toFixed(2)})</span>
        </span>
      ) : (
        <span className="text-xs font-semibold status-running">
          🎲 jogando
        </span>
      )}
    </div>
  );
}

export default function BetHistory() {
  const { liveBets } = useGameStore();

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="section-title">Apostas ao vivo</h2>
        <span className="badge-count">{liveBets.length}</span>
      </div>

      <div className="bet-list">
        {liveBets.length === 0 ? (
          <p className="text-sm text-center py-6 text-subtle">
            Nenhuma aposta ainda
          </p>
        ) : (
          [...liveBets].reverse().map((bet, i) => <BetRow key={bet.betId ?? i} bet={bet} />)
        )}
      </div>
    </div>
  );
}
