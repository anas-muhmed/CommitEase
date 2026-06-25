import axios from 'axios';
import { apiClient } from './client';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export interface LoginPayload {
  masjidCode: string;
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  mustChangePassword: boolean;
}

export async function login(payload: LoginPayload): Promise<LoginResponse> {
  const { data } = await apiClient.post('/auth/committee/login', payload);
  return data.data as LoginResponse;
}

// Silent refresh — browser sends 'crt' cookie automatically.
// Uses a bare axios instance to avoid the response interceptor triggering recursion.
export async function silentRefresh(): Promise<{ accessToken: string }> {
  const { data } = await axios.post(
    `${BASE_URL}/auth/committee/refresh`,
    {},
    { withCredentials: true },
  );
  return data.data as { accessToken: string };
}

export async function logout(): Promise<void> {
  await apiClient.post('/auth/committee/logout').catch(() => {});
}

export async function changePassword(payload: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  await apiClient.patch('/auth/committee/change-password', payload);
}
