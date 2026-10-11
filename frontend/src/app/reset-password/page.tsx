'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Suspense } from 'react';
import { authService } from '../../services/auth';
import { getErrorMessage } from '../../lib/utils';
import { KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';

const resetSchema = z
  .object({
    new_password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm_password: z.string(),
  })
  .refine((values) => values.new_password === values.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });

type ResetFormValues = z.infer<typeof resetSchema>;

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const uid = searchParams.get('uid') ?? '';
  const token = searchParams.get('token') ?? '';
  const [done, setDone] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { new_password: '', confirm_password: '' },
  });

  const onSubmit = async (values: ResetFormValues) => {
    setPending(true);
    try {
      await authService.confirmPasswordReset({ uid, token, new_password: values.new_password });
      setDone(true);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="bg-white flex justify-center px-4 py-[60px] font-poppins">
      <div className="max-w-[440px] w-full">
        <div className="bg-white rounded-[20px] shadow-[0px_10px_40px_rgba(0,0,0,0.05)] p-8 border border-gray-50">
          <div className="text-center mb-6">
            <h1 className="text-[28px] font-bold text-black mb-1">Choose a New Password</h1>
            <p className="text-[13px] text-[#666666]">
              {done ? 'Your password has been reset' : 'This link works once — pick a strong password'}
            </p>
          </div>

          {done ? (
            <div className="text-center space-y-4">
              <p className="text-[13px] text-[#333333]">You can now sign in with your new password.</p>
              <Link
                href="/login"
                className="inline-flex items-center justify-center w-full h-[48px] bg-[#F4B227] text-white font-bold text-[16px] rounded-[8px] hover:bg-[#D89500] transition-colors"
              >
                Sign In
              </Link>
            </div>
          ) : !uid || !token ? (
            <p className="text-[13px] text-red-500 text-center">
              This reset link is incomplete. Please open the full link from your email.
            </p>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-black">New password</label>
                <input
                  type="password"
                  {...register('new_password')}
                  placeholder="At least 8 characters"
                  className="w-full h-[44px] px-4 bg-white border border-gray-100 rounded-[8px] text-[13px] focus:outline-none focus:border-[#F4B227] transition-colors"
                />
                {errors.new_password && <p className="text-xs text-red-500">{errors.new_password.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-black">Confirm password</label>
                <input
                  type="password"
                  {...register('confirm_password')}
                  placeholder="Repeat the new password"
                  className="w-full h-[44px] px-4 bg-white border border-gray-100 rounded-[8px] text-[13px] focus:outline-none focus:border-[#F4B227] transition-colors"
                />
                {errors.confirm_password && <p className="text-xs text-red-500">{errors.confirm_password.message}</p>}
              </div>

              <button
                type="submit"
                disabled={pending}
                className="w-full h-[48px] bg-[#F4B227] text-white font-bold text-[16px] rounded-[8px] hover:bg-[#D89500] transition-colors shadow-sm mt-2 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {pending ? (
                  'Saving...'
                ) : (
                  <>
                    <KeyRound className="w-5 h-5" />
                    Set New Password
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-[#F4B227] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
