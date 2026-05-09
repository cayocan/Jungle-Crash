import { useAuth } from '../auth/AuthProvider';
import GamePage from './GamePage';
import LoginPage from './LoginPage';

function LoadingSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#050810' }}>
      <div className="flex flex-col items-center gap-4">
        <span className="text-5xl">🌴</span>
        <div
          className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: '#00ff88', borderTopColor: 'transparent' }}
        />
        <p className="text-sm" style={{ color: '#374151' }}>Carregando…</p>
      </div>
    </div>
  );
}

export default function IndexPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <LoadingSkeleton />;
  return user ? <GamePage /> : <LoginPage />;
}
