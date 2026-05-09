import { useGameStore } from '../store/gameStore';

export default function BetHistory() {
  const { liveBets } = useGameStore();

  return (
    <div style={{ background: '#1a1a1a', borderRadius: '0.75rem', padding: '1rem' }}>
      <h2 style={{ marginTop: 0, marginBottom: '0.5rem', fontSize: '0.875rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Apostas ({liveBets.length})
      </h2>
      <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
        {liveBets.length === 0 ? (
          <p style={{ color: '#555', fontSize: '0.875rem' }}>Nenhuma aposta ainda</p>
        ) : (
          liveBets.map((bet, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', borderBottom: '1px solid #222', fontSize: '0.875rem' }}>
              <span style={{ color: '#ccc' }}>{bet.userId.slice(0, 8)}…</span>
              <span style={{ color: '#22c55e' }}>R$ {(bet.amountCents / 100).toFixed(2)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
