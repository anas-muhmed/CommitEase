import axios from 'axios';
import { useAuthStore } from '@/lib/store/auth.store';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // sends the 'crt' httpOnly refresh cookie automatically
});

let isRefreshing = false;
let waitQueue: Array<(token: string) => void> = [];

function drainQueue(token: string) {
  waitQueue.forEach((cb) => cb(token));
  waitQueue = [];
}

// Attach access token from Zustand store to every request.
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401: silent refresh via the 'crt' cookie, then retry original request.
apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    // Only attempt refresh once per request, and only for 401s (not /auth routes).
    if (
      error.response?.status !== 401 ||
      original._retried ||
      (original.url as string | undefined)?.includes('/auth/')
    ) {
      return Promise.reject(error);
    }

    original._retried = true;

    if (isRefreshing) {
      // Another request is already refreshing — queue this one.
      return new Promise((resolve) => {
        waitQueue.push((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          resolve(apiClient(original));
        });
      });
    }

    isRefreshing = true;

    try {
      const { data } = await axios.post(
        `${BASE_URL}/auth/committee/refresh`,
        {},
        { withCredentials: true },
      );
      const newToken: string = data.data.accessToken;
      useAuthStore.getState().setAuth(newToken, useAuthStore.getState().user!);
      drainQueue(newToken);
      original.headers.Authorization = `Bearer ${newToken}`;
      return apiClient(original);
    } catch {
      useAuthStore.getState().clear();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      return Promise.reject(error);
    } finally {
      isRefreshing = false;
    }
  },
);
