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

  return <p style={{ textAlign: 'center', marginTop: '4rem' }}>Autenticando...</p>;
}
