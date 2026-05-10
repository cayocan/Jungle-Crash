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
import './GamePage.css';

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
    <div className="game-page">
      {/* ─── Header ─── */}
      <header className="game-header">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🌴</span>
          <span className="game-header__logo">JUNGLE CRASH</span>
        </div>

        <div className="flex items-center gap-2 sm:gap-5 min-w-0">
          {/* Balance */}
          <div className="flex items-center gap-2">
            <Wallet size={14} className="text-muted" />
            {isCreating ? (
              <span className="text-xs text-muted">Criando carteira…</span>
            ) : walletLoading ? (
              <span className="anim-skeleton inline-block game-balance-skeleton" />
            ) : (
              <span className="game-header__balance">
                {displayBalance != null
                  ? `R$ ${(displayBalance / 100).toFixed(2)}`
                  : <span className="text-subtle">—</span>}
              </span>
            )}
          </div>

          {/* Username */}
          {username && (
            <span className="text-sm hidden md:block truncate max-w-30 text-dim">
              {username}
            </span>
          )}

          {/* Logout */}
          <button
            onClick={logout}
            className="btn-surface"
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
            <div className="bet-tab-wrap">
              {(['manual', 'auto'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setBetTab(tab)}
                  className={`bet-tab-btn${betTab === tab ? ' is-active' : ''}`}
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
