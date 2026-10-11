import api from '../lib/axios';
import { clearAccessToken, getAccessToken, setAccessToken } from '../lib/token';
import {
  User,
  Tokens,
  AuthResponse,
  RegisterPayload,
  LoginPayload,
  PasswordResetRequestPayload,
  PasswordResetConfirmPayload,
  EmailVerificationPayload,
} from '../types';

// Token helpers (names kept for call-site stability). The access token is
// held in memory only — never localStorage/sessionStorage. The refresh token
// is an HttpOnly cookie owned by the backend and never touches this code.
export const saveTokens = (tokens: Tokens): void => {
  if (tokens?.access) {
    setAccessToken(tokens.access);
  }
};

export const clearTokens = (): void => {
  clearAccessToken();
};

export { getAccessToken };

export const isAuthenticated = (): boolean => {
  return !!getAccessToken();
};

export const authService = {
  register: async (data: RegisterPayload): Promise<AuthResponse> => {
    const response = await api.post('/api/auth/register/', data);
    return response.data;
  },

  login: async (data: LoginPayload): Promise<AuthResponse> => {
    const response = await api.post('/api/auth/login/', data);
    return response.data;
  },

  // The refresh cookie rides along automatically (withCredentials); no body
  // needed. The backend blacklists the token and expires the cookie.
  logout: async (): Promise<void> => {
    await api.post('/api/auth/logout/', {});
  },

  // Silent session restore after a page reload: the cookie is sent, the fresh
  // access token comes back in the body.
  refreshSession: async (): Promise<{ access: string }> => {
    const response = await api.post('/api/auth/token/refresh/', {});
    return response.data;
  },

  requestPasswordReset: async (data: PasswordResetRequestPayload): Promise<{ message: string }> => {
    const response = await api.post('/api/auth/password/reset/', data);
    return response.data;
  },

  confirmPasswordReset: async (data: PasswordResetConfirmPayload): Promise<{ message: string }> => {
    const response = await api.post('/api/auth/password/reset/confirm/', data);
    return response.data;
  },

  verifyEmail: async (data: EmailVerificationPayload): Promise<{ message: string }> => {
    const response = await api.post('/api/auth/verify-email/', data);
    return response.data;
  },

  me: async (): Promise<User> => {
    const response = await api.get('/api/auth/me/');
    return response.data;
  },

  updateMe: async (data: Partial<User>): Promise<User> => {
    const response = await api.patch('/api/auth/me/', data);
    return response.data;
  },
};
