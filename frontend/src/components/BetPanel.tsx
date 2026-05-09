import { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useGameStore } from '../store/gameStore';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Timer, TrendingUp, DollarSign } from 'lucide-react';

const API = '/games';

interface Props { userId?: string; }

export default function BetPanel({ userId }: Props) {
  const { getToken } = useAuth();
  const { status, multiplier, bettingEndsAt, hasBet, hasCashedOut, setHasBet } = useGameStore();
  const queryClient = useQueryClient();

  const [amountInput, setAmountInput] = useState('1000');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Countdown timer
  useEffect(() => {
    if (!bettingEndsAt) { setCountdown(0); return; }
    const tick = () => setCountdown(Math.max(0, Math.ceil((bettingEndsAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [bettingEndsAt]);

  const amountCents = Math.round(parseFloat(amountInput || '0') * 100);
  const canBet = status === 'betting' && !hasBet && amountCents >= 100 && amountCents <= 100_000;
  const canCashout = status === 'running' && hasBet && !hasCashedOut;
  const potentialPayout = hasBet && status === 'running' ? (amountCents * multiplier) / 100 : null;

  async function placeBet() {
    if (!canBet) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/bet`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountCents }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body?.message ?? 'Erro ao apostar');
      } else {
        setHasBet(true);
        toast.success(`Aposta de R$ ${(amountCents / 100).toFixed(2)} confirmada!`);
      }
    } catch {
      toast.error('Erro de conexão');
    } finally {
      setLoading(false);
    }
  }

  async function cashout() {
    if (!canCashout) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/bet/cashout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body?.message ?? 'Erro ao fazer cashout');
      } else {
        queryClient.invalidateQueries({ queryKey: ['wallet'] });
      }
    } catch {
      toast.error('Erro de conexão');
    } finally {
      setLoading(false);
    }
  }

  const cardStyle = { background: '#0d1421', border: '1px solid #1e2d3d', borderRadius: '1rem', padding: '1.25rem' };

  return (
    <div style={cardStyle} className="space-y-4">
      {/* Title + countdown */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: '#6b7280' }}>Apostar</h2>
        {status === 'betting' && countdown > 0 && (
          <div className="flex items-center gap-1.5 text-sm font-bold" style={{ color: '#ffd700' }}>
            <Timer size={14} />
            <span>{countdown}s</span>
          </div>
        )}
      </div>

      {/* Amount input */}
      <div>
        <label className="block text-xs mb-1.5" style={{ color: '#4a5568' }}>
          Valor da aposta (R$)
        </label>
        <div className="flex gap-2 flex-wrap">
          {[5, 10, 25, 50].map((v) => (
            <button
              key={v}
              onClick={() => setAmountInput(String(v))}
              disabled={!canBet || loading}
              className="text-xs px-2 py-1 rounded"
              style={{
                background: amountInput === String(v) ? '#1e2d3d' : 'transparent',
                border: '1px solid #1e2d3d',
                color: '#6b7280',
                cursor: canBet ? 'pointer' : 'default',
              }}
            >
              R${v}
            </button>
          ))}
        </div>
        <div className="flex items-center mt-2" style={{ border: '1px solid #1e2d3d', borderRadius: '0.5rem', background: '#080c18' }}>
          <DollarSign size={16} style={{ color: '#4a5568', marginLeft: '0.75rem', flexShrink: 0 }} />
          <input
            type="number"
            min={1}
            max={1000}
            step={0.5}
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            disabled={!canBet || loading}
            className="flex-1 bg-transparent text-sm px-2 py-3 outline-none"
            style={{ color: canBet ? '#f0f0f0' : '#4a5568' }}
          />
        </div>
        {amountCents < 100 && amountInput !== '' && (
          <p className="text-xs mt-1" style={{ color: '#ff3b3b' }}>Aposta mínima: R$ 1,00</p>
        )}
        {amountCents > 100_000 && (
          <p className="text-xs mt-1" style={{ color: '#ff3b3b' }}>Aposta máxima: R$ 1.000,00</p>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={placeBet}
          disabled={!canBet || loading}
          className="flex-1 py-3 rounded-lg font-bold text-sm transition-all"
          style={{
            background: canBet ? '#00ff88' : '#1a2a1a',
            color: canBet ? '#050810' : '#2a4a2a',
            cursor: canBet ? 'pointer' : 'not-allowed',
            border: 'none',
            boxShadow: canBet ? '0 0 20px #00ff8844' : 'none',
          }}
        >
          {loading && canBet ? (
            <span className="flex items-center justify-center gap-2">
              <span className="anim-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
              Apostando…
            </span>
          ) : status === 'betting' ? '🎲 Apostar' : hasBet ? '✅ Apostado' : 'Aguardando…'}
        </button>

        <button
          onClick={cashout}
          disabled={!canCashout || loading}
          className="flex-1 py-3 rounded-lg font-bold text-sm transition-all"
          style={{
            background: canCashout ? '#ffd700' : '#2a2510',
            color: canCashout ? '#050810' : '#4a4010',
            cursor: canCashout ? 'pointer' : 'not-allowed',
            border: 'none',
            boxShadow: canCashout ? '0 0 20px #ffd70044' : 'none',
          }}
        >
          {loading && canCashout ? (
            <span className="flex items-center justify-center gap-2">
              <span className="anim-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
              …
            </span>
          ) : (
            <span className="flex items-center justify-center gap-1.5">
              <TrendingUp size={14} />
              {canCashout && potentialPayout != null
                ? `Cashout R$ ${potentialPayout.toFixed(2)}`
                : 'Cash Out'}
            </span>
          )}
        </button>
      </div>

      {/* Status message */}
      {status === 'crashed' && hasBet && !hasCashedOut && (
        <p className="text-xs text-center" style={{ color: '#ff3b3b' }}>
          💸 Aposta perdida nesta rodada
        </p>
      )}
      {status === 'crashed' && hasCashedOut && (
        <p className="text-xs text-center" style={{ color: '#00ff88' }}>
          💰 Cashout realizado com sucesso!
        </p>
      )}
    </div>
  );
}
