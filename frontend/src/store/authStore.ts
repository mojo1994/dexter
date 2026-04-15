import { create } from 'zustand';
import { authApi } from '../services/api';

interface User {
  id: string;
  email: string;
  name: string;
  plan: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: JSON.parse(localStorage.getItem('dexter_user') || 'null'),
  token: localStorage.getItem('dexter_token'),
  isAuthenticated: !!localStorage.getItem('dexter_token'),
  isLoading: false,

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const { data } = await authApi.login({ email, password });
      localStorage.setItem('dexter_token', data.token);
      localStorage.setItem('dexter_user', JSON.stringify(data.user));
      set({ user: data.user, token: data.token, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  register: async (email: string, password: string, name: string) => {
    set({ isLoading: true });
    try {
      const { data } = await authApi.register({ email, password, name });
      localStorage.setItem('dexter_token', data.token);
      localStorage.setItem('dexter_user', JSON.stringify(data.user));
      set({ user: data.user, token: data.token, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem('dexter_token');
    localStorage.removeItem('dexter_user');
    set({ user: null, token: null, isAuthenticated: false });
  },

  loadUser: async () => {
    try {
      const { data } = await authApi.getProfile();
      localStorage.setItem('dexter_user', JSON.stringify(data.user));
      set({ user: data.user, isAuthenticated: true });
    } catch {
      localStorage.removeItem('dexter_token');
      localStorage.removeItem('dexter_user');
      set({ user: null, token: null, isAuthenticated: false });
    }
  },
}));
