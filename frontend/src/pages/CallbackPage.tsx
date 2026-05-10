import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { userManager } from '../auth/userManager';
import './CallbackPage.css';

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
    <div className="callback-page">
      <div className="flex flex-col items-center gap-4">
        <span className="text-5xl">🌴</span>
        <div className="callback-spinner anim-spin" />
        <p className="text-sm text-subtle">Autenticando…</p>
      </div>
    </div>
  );
}
