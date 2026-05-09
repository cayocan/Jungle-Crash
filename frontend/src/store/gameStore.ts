import { create } from 'zustand';

type RoundStatus = 'PENDING' | 'OPEN' | 'RUNNING' | 'CLOSED' | 'unknown';

interface LiveBet {
  userId: string;
  amountCents: number;
}

interface GameState {
  multiplier: number;
  status: RoundStatus;
  liveBets: LiveBet[];
  balance: number | null;
  notification: string | null;

  setMultiplier: (m: number) => void;
  setStatus: (s: RoundStatus) => void;
  addBet: (bet: LiveBet) => void;
  clearBets: () => void;
  updateBalance: (cents: number) => void;
  setNotification: (msg: string | null) => void;
}

export const useGameStore = create<GameState>((set) => ({
  multiplier: 1.0,
  status: 'unknown',
  liveBets: [],
  balance: null,
  notification: null,

  setMultiplier: (m) => set({ multiplier: m }),
  setStatus: (s) =>
    set((state) => ({
      status: s,
      liveBets: s === 'PENDING' ? [] : state.liveBets,
    })),
  addBet: (bet) => set((state) => ({ liveBets: [...state.liveBets, bet] })),
  clearBets: () => set({ liveBets: [] }),
  updateBalance: (cents) => set({ balance: cents }),
  setNotification: (msg) => set({ notification: msg }),
}));
