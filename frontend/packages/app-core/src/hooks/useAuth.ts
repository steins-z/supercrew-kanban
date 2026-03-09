import { useQueryClient } from '@tanstack/react-query';
import { clearToken, isAuthenticated, getUserInfo } from '../auth.js';
import { clearSelectedRepo } from '../api.js';

export function useAuth() {
  const queryClient = useQueryClient();
  const user = getUserInfo();

  function logout() {
    clearToken();
    clearSelectedRepo();
    queryClient.clear();
    window.location.href = '/login';
  }

  return {
    user,
    isLoading: false,
    isAuthenticated: isAuthenticated() && !!user,
    logout,
  };
}
