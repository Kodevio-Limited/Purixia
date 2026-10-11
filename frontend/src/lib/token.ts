/**
 * The access token lives here and ONLY here: a module-level variable in the
 * browser bundle. It is deliberately never written to localStorage,
 * sessionStorage or a readable cookie, so a stored-XSS payload cannot steal a
 * long-lived credential from storage. The price is that a full page reload
 * wipes it — the auth store restores it silently via the HttpOnly refresh
 * cookie (see `initAuth` in stores/authStore.ts).
 *
 * The refresh token is never visible to this code at all: the backend sets it
 * as an HttpOnly cookie and the browser attaches it automatically
 * (`withCredentials: true` in lib/axios.ts).
 */
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function clearAccessToken(): void {
  accessToken = null;
}
