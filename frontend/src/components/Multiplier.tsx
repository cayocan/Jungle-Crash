type Status = 'PENDING' | 'OPEN' | 'RUNNING' | 'CLOSED' | 'unknown';

interface Props {
  multiplier: number;
  status: Status;
}

const statusColor: Record<Status, string> = {
  RUNNING: '#22c55e',
  CLOSED: '#ef4444',
  OPEN: '#facc15',
  PENDING: '#888',
  unknown: '#888',
};

const statusLabel: Record<Status, string> = {
  RUNNING: 'Rodando',
  CLOSED: 'Crashou',
  OPEN: 'Apostas abertas',
  PENDING: 'Aguardando',
  unknown: '...',
};

export default function Multiplier({ multiplier, status }: Props) {
  const color = statusColor[status];

  return (
    <div style={{ textAlign: 'center', padding: '2rem', background: '#111', borderRadius: '1rem', marginBottom: '1rem' }}>
      <div style={{ fontSize: '5rem', fontWeight: 'bold', color, transition: 'color 0.3s' }}>
        {multiplier.toFixed(2)}x
      </div>
      <div style={{ marginTop: '0.5rem', color, fontSize: '1rem' }}>{statusLabel[status]}</div>
    </div>
  );
}
