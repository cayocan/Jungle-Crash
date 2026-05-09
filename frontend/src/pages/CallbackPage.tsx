import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { userManager } from '../auth/userManager';

export default function CallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    userManager
      .signinRedirectCallback()
      .then(() => navigate('/', { replace: true }))
      .catch((err) => {
        console.error('OIDC callback error', err);
        navigate('/', { replace: true });
      });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#050810' }}>
      <div className="flex flex-col items-center gap-4">
        <span className="text-5xl">🌴</span>
        <div
          className="w-6 h-6 border-2 rounded-full anim-spin"
          style={{ borderColor: '#00ff88', borderTopColor: 'transparent' }}
        />
        <p className="text-sm" style={{ color: '#374151' }}>Autenticando…</p>
      </div>
    </div>
  );
}
