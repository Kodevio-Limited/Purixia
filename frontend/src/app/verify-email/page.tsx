'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { authService } from '../../services/auth';
import { getErrorMessage } from '../../lib/utils';

type VerifyState = { status: 'verifying' } | { status: 'done'; message: string } | { status: 'error'; message: string };

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const uid = searchParams.get('uid') ?? '';
  const token = searchParams.get('token') ?? '';
  // Missing params are known at render time, so the error state is initial —
  // no setState-inside-effect needed.
  const [state, setState] = React.useState<VerifyState>(() =>
    uid && token
      ? { status: 'verifying' }
      : {
          status: 'error',
          message: 'This confirmation link is incomplete. Please open the full link from your email.',
        }
  );

  React.useEffect(() => {
    if (!uid || !token) {
      return;
    }
    let cancelled = false;
    authService
      .verifyEmail({ uid, token })
      .then((res) => {
        if (!cancelled) setState({ status: 'done', message: res.message });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ status: 'error', message: getErrorMessage(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [uid, token]);

  return (
    <div className="bg-white flex justify-center px-4 py-[60px] font-poppins">
      <div className="max-w-[440px] w-full">
        <div className="bg-white rounded-[20px] shadow-[0px_10px_40px_rgba(0,0,0,0.05)] p-8 border border-neutral-100 text-center">
          <h1 className="text-[28px] font-bold text-black mb-2">Email Confirmation</h1>
          {state.status === 'verifying' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-10 h-10 border-4 border-orange border-t-transparent rounded-full animate-spin" />
              <p className="text-[13px] text-neutral-700">Confirming your address…</p>
            </div>
          )}
          {state.status === 'done' && (
            <>
              <p className="text-[13px] text-navy mb-4">{state.message}</p>
              <Link
                href="/"
                className="inline-flex items-center justify-center w-full h-[48px] bg-orange text-white font-bold text-[16px] rounded-[8px] hover:bg-orange-700 transition-colors"
              >
                Continue Shopping
              </Link>
            </>
          )}
          {state.status === 'error' && (
            <>
              <p className="text-[13px] text-error mb-4">{state.message}</p>
              <p className="text-[13px] text-neutral-700">
                Links work once and expire after 24 hours — request a new signup link or{' '}
                <Link href="/login" className="font-bold text-orange hover:underline">
                  sign in
                </Link>{' '}
                (shopping works without confirming).
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-orange border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
