import { apiClient } from './client';

export interface MasjidSettings {
  id: string;
  code: string;
  name: string;
  address: string | null;
  contactPhone: string | null;
}

export interface CurrentUserSettings {
  id: string;
  name: string;
  username: string;
  committeeRole: string;
}

export interface SettingsData {
  masjid: MasjidSettings;
  me: CurrentUserSettings;
}

export async function getSettings(): Promise<SettingsData> {
  const { data } = await apiClient.get('/committee/settings');
  return data.data as SettingsData;
}

export async function updateSettings(body: {
  name?: string;
  address?: string | null;
  contactPhone?: string | null;
}): Promise<MasjidSettings> {
  const { data } = await apiClient.patch('/committee/settings', body);
  return data.data as MasjidSettings;
}
