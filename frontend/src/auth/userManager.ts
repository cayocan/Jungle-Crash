import { UserManager, WebStorageStateStore } from 'oidc-client-ts';

const KEYCLOAK_URL = import.meta.env.VITE_KEYCLOAK_URL ?? 'http://localhost:8080';
const REALM = import.meta.env.VITE_KEYCLOAK_REALM ?? 'crash-game';
const CLIENT_ID = import.meta.env.VITE_KEYCLOAK_CLIENT_ID ?? 'crash-game-client';

export const userManager = new UserManager({
  authority: `${KEYCLOAK_URL}/realms/${REALM}`,
  client_id: CLIENT_ID,
  redirect_uri: `${window.location.origin}/callback`,
  post_logout_redirect_uri: window.location.origin,
  response_type: 'code',
  scope: 'openid profile email',
  userStore: new WebStorageStateStore({ store: sessionStorage }),
  // PKCE S256 is the default in oidc-client-ts v3
});
