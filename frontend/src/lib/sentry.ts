import * as Sentry from '@sentry/nextjs';

let initialised = false;

/**
 * Browser error reporting. Runs only when NEXT_PUBLIC_SENTRY_DSN is set —
 * otherwise a no-op, so local dev and DSN-less deploys behave exactly as
 * before. Called once from the root Providers effect (client-side only).
 *
 * Deliberately minimal: plain `Sentry.init`, no `withSentryConfig` wrapper
 * and no server instrumentation, so the build pipeline is unchanged. That
 * means SSR/route-handler crashes are NOT captured yet — browser errors and
 * transaction traces are. See DEPLOYMENT.md.
 */
export function initSentry(): void {
  const dsn = (process.env.NEXT_PUBLIC_SENTRY_DSN || '').trim();
  if (!dsn || initialised) {
    return;
  }
  initialised = true;
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENV || 'production',
    // Performance traces are sampled; errors are always sent.
    // (v11 sends no PII by default; there is no opt-in flag to set.)
    tracesSampleRate: 0.1,
  });
}
