import axios from 'axios';
import { clearAccessToken, getAccessToken, setAccessToken } from './token';

const BASE_API = process.env.NEXT_PUBLIC_API_URL || 'https://admin.purixiabd.com';

const api = axios.create({
  baseURL: BASE_API,
  headers: {
    'Content-Type': 'application/json',
  },
  // Required so the browser attaches the HttpOnly refresh cookie to the auth
  // endpoints (login/register responses also set it via this flag).
  withCredentials: true,
});

api.interceptors.request.use(
  (config) => {
    const accessToken = getAccessToken();
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

interface QueuedRequest {
  resolve: (token: string | null) => void;
  reject: (error: unknown) => void;
}

let isRefreshing = false;
let failedQueue: QueuedRequest[] = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Endpoints that manage their own 401s — the interceptor must not try to
// refresh for them (and must not bounce an already-public page to register).
const AUTH_URLS = [
  '/api/auth/token/refresh/',
  '/api/auth/login/',
  '/api/auth/register/',
  '/api/auth/password/reset/',
  '/api/auth/password/reset/confirm/',
  '/api/auth/verify-email/',
];

const redirectToRegister = () => {
  if (typeof window !== 'undefined') {
    const currentPath = window.location.pathname;
    if (currentPath !== '/login' && currentPath !== '/register') {
      // Redirect to register as per user request for unauthenticated flow
      window.location.href = `/register?redirect=${encodeURIComponent(currentPath)}`;
    }
  }
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Check if error is 401 and request hasn't been retried
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (AUTH_URLS.includes(originalRequest.url)) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Single flight: the refresh cookie (HttpOnly, Path=/api/auth/) rides
        // along via withCredentials — no body needed. The backend rotates the
        // cookie and returns only the new access token.
        const response = await api.post('/api/auth/token/refresh/', {});
        const newAccessToken = response.data.access;

        setAccessToken(newAccessToken);
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

        processQueue(null, newAccessToken);
        isRefreshing = false;

        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;

        // Refresh failed (expired/blacklisted/missing cookie): the session is
        // over. Drop the in-memory token and send the user to re-authenticate.
        clearAccessToken();
        redirectToRegister();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
