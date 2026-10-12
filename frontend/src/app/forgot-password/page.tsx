'use client';

import * as React from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { authService } from '../../services/auth';
import { getErrorMessage } from '../../lib/utils';
import { Mail } from 'lucide-react';
import toast from 'react-hot-toast';

const forgotSchema = z.object({
  email: z.string().email('Invalid email address'),
});

type ForgotFormValues = z.infer<typeof forgotSchema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotFormValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (values: ForgotFormValues) => {
    setPending(true);
    try {
      // The backend answers identically whether or not the email exists.
      await authService.requestPasswordReset(values);
      setSent(true);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="bg-white flex justify-center px-4 py-[60px] font-poppins">
      <div className="max-w-[440px] w-full">
        <div className="bg-white rounded-[20px] shadow-[0px_10px_40px_rgba(0,0,0,0.05)] p-8 border border-neutral-100">
          <div className="text-center mb-6">
            <h1 className="text-[28px] font-bold text-black mb-1">Forgot Password</h1>
            <p className="text-[13px] text-neutral-700">
              Enter your account email and we&apos;ll send you a reset link
            </p>
          </div>

          {sent ? (
            <p className="text-[13px] text-navy text-center leading-relaxed">
              If an account uses that email address, a reset link is on its way.
              The link works once and expires in 24 hours — check your inbox.
            </p>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-black">Email</label>
                <input
                  type="email"
                  {...register('email')}
                  placeholder="Enter your email"
                  className="w-full h-[44px] px-4 bg-white border border-neutral-100 rounded-[8px] text-[13px] focus:outline-none focus:border-orange transition-colors"
                />
                {errors.email && <p className="text-xs text-error">{errors.email.message}</p>}
              </div>

              <button
                type="submit"
                disabled={pending}
                className="w-full h-[48px] bg-orange text-white font-bold text-[16px] rounded-[8px] hover:bg-orange-700 transition-colors shadow-sm mt-2 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {pending ? (
                  'Sending...'
                ) : (
                  <>
                    <Mail className="w-5 h-5" />
                    Send Reset Link
                  </>
                )}
              </button>
            </form>
          )}

          <p className="text-center text-[13px] text-neutral-700 mt-6">
            Remembered it?{' '}
            <Link href="/login" className="font-bold text-orange hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
