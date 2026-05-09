import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useGameStore } from '../store/gameStore';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'http://localhost:4001';

export function useGameSocket() {
  const socketRef = useRef<Socket | null>(null);
  const { multiplier, status, setMultiplier, setStatus, addBet, updateBalance } = useGameStore();

  useEffect(() => {
    const socket = io(WS_URL, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('multiplier_update', (data: { multiplier: string; status: string }) => {
      setMultiplier(parseFloat(data.multiplier));
      setStatus(data.status as 'PENDING' | 'OPEN' | 'RUNNING' | 'CLOSED');
    });

    socket.on('bet_placed', (data: { userId: string; amountCents: string }) => {
      addBet({ userId: data.userId, amountCents: Number(data.amountCents) });
    });

    socket.on('balance_updated', (data: { userId: string; balanceCents: string; type: string }) => {
      updateBalance(Number(data.balanceCents));
    });

    socket.on('bet_rejected', () => {
      // handled via useGameStore notifications
    });

    return () => {
      socket.disconnect();
    };
  }, [setMultiplier, setStatus, addBet, updateBalance]);

  return { multiplier, status };
}
