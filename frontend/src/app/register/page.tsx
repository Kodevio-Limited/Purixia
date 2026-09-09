'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth, useRegister } from '../../hooks/useAuth';
import { useCartStore } from '../../stores/cartStore';
import toast from 'react-hot-toast';

const registerSchema = z.object({
  username: z.string().optional(),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Phone number is too short').max(15, 'Phone number is too long'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <RegisterForm />
    </React.Suspense>
  );
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect');
  const addToCartId = searchParams.get('add_to_cart');
  const registerMutation = useRegister();
  const { isLoggedIn } = useAuth();
  const addItemSilent = useCartStore((s) => s.addItemSilent);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  React.useEffect(() => {
    if (isLoggedIn) {
      const handleAuthSuccess = async () => {
        const { items, fetchCart } = useCartStore.getState();
        if (items.length === 0) {
          await fetchCart();
          const { items: refreshed } = useCartStore.getState();
          if (refreshed.length === 0 && addToCartId) {
            try {
              await addItemSilent(addToCartId, 1);
            } catch (e) {
              console.error('Failed to add item after registration', e);
            }
          }
        }
        router.push(redirectUrl || '/');
      };
      handleAuthSuccess();
    }
  }, [isLoggedIn, router, redirectUrl, addToCartId, addItemSilent]);

  const onSubmit = async (data: RegisterFormValues) => {
    try {
      await registerMutation.mutateAsync(data);
      toast.success('Account created successfully!');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Registration failed');
    }
  };

  return (
    <div className="bg-white flex justify-center px-4 py-[60px] font-poppins">
      <div className="max-w-[440px] w-full">
        <div className="bg-white rounded-[20px] shadow-[0px_10px_40px_rgba(0,0,0,0.05)] p-8 border border-gray-50">
          <div className="text-center mb-6">
            <h1 className="text-[28px] font-bold text-black mb-1">Create Account</h1>
            <p className="text-[13px] text-[#666666]">Join Purixia BD for a premium shopping experience</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-black">Username (optional)</label>
              <input
                {...register('username')}
                placeholder="Enter your username"
                className="w-full h-[44px] px-4 bg-white border border-gray-100 rounded-[8px] text-[13px] focus:outline-none focus:border-[#F4B227] transition-colors"
              />
              {errors.username && <p className="text-xs text-red-500">{errors.username.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-black">Email Address</label>
              <input
                type="email"
                {...register('email')}
                placeholder="Enter your email"
                className="w-full h-[44px] px-4 bg-white border border-gray-100 rounded-[8px] text-[13px] focus:outline-none focus:border-[#F4B227] transition-colors"
              />
              {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-black">Phone Number</label>
              <input
                {...register('phone')}
                placeholder="Enter your phone number"
                className="w-full h-[44px] px-4 bg-white border border-gray-100 rounded-[8px] text-[13px] focus:outline-none focus:border-[#F4B227] transition-colors"
              />
              {errors.phone && <p className="text-xs text-red-500">{errors.phone.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-black">Password</label>
              <input
                type="password"
                {...register('password')}
                placeholder="Create a password"
                className="w-full h-[44px] px-4 bg-white border border-gray-100 rounded-[8px] text-[13px] focus:outline-none focus:border-[#F4B227] transition-colors"
              />
              {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={registerMutation.isPending}
              className="w-full h-[48px] bg-[#F4B227] text-white font-bold text-[16px] rounded-[8px] hover:bg-[#D89500] transition-colors shadow-sm mt-2 disabled:opacity-50"
            >
              {registerMutation.isPending ? 'Creating Account...' : 'Sign Up'}
            </button>
          </form>

          <p className="text-center text-[13px] text-[#666666] mt-6">
            Already have an account?{' '}
            <Link
              href={redirectUrl ? `/login?redirect=${encodeURIComponent(redirectUrl)}` : '/login'}
              className="font-bold text-[#F4B227] hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

