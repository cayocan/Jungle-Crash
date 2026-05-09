import { useState } from 'react';
import { LogOut, Wallet, ShieldCheck } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { useWallet } from '../hooks/useWallet';
import { useGameSocket } from '../hooks/useGameSocket';
import CrashGraph from '../components/CrashGraph';
import BetPanel from '../components/BetPanel';
import BetHistory from '../components/BetHistory';
import RoundHistory from '../components/RoundHistory';
import ProvablyFairModal from '../components/ProvablyFairModal';

export default function GamePage() {
  const { user, logout } = useAuth();
  const { wallet, isCreating } = useWallet();
  const userId = user?.profile?.sub;
  const [showFair, setShowFair] = useState(false);

  useGameSocket(userId);

  const displayBalance = wallet ? Number(wallet.balanceCents) : null;
  const username = user?.profile?.preferred_username as string | undefined;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#050810' }}>
      {/* ─── Header ─── */}
      <header
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ background: '#0a1020', borderBottom: '1px solid #1e2d3d' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-2xl">🌴</span>
          <span className="font-black text-lg tracking-tight" style={{ color: '#00ff88', letterSpacing: '-0.02em' }}>
            JUNGLE CRASH
          </span>
        </div>

        <div className="flex items-center gap-5">
          {/* Balance */}
          <div className="flex items-center gap-2">
            <Wallet size={14} style={{ color: '#4a5568' }} />
            {isCreating ? (
              <span className="text-xs" style={{ color: '#4a5568' }}>Criando carteira…</span>
            ) : (
              <span className="text-sm font-bold" style={{ color: '#00ff88' }}>
                {displayBalance != null
                  ? `R$ ${(displayBalance / 100).toFixed(2)}`
                  : <span style={{ color: '#374151' }}>—</span>}
              </span>
            )}
          </div>

          {/* Username */}
          {username && (
            <span className="text-sm hidden sm:block" style={{ color: '#6b7280' }}>
              {username}
            </span>
          )}

          {/* Provably Fair */}
          <button
            onClick={() => setShowFair(true)}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg transition-colors"
            style={{ color: '#00ff88', border: '1px solid #00ff8840', background: 'transparent' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#00ff8815'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <ShieldCheck size={12} />
            <span>Verificar</span>
          </button>

          {/* Logout */}
          <button
            onClick={logout}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg transition-colors"
            style={{ color: '#6b7280', border: '1px solid #1e2d3d', background: 'transparent' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#f0f0f0'; e.currentTarget.style.borderColor = '#374151'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#6b7280'; e.currentTarget.style.borderColor = '#1e2d3d'; }}
          >
            <LogOut size={12} />
            <span>Sair</span>
          </button>
        </div>
      </header>

      {/* ─── Main ─── */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 space-y-4">
        {/* Crash graph */}
        <CrashGraph />

        {/* Bet controls + Round history */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-3">
            <BetPanel userId={userId} />
          </div>
          <div className="md:col-span-2">
            <RoundHistory />
          </div>
        </div>

        {/* Live bets table */}
        <BetHistory />
      </main>

      {showFair && <ProvablyFairModal onClose={() => setShowFair(false)} />}
    </div>
  );
}
