import { useAuth } from '../auth/AuthProvider';
import { useWallet } from '../hooks/useWallet';
import { useGameSocket } from '../hooks/useGameSocket';
import BetPanel from '../components/BetPanel';
import Multiplier from '../components/Multiplier';
import BetHistory from '../components/BetHistory';
import RoundHistory from '../components/RoundHistory';

export default function GamePage() {
  const { user, logout } = useAuth();
  const { wallet } = useWallet();
  const { multiplier, status } = useGameSocket();

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1rem', fontFamily: 'sans-serif' }}>
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>🌴 Jungle Crash</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span style={{ color: '#888' }}>
            Saldo: <strong style={{ color: '#22c55e' }}>{wallet ? `R$ ${(wallet.balanceCents / 100).toFixed(2)}` : '...'}</strong>
          </span>
          <span style={{ color: '#888', fontSize: '0.875rem' }}>{user?.profile?.preferred_username}</span>
          <button onClick={logout} style={{ padding: '0.25rem 0.75rem', cursor: 'pointer', borderRadius: '0.375rem', border: '1px solid #555', background: 'transparent', color: '#aaa' }}>
            Sair
          </button>
        </div>
      </header>

      {/* Multiplier display */}
      <Multiplier multiplier={multiplier} status={status} />

      {/* Bet panel */}
      <BetPanel />

      {/* Bet history + Round history */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1.5rem' }}>
        <BetHistory />
        <RoundHistory />
      </div>
    </div>
  );
}
