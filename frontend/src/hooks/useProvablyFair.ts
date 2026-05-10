import { useQuery } from '@tanstack/react-query';

const API = '/games/rounds';

export interface RoundHistoryItem {
  id: string;
  status: string;
  serverSeed?: string;
  serverSeedHash?: string;
  salt?: string;
  crashPoint?: number;
  startsAt?: string;
  endsAt?: string;
  bets: { id: string; userId: string; amountCents: string; cashoutCents?: string; multiplierAtCashout?: string }[];
}

export interface HistoryPage {
  data: RoundHistoryItem[];
  total: number;
  page: number;
  limit: number;
}

export function useRoundHistory(page: number, limit = 10) {
  return useQuery<HistoryPage>({
    queryKey: ['rounds-history', page, limit],
    queryFn: async () => {
      const res = await fetch(`${API}/history?page=${page}&limit=${limit}`);
      if (!res.ok) throw new Error('Failed to fetch history');
      return res.json() as Promise<HistoryPage>;
    },
    placeholderData: (prev) => prev,
    refetchInterval: 6000,
  });
}

async function hmacSha256Hex(keyStr: string, dataStr: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(keyStr), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const buf = await crypto.subtle.sign('HMAC', key, enc.encode(dataStr));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Replicates the backend provably fair algorithm in the browser.
 *
 * Step 1 — Commitment check:
 *   HMAC-SHA256(key="public", data=serverSeed) must equal serverSeedHash
 *   (proves the server committed to the seed before accepting bets)
 *
 * Step 2 — Crash point recomputation:
 *   h = HMAC-SHA256(key=serverSeed, data=salt)
 *   n = parseInt(h[0..12], 16)
 *   e = 2^52
 *   crash = max(1.00, floor((100*e - n) / (e - n)) / 100)
 */
export async function verifyRound(serverSeed: string, serverSeedHash: string, salt: string): Promise<{
  hashMatch: boolean;
  computedHash: string;
  computedCrashPoint: number;
}> {
  // Step 1: verify commitment
  const computedHash = await hmacSha256Hex('public', serverSeed);

  // Step 2: recompute crash point
  const crashHex = await hmacSha256Hex(serverSeed, salt);
  const n = parseInt(crashHex.slice(0, 13), 16);
  const e = Math.pow(2, 52);
  const raw = (100 * e - n) / (e - n);
  const computedCrashPoint = Math.max(1.0, Math.floor(raw) / 100);

  return {
    hashMatch: computedHash === serverSeedHash,
    computedHash,
    computedCrashPoint,
  };
}
