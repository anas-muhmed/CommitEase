import axios from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export interface MasjidOption {
  masjidCode: string;
  masjidName: string;
}

export async function lookupPhone(phone: string): Promise<MasjidOption[]> {
  const { data } = await axios.post(`${BASE_URL}/auth/member/lookup-phone`, { phone }, { withCredentials: true });
  return (data.data as { masjids: MasjidOption[] }).masjids;
}

export async function requestMemberOtp(masjidCode: string, phone: string): Promise<void> {
  await axios.post(`${BASE_URL}/auth/member/request-otp`, { masjidCode, phone }, { withCredentials: true });
}

export async function verifyMemberOtp(
  masjidCode: string, phone: string, otp: string,
): Promise<{ accessToken: string }> {
  const { data } = await axios.post(`${BASE_URL}/auth/member/verify-otp`, { masjidCode, phone, otp }, { withCredentials: true });
  return data.data as { accessToken: string };
}

// Silent refresh — browser sends 'mst' cookie automatically.
export async function silentMemberRefresh(): Promise<{ accessToken: string }> {
  const { data } = await axios.post(`${BASE_URL}/auth/member/refresh`, {}, { withCredentials: true });
  return data.data as { accessToken: string };
}

export async function memberLogout(): Promise<void> {
  await axios.post(`${BASE_URL}/auth/member/logout`, {}, { withCredentials: true }).catch(() => {});
}
