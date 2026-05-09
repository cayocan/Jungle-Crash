import { useAuth } from '../auth/AuthProvider';

export default function LoginPage() {
  const { login } = useAuth();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '1rem' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>🌴 Jungle Crash</h1>
      <p style={{ color: '#888' }}>Faça login para jogar</p>
      <button
        onClick={login}
        style={{ padding: '0.75rem 2rem', fontSize: '1rem', borderRadius: '0.5rem', cursor: 'pointer', background: '#22c55e', color: '#fff', border: 'none' }}
      >
        Entrar com Keycloak
      </button>
    </div>
  );
}
