import { invoke, isTauri } from '@tauri-apps/api/core';

// Outside Tauri (browser dev, Playwright) the key lives in sessionStorage and disappears on close.
const SESSION_KEY = 'verbeterlus.apiKey';

export async function setApiKey(key: string): Promise<void> {
  if (isTauri()) return invoke('set_api_key', { key });
  sessionStorage.setItem(SESSION_KEY, key.trim());
}

export async function hasApiKey(): Promise<boolean> {
  if (isTauri()) return invoke<boolean>('has_api_key');
  return sessionStorage.getItem(SESSION_KEY) !== null;
}

export async function getApiKey(): Promise<string | null> {
  if (isTauri()) return invoke<string | null>('get_api_key');
  return sessionStorage.getItem(SESSION_KEY);
}

export async function deleteApiKey(): Promise<void> {
  if (isTauri()) return invoke('delete_api_key');
  sessionStorage.removeItem(SESSION_KEY);
}
