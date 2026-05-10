import { useAuth } from '../auth/AuthProvider';
import GamePage from './GamePage';
import LoginPage from './LoginPage';
import './IndexPage.css';

function LoadingSkeleton() {
  return (
    <div className="index-loading-page min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <span className="text-5xl">🌴</span>
        <div className="index-loading-spinner w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-subtle">Carregando…</p>
      </div>
    </div>
  );
}

export default function IndexPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <LoadingSkeleton />;
  return user ? <GamePage /> : <LoginPage />;
}
