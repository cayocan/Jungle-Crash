import { useState } from 'react';
import { LogOut, Wallet } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { useWallet } from '../hooks/useWallet';
import { useGameSocket } from '../hooks/useGameSocket';
import CrashGraph from '../components/CrashGraph';
import BetPanel from '../components/BetPanel';
import AutoBet from '../components/AutoBet';
import BetHistory from '../components/BetHistory';
import RoundHistory from '../components/RoundHistory';
import ProvablyFairModal from '../components/ProvablyFairModal';
import Leaderboard from '../components/Leaderboard';

export default function GamePage() {
  const { user, logout } = useAuth();
  const { wallet, isLoading: walletLoading, isCreating } = useWallet();
  const userId = user?.profile?.sub;
  const [showFair, setShowFair] = useState(false);
  const [betTab, setBetTab] = useState<'manual' | 'auto'>('manual');

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

        <div className="flex items-center gap-2 sm:gap-5 min-w-0">
          {/* Balance */}
          <div className="flex items-center gap-2">
            <Wallet size={14} style={{ color: '#4a5568' }} />
            {isCreating ? (
              <span className="text-xs" style={{ color: '#4a5568' }}>Criando carteira…</span>
            ) : walletLoading ? (
              <span className="anim-skeleton inline-block" style={{ width: 72, height: 14 }} />
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
            <span className="text-sm hidden md:block truncate max-w-30" style={{ color: '#6b7280' }}>
              {username}
            </span>
          )}

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
      <main className="flex-1 max-w-6xl w-full mx-auto p-2 sm:p-4 space-y-3 sm:space-y-4 overflow-x-hidden">
        {/* Crash graph */}
        <CrashGraph />

        {/* Bet controls + Round history */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-3 space-y-2">
            {/* Manual / Auto tabs */}
            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #1e2d3d', background: '#0d1421' }}>
              {(['manual', 'auto'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setBetTab(tab)}
                  className="flex-1 text-xs py-2 font-semibold transition-colors"
                  style={{
                    background: betTab === tab ? '#1e2d3d' : 'transparent',
                    color: betTab === tab ? '#f0f0f0' : '#4a5568',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {tab === 'manual' ? '🎲 Manual' : '🤖 Auto'}
                </button>
              ))}
            </div>
            {betTab === 'manual' ? <BetPanel userId={userId} /> : <AutoBet />}
          </div>
          <div className="md:col-span-2">
            <RoundHistory onVerify={() => setShowFair(true)} />
          </div>
        </div>

        {/* Live bets table */}
        <BetHistory />

        {/* Leaderboard */}
        <Leaderboard />
      </main>

      {showFair && <ProvablyFairModal onClose={() => setShowFair(false)} />}
    </div>
  );
}
