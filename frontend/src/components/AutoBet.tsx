import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useGameStore } from '../store/gameStore';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Bot, StopCircle } from 'lucide-react';

const API = '/games';

type Strategy = 'fixed' | 'martingale';

interface AutoBetConfig {
  strategy: Strategy;
  baseAmountCents: number;      // base bet in cents
  autoCashoutAt: number | null; // auto cashout multiplier
  stopLossAmountCents: number;  // total loss limit
  stopOnWin: boolean;           // stop after first win
  maxRounds: number | null;     // max rounds to play (null = unlimited)
}

const DEFAULT_CONFIG: AutoBetConfig = {
  strategy: 'fixed',
  baseAmountCents: 1000,
  autoCashoutAt: 2.0,
  stopLossAmountCents: 10000,
  stopOnWin: false,
  maxRounds: null,
};

export default function AutoBet() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const { status, hasBet, hasCashedOut } = useGameStore();

  const [config, setConfig] = useState<AutoBetConfig>(DEFAULT_CONFIG);
  const [running, setRunning] = useState(false);
  const [stats, setStats] = useState({ rounds: 0, totalLoss: 0, totalProfit: 0 });

  // Mutable refs to access latest state inside async callbacks without stale closures
  const runningRef = useRef(false);
  const configRef = useRef(config);
  const statsRef = useRef(stats);
  const currentAmountRef = useRef(config.baseAmountCents);
  const prevWonRef = useRef<boolean | null>(null);

  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => { statsRef.current = stats; }, [stats]);

  // ── Watch for round result to decide next bet ──────────────────────────────
  const prevStatus = useRef<string>(status);
  useEffect(() => {
    // Detect transition to "betting" (new round started)
    if (prevStatus.current !== 'betting' && status === 'betting') {
      if (runningRef.current) scheduleBet();
    }
    // Detect crash: if we had a bet and didn't cash out → loss
    if (prevStatus.current === 'running' && status === 'crashed') {
      if (runningRef.current && hasBet && !hasCashedOut) {
        handleRoundResult(false, 0);
      }
    }
    prevStatus.current = status;
  }, [status]);

  // Detect cashout → win
  const prevCashedOut = useRef(hasCashedOut);
  useEffect(() => {
    if (!prevCashedOut.current && hasCashedOut && runningRef.current) {
      handleRoundResult(true, currentAmountRef.current);
    }
    prevCashedOut.current = hasCashedOut;
  }, [hasCashedOut]);

  function handleRoundResult(won: boolean, _cashoutCents: number) {
    const cfg = configRef.current;
    const s = statsRef.current;
    const betCents = currentAmountRef.current;

    const profit = won ? betCents * ((cfg.autoCashoutAt ?? 2) - 1) : -betCents;
    const newStats = {
      rounds: s.rounds + 1,
      totalLoss: s.totalLoss + (profit < 0 ? -profit : 0),
      totalProfit: s.totalProfit + profit,
    };
    setStats(newStats);
    statsRef.current = newStats;

    // Stop conditions
    if (cfg.stopOnWin && won) { stopBot('Parou após vitória'); return; }
    if (cfg.maxRounds && newStats.rounds >= cfg.maxRounds) { stopBot(`Atingiu ${cfg.maxRounds} rodadas`); return; }
    if (newStats.totalLoss >= cfg.stopLossAmountCents) { stopBot('Stop-loss atingido'); return; }

    // Martingale: double on loss, reset on win
    if (cfg.strategy === 'martingale') {
      currentAmountRef.current = won ? cfg.baseAmountCents : Math.min(betCents * 2, 100_000);
    } else {
      currentAmountRef.current = cfg.baseAmountCents;
    }

    prevWonRef.current = won;
  }

  const scheduleBet = useCallback(async () => {
    if (!runningRef.current) return;
    const cfg = configRef.current;
    const amount = currentAmountRef.current;

    // Small delay to ensure round is fully open
    await new Promise((r) => setTimeout(r, 300));
    if (!runningRef.current) return;

    try {
      const body: Record<string, unknown> = { amountCents: amount.toString() };
      if (cfg.autoCashoutAt) body.autoCashoutAt = cfg.autoCashoutAt;

      const res = await fetch(`${API}/bet`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as Record<string, unknown>;
        const msg = (err?.message as string) ?? 'Erro ao apostar';
        if (msg.includes('insufficient') || msg.includes('saldo')) {
          stopBot('Saldo insuficiente');
        }
      } else {
        queryClient.invalidateQueries({ queryKey: ['wallet'] });
      }
    } catch {
      // Network error — continue
    }
  }, [getToken, queryClient]);

  function startBot() {
    setStats({ rounds: 0, totalLoss: 0, totalProfit: 0 });
    statsRef.current = { rounds: 0, totalLoss: 0, totalProfit: 0 };
    currentAmountRef.current = config.baseAmountCents;
    prevWonRef.current = null;
    runningRef.current = true;
    setRunning(true);
    toast('🤖 Auto bet iniciado', { duration: 2000 });

    // If betting phase is already open, place bet immediately
    if (status === 'betting') scheduleBet();
  }

  function stopBot(reason?: string) {
    runningRef.current = false;
    setRunning(false);
    if (reason) toast(reason, { duration: 3000 });
  }

  const cardStyle = {
    background: '#0d1421',
    border: `1px solid ${running ? '#ffd70066' : '#1e2d3d'}`,
    borderRadius: '1rem',
    padding: '1.25rem',
  };

  function cfgNum(field: keyof AutoBetConfig, value: string, scale = 1) {
    const n = parseFloat(value.replace(',', '.'));
    if (!isNaN(n)) setConfig((c) => ({ ...c, [field]: Math.round(n * scale) as never }));
  }

  const inputStyle = {
    background: '#080c18',
    border: '1px solid #1e2d3d',
    borderRadius: '0.5rem',
    color: '#f0f0f0',
    padding: '0.4rem 0.6rem',
    fontSize: 13,
    width: '100%',
  };

  return (
    <div style={cardStyle} className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-widest flex items-center gap-1.5" style={{ color: running ? '#ffd700' : '#6b7280' }}>
          <Bot size={14} style={{ color: running ? '#ffd700' : '#6b7280' }} />
          Auto Bet
          {running && <span className="text-xs font-normal normal-case ml-1" style={{ color: '#4a5568' }}>rodada {stats.rounds}</span>}
        </h2>
        <button
          onClick={running ? () => stopBot('Bot parado manualmente') : startBot}
          disabled={!running && (config.baseAmountCents < 100)}
          className="text-xs px-3 py-1.5 rounded-lg font-bold transition-all"
          style={{
            background: running ? '#2a1010' : '#1a2a1a',
            color: running ? '#ff3b3b' : '#00ff88',
            border: `1px solid ${running ? '#ff3b3b44' : '#00ff8844'}`,
            cursor: config.baseAmountCents >= 100 ? 'pointer' : 'not-allowed',
          }}
        >
          {running ? (
            <span className="flex items-center gap-1"><StopCircle size={12} /> Parar</span>
          ) : (
            '▶ Iniciar'
          )}
        </button>
      </div>

      {/* Strategy */}
      <div>
        <label className="block text-xs mb-1" style={{ color: '#4a5568' }}>Estratégia</label>
        <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #1e2d3d' }}>
          {(['fixed', 'martingale'] as Strategy[]).map((s) => (
            <button
              key={s}
              disabled={running}
              onClick={() => setConfig((c) => ({ ...c, strategy: s }))}
              className="flex-1 text-xs py-1.5 transition-colors"
              style={{
                background: config.strategy === s ? '#1e2d3d' : 'transparent',
                color: config.strategy === s ? '#f0f0f0' : '#4a5568',
                border: 'none',
                cursor: running ? 'default' : 'pointer',
              }}
            >
              {s === 'fixed' ? 'Valor Fixo' : 'Martingale'}
            </button>
          ))}
        </div>
        {config.strategy === 'martingale' && (
          <p className="text-[10px] mt-1" style={{ color: '#374151' }}>
            Dobra a aposta a cada derrota, reinicia na vitória
          </p>
        )}
      </div>

      {/* Grid of inputs */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs mb-1" style={{ color: '#4a5568' }}>Aposta base (R$)</label>
          <input
            type="text"
            disabled={running}
            defaultValue={(config.baseAmountCents / 100).toFixed(2)}
            onBlur={(e) => cfgNum('baseAmountCents', e.target.value, 100)}
            style={inputStyle}
          />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: '#4a5568' }}>Auto cashout ×</label>
          <input
            type="text"
            disabled={running}
            defaultValue={config.autoCashoutAt?.toFixed(2) ?? ''}
            placeholder="Manual"
            onBlur={(e) => {
              const v = parseFloat(e.target.value);
              setConfig((c) => ({ ...c, autoCashoutAt: isNaN(v) || v < 1.01 ? null : v }));
            }}
            style={inputStyle}
          />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: '#4a5568' }}>Stop-loss (R$)</label>
          <input
            type="text"
            disabled={running}
            defaultValue={(config.stopLossAmountCents / 100).toFixed(2)}
            onBlur={(e) => cfgNum('stopLossAmountCents', e.target.value, 100)}
            style={inputStyle}
          />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: '#4a5568' }}>Máx. rodadas</label>
          <input
            type="text"
            disabled={running}
            defaultValue={config.maxRounds ?? ''}
            placeholder="∞"
            onBlur={(e) => {
              const v = parseInt(e.target.value);
              setConfig((c) => ({ ...c, maxRounds: isNaN(v) || v <= 0 ? null : v }));
            }}
            style={inputStyle}
          />
        </div>
      </div>

      {/* Stop on win toggle */}
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          disabled={running}
          checked={config.stopOnWin}
          onChange={(e) => setConfig((c) => ({ ...c, stopOnWin: e.target.checked }))}
          style={{ accentColor: '#00ff88' }}
        />
        <span className="text-xs" style={{ color: '#6b7280' }}>Parar após primeira vitória</span>
      </label>

      {/* Live stats */}
      {(running || stats.rounds > 0) && (
        <div className="grid grid-cols-3 gap-2 pt-2" style={{ borderTop: '1px solid #1e2d3d' }}>
          {[
            { label: 'Rodadas', value: stats.rounds },
            { label: 'Perda total', value: `R$ ${(stats.totalLoss / 100).toFixed(2)}`, color: '#ff3b3b' },
            { label: 'Lucro líq.', value: `R$ ${(stats.totalProfit / 100).toFixed(2)}`, color: stats.totalProfit >= 0 ? '#00ff88' : '#ff3b3b' },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center">
              <p className="text-[10px]" style={{ color: '#4a5568' }}>{label}</p>
              <p className="text-sm font-bold" style={{ color: color ?? '#f0f0f0' }}>{value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
