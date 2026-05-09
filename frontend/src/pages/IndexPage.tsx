import { useAuth } from '../auth/AuthProvider';
import GamePage from './GamePage';
import LoginPage from './LoginPage';

export default function IndexPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <p style={{ textAlign: 'center', marginTop: '4rem' }}>Carregando...</p>;
  }

  return user ? <GamePage /> : <LoginPage />;
}
