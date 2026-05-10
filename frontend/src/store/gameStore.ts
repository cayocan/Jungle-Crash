import { create } from 'zustand';

export type RoundStatus = 'idle' | 'betting' | 'running' | 'crashed';

export interface LiveBet {
  betId?: string;
  userId: string;
  amountCents: number;
  cashedOut?: boolean;
  cashoutMultiplier?: number;
  cashoutCents?: number;
}

interface GameState {
  roundId: string | null;
  status: RoundStatus;
  multiplier: number;
  serverSeedHash: string | null;
  serverSeed: string | null;
  bettingEndsAt: number | null;
  crashPoint: number | null;
  multiplierHistory: number[];
  liveBets: LiveBet[];
  hasBet: boolean;
  hasCashedOut: boolean;
  balance: number | null;

  setCurrentState: (s: { roundId: string; status: string; multiplier: number; serverSeedHash: string }) => void;
  setRoundWaiting: (roundId: string, hash: string, endsAt: number) => void;
  setRoundStarted: (roundId: string) => void;
  setRoundCrashed: (crashPoint: number, serverSeed: string) => void;
  tickMultiplier: (m: number) => void;
  addBet: (bet: LiveBet) => void;
  setCashedOut: (userId: string, mult: number, cents: number) => void;
  setHasBet: (v: boolean) => void;
  setHasCashedOut: (v: boolean) => void;
  updateBalance: (cents: number) => void;
}

export const useGameStore = create<GameState>((set) => ({
  roundId: null,
  status: 'idle',
  multiplier: 1.0,
  serverSeedHash: null,
  serverSeed: null,
  bettingEndsAt: null,
  crashPoint: null,
  multiplierHistory: [],
  liveBets: [],
  hasBet: false,
  hasCashedOut: false,
  balance: null,

  setCurrentState: ({ roundId, status, multiplier, serverSeedHash }) =>
    set({
      roundId,
      serverSeedHash,
      multiplier,
      status: status === 'OPEN' ? 'betting' : status === 'CLOSED' ? 'running' : 'idle',
    }),

  setRoundWaiting: (roundId, hash, endsAt) =>
    set({
      roundId,
      status: 'betting',
      serverSeedHash: hash,
      serverSeed: null,
      bettingEndsAt: endsAt,
      crashPoint: null,
      multiplier: 1.0,
      multiplierHistory: [],
      liveBets: [],
      hasBet: false,
      hasCashedOut: false,
    }),

  setRoundStarted: (roundId) => set({ roundId, status: 'running', bettingEndsAt: null }),

  setRoundCrashed: (crashPoint, serverSeed) =>
    set({ status: 'crashed', crashPoint, serverSeed }),

  tickMultiplier: (m) =>
    set((s) => ({
      multiplier: m,
      multiplierHistory: [...s.multiplierHistory, m].slice(-600),
    })),

  addBet: (bet) => set((s) => ({ liveBets: [...s.liveBets, bet] })),

  setCashedOut: (userId, mult, cents) =>
    set((s) => ({
      liveBets: s.liveBets.map((b) =>
        b.userId === userId
          ? { ...b, cashedOut: true, cashoutMultiplier: mult, cashoutCents: cents }
          : b,
      ),
    })),

  setHasBet: (v) => set({ hasBet: v }),
  setHasCashedOut: (v) => set({ hasCashedOut: v }),
  updateBalance: (cents) => set({ balance: cents }),
}));
