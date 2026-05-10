import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useGameStore } from '../store/gameStore';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Bot, StopCircle } from 'lucide-react';
import './AutoBet.css';

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
        // 402 = saldo insuficiente; 409 = round fechado / já apostou (continua tentando)
        if (res.status === 402 || msg.toLowerCase().includes('saldo') || msg.toLowerCase().includes('insufficient')) {
          stopBot(msg);
        }
        // 409 = race condition normal (round fechou no último ms) — ignora silenciosamente
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

  function cfgNum(field: keyof AutoBetConfig, value: string, scale = 1) {
    const n = parseFloat(value.replace(',', '.'));
    if (!isNaN(n)) setConfig((c) => ({ ...c, [field]: Math.round(n * scale) as never }));
  }

  return (
    <div className={`card${running ? ' autobet-running' : ''} space-y-3`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className={`section-title flex items-center gap-1.5${running ? ' autobet-title is-running' : ''}`}>
          <Bot size={14} className={running ? 'text-gold' : 'text-dim'} />
          Auto Bet
          {running && <span className="text-xs font-normal normal-case ml-1 text-muted">rodada {stats.rounds}</span>}
        </h2>
        <button
          onClick={running ? () => stopBot('Bot parado manualmente') : startBot}
          disabled={!running && (config.baseAmountCents < 100)}
          className={`autobet-start-btn${running ? ' is-running' : ''}`}
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
        <label className="field-label">Estratégia</label>
        <div className="tab-group">
          {(['fixed', 'martingale'] as Strategy[]).map((s) => (
            <button
              key={s}
              disabled={running}
              onClick={() => setConfig((c) => ({ ...c, strategy: s }))}
              className={`tab-btn${config.strategy === s ? ' is-active' : ''}`}
            >
              {s === 'fixed' ? 'Valor Fixo' : 'Martingale'}
            </button>
          ))}
        </div>
        {config.strategy === 'martingale' && (
          <p className="autobet-hint">
            Dobra a aposta a cada derrota, reinicia na vitória
          </p>
        )}
      </div>

      {/* Grid of inputs */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="field-label">Aposta base (R$)</label>
          <input
            type="text"
            disabled={running}
            defaultValue={(config.baseAmountCents / 100).toFixed(2)}
            onBlur={(e) => cfgNum('baseAmountCents', e.target.value, 100)}
            className="autobet-input"
          />
        </div>
        <div>
          <label className="field-label">Auto cashout ×</label>
          <input
            type="text"
            disabled={running}
            defaultValue={config.autoCashoutAt?.toFixed(2) ?? ''}
            placeholder="Manual"
            onBlur={(e) => {
              const v = parseFloat(e.target.value);
              setConfig((c) => ({ ...c, autoCashoutAt: isNaN(v) || v < 1.01 ? null : v }));
            }}
            className="autobet-input"
          />
        </div>
        <div>
          <label className="field-label">Stop-loss (R$)</label>
          <input
            type="text"
            disabled={running}
            defaultValue={(config.stopLossAmountCents / 100).toFixed(2)}
            onBlur={(e) => cfgNum('stopLossAmountCents', e.target.value, 100)}
            className="autobet-input"
          />
        </div>
        <div>
          <label className="field-label">Máx. rodadas</label>
          <input
            type="text"
            disabled={running}
            defaultValue={config.maxRounds ?? ''}
            placeholder="∞"
            onBlur={(e) => {
              const v = parseInt(e.target.value);
              setConfig((c) => ({ ...c, maxRounds: isNaN(v) || v <= 0 ? null : v }));
            }}
            className="autobet-input"
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
          className="autobet-checkbox"
        />
        <span className="text-xs text-dim">Parar após primeira vitória</span>
      </label>

      {/* Live stats */}
      {(running || stats.rounds > 0) && (
        <div className="grid grid-cols-3 gap-2 autobet-stats">
          {[
            { label: 'Rodadas', value: stats.rounds },
            { label: 'Perda total', value: `R$ ${(stats.totalLoss / 100).toFixed(2)}`, color: '#ff3b3b' },
            { label: 'Lucro líq.', value: `R$ ${(stats.totalProfit / 100).toFixed(2)}`, color: stats.totalProfit >= 0 ? '#00ff88' : '#ff3b3b' },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center">
              <p className="text-[10px] text-muted">{label}</p>
              <p className={`text-sm font-bold${color === '#ff3b3b' ? ' text-crash' : color === '#00ff88' ? ' text-success' : ''}`}>{value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

