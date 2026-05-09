import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'react-hot-toast';
import { useGameStore } from '../store/gameStore';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'http://localhost:4001';

export function useGameSocket(userId?: string) {
  const socketRef = useRef<Socket | null>(null);
  const {
    setCurrentState,
    setRoundWaiting,
    setRoundStarted,
    setRoundCrashed,
    tickMultiplier,
    addBet,
    setCashedOut,
    setHasCashedOut,
    updateBalance,
  } = useGameStore();

  useEffect(() => {
    const socket = io(WS_URL, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('current_state', (data: { roundId: string; status: string; multiplier: number; serverSeedHash: string }) => {
      setCurrentState(data);
    });

    socket.on('round_waiting', (data: { roundId: string; serverSeedHash: string; bettingEndsAt: number }) => {
      setRoundWaiting(data.roundId, data.serverSeedHash, data.bettingEndsAt);
    });

    socket.on('round_started', (data: { roundId: string }) => {
      setRoundStarted(data.roundId);
    });

    socket.on('multiplier_tick', (data: { roundId: string; multiplier: number }) => {
      tickMultiplier(data.multiplier);
    });

    socket.on('round_crashed', (data: { roundId: string; crashPoint: number; serverSeed: string }) => {
      setRoundCrashed(data.crashPoint, data.serverSeed);
      toast.error(`💥 Crashed @ ${Number(data.crashPoint).toFixed(2)}x`, { duration: 3500, id: 'crash' });
    });

    socket.on('bet_placed', (data: { betId: string; roundId: string; userId: string; amountCents: string }) => {
      addBet({ betId: data.betId, userId: data.userId, amountCents: Number(data.amountCents) });
    });

    socket.on('cashout', (data: { betId: string; roundId: string; userId: string; cashoutCents: string; multiplierAtCashout: string | number }) => {
      setCashedOut(data.userId, Number(data.multiplierAtCashout), Number(data.cashoutCents));
      if (userId && data.userId === userId) {
        setHasCashedOut(true);
        toast.success(`💰 Cashout: R$ ${(Number(data.cashoutCents) / 100).toFixed(2)} @ ${Number(data.multiplierAtCashout).toFixed(2)}x`);
      }
    });

    socket.on('balance_updated', (data: { userId: string; amountCents: string | number }) => {
      updateBalance(Number(data.amountCents));
    });

    socket.on('bet_rejected', (data: { requestId: string; userId: string; reason: string }) => {
      if (userId && data.userId === userId) {
        toast.error(`Aposta rejeitada: ${data.reason}`);
      }
    });

    return () => { socket.disconnect(); };
  }, [userId]);

  return socketRef;
}
