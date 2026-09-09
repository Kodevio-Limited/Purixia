'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth, useLogin } from '../../hooks/useAuth';
import { Button } from '../../components/ui/Button';
import { LogIn } from 'lucide-react';
import toast from 'react-hot-toast';
import { Suspense } from 'react';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoggedIn } = useAuth();
  const loginMutation = useLogin();

  const redirectUrl = searchParams.get('redirect') || '/';

  // Redirect if already logged in
  React.useEffect(() => {
    if (isLoggedIn) {
      router.push(redirectUrl);
    }
  }, [isLoggedIn, router, redirectUrl]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    try {
      await loginMutation.mutateAsync(values);
      toast.success('Welcome back!');
      router.push(redirectUrl);
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.detail || err.response?.data?.non_field_errors?.[0] || 'Login failed';
      toast.error(errorMsg);
    }
  };

  return (
    <div className="bg-white flex justify-center px-4 py-[60px] font-poppins">
      <div className="max-w-[440px] w-full">
        <div className="bg-white rounded-[20px] shadow-[0px_10px_40px_rgba(0,0,0,0.05)] p-8 border border-gray-50">
          <div className="text-center mb-6">
            <h1 className="text-[28px] font-bold text-black mb-1">Welcome Back</h1>
            <p className="text-[13px] text-[#666666]">Sign in to your Purixia BD account</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-black">Email</label>
              <input
                type="email"
                {...register('email')}
                placeholder="Enter your email"
                className="w-full h-[44px] px-4 bg-white border border-gray-100 rounded-[8px] text-[13px] focus:outline-none focus:border-[#F4B227] transition-colors"
              />
              {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[13px] font-semibold text-black">Password</label>
                <Link href="#" className="text-[11px] text-[#666666] hover:text-[#F4B227]">Forgot Password?</Link>
              </div>
              <input
                type="password"
                {...register('password')}
                placeholder="Enter your password"
                className="w-full h-[44px] px-4 bg-white border border-gray-100 rounded-[8px] text-[13px] focus:outline-none focus:border-[#F4B227] transition-colors"
              />
              {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full h-[48px] bg-[#F4B227] text-white font-bold text-[16px] rounded-[8px] hover:bg-[#D89500] transition-colors shadow-sm mt-2 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loginMutation.isPending ? 'Signing in...' : (
                <>
                  <LogIn className="w-5 h-5" />
                  Sign In
                </>
              )}
            </button>
          </form>

          <p className="text-center text-[13px] text-[#666666] mt-6">
            Don't have an account?{' '}
            <Link
              href={redirectUrl ? `/register?redirect=${encodeURIComponent(redirectUrl)}` : '/register'}
              className="font-bold text-[#F4B227] hover:underline"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-[#F4B227] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}

