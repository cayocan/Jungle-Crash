import { useAuth } from '../auth/AuthProvider';
import './LoginPage.css';

export default function LoginPage() {
  const { login } = useAuth();

  return (
    <div className="login-page">
      {/* Decorative glow */}
      <div className="login-glow" />

      {/* Card */}
      <div className="login-card">
        {/* Logo */}
        <div className="space-y-2">
          <div className="text-6xl">🌴</div>
          <h1 className="login-title">JUNGLE CRASH</h1>
          <p className="text-sm text-muted">
            Multiplicadores ao vivo · Apostas em tempo real
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: '📈', label: 'Ao vivo' },
            { icon: '🔐', label: 'Provably Fair' },
            { icon: '⚡', label: 'Tempo real' },
          ].map(({ icon, label }) => (
            <div key={label} className="login-feature">
              <span className="text-xl">{icon}</span>
              <span className="text-xs text-muted">{label}</span>
            </div>
          ))}
        </div>

        {/* Login button */}
        <button
          onClick={login}
          className="login-cta-btn"
        >
          ENTRAR COM KEYCLOAK
        </button>

        <p className="text-xs text-subtle">
          Use <code className="text-muted">player</code> / <code className="text-muted">player123</code> para testar
        </p>
      </div>
    </div>
  );
}
