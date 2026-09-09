import { useAuthStore } from '../stores/authStore';
import { useMutation } from '@tanstack/react-query';

export function useAuth() {
  const user = useAuthStore((state) => state.user);
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const loading = useAuthStore((state) => state.loading);
  const login = useAuthStore((state) => state.login);
  const register = useAuthStore((state) => state.register);
  const logout = useAuthStore((state) => state.logout);
  const initAuth = useAuthStore((state) => state.initAuth);

  return {
    user,
    isLoggedIn,
    loading,
    login,
    register,
    logout,
    initAuth,
  };
}

export function useRegister() {
  const register = useAuthStore((state) => state.register);
  
  return useMutation({
    mutationFn: register,
  });
}

export function useLogin() {
  const login = useAuthStore((state) => state.login);
  
  return useMutation({
    mutationFn: (variables: { email: string; password: string }) => 
      login(variables.email, variables.password),
  });
}
