import axios from 'axios';
import { useMemberAuthStore } from '@/lib/store/member-auth.store';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export const memberApiClient = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // sends 'mst' HttpOnly cookie automatically
});

let isRefreshing = false;
let waitQueue: Array<(token: string) => void> = [];

function drainQueue(token: string) {
  waitQueue.forEach((cb) => cb(token));
  waitQueue = [];
}

memberApiClient.interceptors.request.use((config) => {
  const token = useMemberAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

memberApiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    if (
      error.response?.status !== 401 ||
      original._retried ||
      (original.url as string | undefined)?.includes('/auth/')
    ) {
      return Promise.reject(error);
    }

    original._retried = true;

    if (isRefreshing) {
      return new Promise((resolve) => {
        waitQueue.push((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          resolve(memberApiClient(original));
        });
      });
    }

    isRefreshing = true;

    try {
      const { data } = await axios.post(`${BASE_URL}/auth/member/refresh`, {}, { withCredentials: true });
      const newToken: string = data.data.accessToken;
      useMemberAuthStore.getState().updateToken(newToken);
      drainQueue(newToken);
      original.headers.Authorization = `Bearer ${newToken}`;
      return memberApiClient(original);
    } catch {
      useMemberAuthStore.getState().clear();
      if (typeof window !== 'undefined') window.location.href = '/portal/login';
      return Promise.reject(error);
    } finally {
      isRefreshing = false;
    }
  },
);
