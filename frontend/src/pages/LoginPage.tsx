import { useAuth } from '../auth/AuthProvider';

export default function LoginPage() {
  const { login } = useAuth();

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, #0a1f14 0%, #050810 60%)' }}
    >
      {/* Decorative glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, #00ff8812 0%, transparent 70%)', filter: 'blur(40px)' }}
      />

      {/* Card */}
      <div
        className="relative w-full max-w-sm rounded-3xl p-8 space-y-8 text-center"
        style={{ background: '#0d1421', border: '1px solid #1e2d3d', boxShadow: '0 0 60px #00ff8808' }}
      >
        {/* Logo */}
        <div className="space-y-2">
          <div className="text-6xl">🌴</div>
          <h1
            className="text-3xl font-black tracking-tight"
            style={{ color: '#00ff88', textShadow: '0 0 30px #00ff8866', letterSpacing: '-0.03em' }}
          >
            JUNGLE CRASH
          </h1>
          <p className="text-sm" style={{ color: '#4a5568' }}>
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
            <div
              key={label}
              className="flex flex-col items-center gap-1 py-3 rounded-xl"
              style={{ background: '#080c18', border: '1px solid #1e2d3d' }}
            >
              <span className="text-xl">{icon}</span>
              <span className="text-xs" style={{ color: '#4a5568' }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Login button */}
        <button
          onClick={login}
          className="w-full py-4 rounded-xl font-bold text-sm tracking-wide transition-all"
          style={{
            background: '#00ff88',
            color: '#050810',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 0 30px #00ff8855',
            letterSpacing: '0.05em',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#00cc6a'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#00ff88'; }}
        >
          ENTRAR COM KEYCLOAK
        </button>

        <p className="text-xs" style={{ color: '#374151' }}>
          Use <code style={{ color: '#4a5568' }}>player</code> / <code style={{ color: '#4a5568' }}>player123</code> para testar
        </p>
      </div>
    </div>
  );
}
