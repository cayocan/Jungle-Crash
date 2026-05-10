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
  const colorClass = color === '#22c55e'
    ? 'multiplier-running'
    : color === '#ef4444'
      ? 'multiplier-closed'
      : color === '#facc15'
        ? 'multiplier-open'
        : 'multiplier-pending';

  return (
    <div className="multiplier-card">
      <div className={`multiplier-value ${colorClass}`}>
        {multiplier.toFixed(2)}x
      </div>
      <div className={`multiplier-status ${colorClass}`}>{statusLabel[status]}</div>
    </div>
  );
}
import './Multiplier.css';
